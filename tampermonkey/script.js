// ==UserScript==
// @name         tiktok-autoblocker
// @namespace    http://tampermonkey.net/
// @version      0.7.1
// @description  Collect TikTok usernames to block and download them as a .txt file. Enhanced with private account support and improved blocking sequence.
// @author       jimididit
// @match        https://www.tiktok.com/*
// @match        https://tiktok.com/*
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

// Use of an Immediately Invoked Function Expression (IIFE) to avoid polluting the global scope.
(function() {
    'use strict';  // Enforcing stricter parsing and error handling in the script.

    // Prevent multiple script executions
    if (window.tiktokAutoBlockerLoaded) {
        console.log('TikTok AutoBlocker already loaded, skipping...');
        return;
    }
    window.tiktokAutoBlockerLoaded = true;

    // Page storage. Sandbox mode does not share the page's localStorage unless we use unsafeWindow.
    const pageStorage = (typeof unsafeWindow !== 'undefined' && unsafeWindow.localStorage) ? unsafeWindow.localStorage : localStorage;
    const blockListKey = 'tiktokBlockList';
    const selectorStorageKey = 'tiktokBlockSelectors';
    console.log('Running Enhanced TikTok AutoBlocker Script v0.3');
    console.log('📍 Current URL:', window.location.href);
    console.log('📍 Page title:', document.title);
    console.log('📍 Script loaded at:', new Date().toISOString());

    try {
        checkForPostNavigationTask();
    } catch (error) {
        console.error('Failed to resume a block task:', error);
        try { pageStorage.removeItem('autoBlock'); } catch (cleanupError) {}
    }

    /**
     * Checks for tasks that should continue after page navigation.
     * This typically involves continuing a blocking process that was interrupted by a page load.
     */
    function checkForPostNavigationTask() {
        let task = null;
        try {
            const raw = pageStorage.getItem('autoBlock');
            task = raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.error('Cleared unreadable block task:', error);
            pageStorage.removeItem('autoBlock');
            return;
        }
        if (task && task.username) {
            performBlockOperation(task);
        }
    }

    function profileHandle(username) {
        return String(username || '').trim().replace(/^@/, '');
    }

    function profileUrl(username) {
        return 'https://www.tiktok.com/@' + profileHandle(username);
    }

    /** Known TikTok path segments that are NOT profile pages */
    const TIKTOK_NON_PROFILE_PATHS = new Set([
        '', 'explore', 'following', 'foryou', 'fyp', 'friends', 'friend',
        'login', 'signup', 'sign-up', 'settings', 'setting', 'discover',
        'search', 'live', 'music', 'tag', 'place', 'sound', 'effect', 'hashtag',
        'notifications', 'notification', 'inbox', 'messages', 'message',
        'upload', 'studio', 'creator', 'creators', 'analytics',
        'trending', 'recommended', 'rewards', 'coin', 'balance', 'wallet', 'shop', 'business',
        'legal', 'policy', 'about', 'feedback', 'help', 'support', 'privacy',
        'safety', 'accessibility', 'transparency', 'forgood', 'community-guidelines',
        'embed', 'share', 't', 'video', 'photo', 'collection', 'sticker',
        'amp', 'auth', 'inapp', 'link', 'jump', 'en',
        '404', '500', 'error', 'null', 'undefined', 'n/a'
    ]);

    function isTikTokProfilePage() {
        const path = window.location.pathname.replace(/^\/|\/$/g, '');
        const segment = path.split('/')[0] || '';
        const normalized = segment.replace(/^@/, '').toLowerCase();
        if (!normalized) return false;
        if (TIKTOK_NON_PROFILE_PATHS.has(normalized) || TIKTOK_NON_PROFILE_PATHS.has(segment.toLowerCase())) {
            return false;
        }
        if (!/^[a-z0-9._]{2,24}$/i.test(normalized)) {
            return false;
        }
        return true;
    }

    function currentProfileUsername() {
        if (!isTikTokProfilePage()) return '';
        let segment = '';
        try {
            segment = decodeURIComponent((window.location.pathname.split('/')[1] || '').trim());
        } catch (error) {
            segment = (window.location.pathname.split('/')[1] || '').trim();
        }
        return segment;
    }

    function isOnProfile(username) {
        const handle = profileHandle(username).toLowerCase();
        let segment = '';
        try {
            segment = decodeURIComponent(window.location.pathname.split('/')[1] || '');
        } catch (error) {
            segment = window.location.pathname.split('/')[1] || '';
        }
        return handle.length > 0 && segment.replace(/^@/, '').toLowerCase() === handle;
    }

    /**
     * Perform blocking operation based on the task details.
     * @param {Object} task - Task information including the username.
     */
    async function performBlockOperation(task) {
        // Task name check to protect against a recursive block check/refresh loop
        if (!profileHandle(task.username) || profileHandle(task.username).toLowerCase() === 'n/a') {
            pageStorage.removeItem('autoBlock');
            handleNextUser();
            return;
        }

        if (!isOnProfile(task.username)) {
            window.location.href = profileUrl(task.username);
            return;
        }

        // Start the process to block a user.
        console.log('User Blocking Init');

        // Wait a bit for the page to load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check if the account is accessible
        const isAccessible = await checkIfAccountAccessible();
        if (!isAccessible) {
            console.warn(`Account ${task.username} is not accessible (deleted, banned, or not found)`);
            updateStatus(`Account ${task.username} not accessible - skipped`, 'warning');
            // Skip this user and move to next
            handleNextUser();
            return;
        }

        // Check if this is a private account
        const isPrivateAccount = await checkIfPrivateAccount();
        
        if (isPrivateAccount) {
            console.info('Private account detected, attempting alternative blocking methods...');
            updateStatus(`Processing private account: ${task.username}`, 'warning');
            await handlePrivateAccountBlocking();
        } else {
            updateStatus(`Processing public account: ${task.username}`, 'info');
            await handlePublicAccountBlocking();
        }

        // Move on to the next user in the queue.
        handleNextUser();
    }

    /**
     * Check if the current account is private
     * @returns {Promise<boolean>} True if the account is private
     */
    async function checkIfPrivateAccount() {
        try {
            // Look for private account indicators
            const privateIndicators = [
                '[data-e2e="private-account"]',
                '.private-account',
                '[data-e2e="user-info"] .private',
                '.user-info .private',
                '[data-e2e="private-icon"]',
                '.private-icon',
                '[data-e2e="user-info"] [data-e2e="private"]',
                '.user-info [data-e2e="private"]'
            ];

            for (const selector of privateIndicators) {
                const element = document.querySelector(selector);
                if (element) {
                    console.info('Private account indicator found:', selector);
                    return true;
                }
            }

            // Check for "This account is private" text
            const pageText = document.body.textContent.toLowerCase();
            if (pageText.includes('this account is private') ||
                pageText.includes('private account') ||
                pageText.includes('account is private')) {
                console.info('Private account text found in page content');
                return true;
            }

            // Check for private account in user subtitle (like "Private")
            const userSubtitle = document.querySelector('[data-e2e="user-subtitle"]');
            if (userSubtitle && userSubtitle.textContent.toLowerCase().includes('private')) {
                console.info('Private account indicator found in user subtitle');
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error checking if account is private:', error);
            return false;
        }
    }

    /**
     * Check if the account is accessible (not deleted, banned, etc.)
     * @returns {Promise<boolean>} True if the account is accessible
     */
    async function checkIfAccountAccessible() {
        try {
            // Check for account not found indicators
            const notFoundIndicators = [
                '[data-e2e="user-not-found"]',
                '.user-not-found',
                '[data-e2e="account-not-found"]',
                '.account-not-found'
            ];

            for (const selector of notFoundIndicators) {
                const element = document.querySelector(selector);
                if (element) {
                    console.info('Account not found indicator found:', selector);
                    return false;
                }
            }

            // Check for specific "User not found" or "Account not found" text
            const pageText = document.body.textContent.toLowerCase();
            console.log('🔍 Checking page text for account not found indicators...');
            console.log('📄 Page text sample (first 500 chars):', pageText.substring(0, 500));
            
            // Look for specific error messages that indicate account not found
            const notFoundTexts = [
                'user not found',
                'account not found',
                'this user doesn\'t exist',
                'couldn\'t find this account',
                'this account doesn\'t exist',
                'account unavailable'
            ];
            
            // Only check for these texts if they appear in a more specific context
            let foundNotFoundText = false;
            
            // First, check if there are any error containers or specific elements
            const errorContainers = document.querySelectorAll('[data-e2e*="error"], [data-e2e*="not-found"], .error, .not-found, [role="alert"]');
            for (const container of errorContainers) {
                const containerText = container.textContent.toLowerCase();
                for (const text of notFoundTexts) {
                    if (containerText.includes(text)) {
                        console.info(`❌ Account not found text found in error container: "${text}"`);
                        foundNotFoundText = true;
                        break;
                    }
                }
                if (foundNotFoundText) break;
            }
            
            // If no error containers found, check page title and main content more carefully
            if (!foundNotFoundText) {
                // Check page title
                const pageTitle = document.title.toLowerCase();
                for (const text of notFoundTexts) {
                    if (pageTitle.includes(text)) {
                        console.info(`❌ Account not found text found in page title: "${text}"`);
                        foundNotFoundText = true;
                        break;
                    }
                }
                
                // Check main content area (more specific than entire page)
                const mainContent = document.querySelector('main, [data-e2e="main"], .main-content, [role="main"]');
                if (mainContent && !foundNotFoundText) {
                    const mainText = mainContent.textContent.toLowerCase();
                    for (const text of notFoundTexts) {
                        if (mainText.includes(text)) {
                            console.info(`❌ Account not found text found in main content: "${text}"`);
                            foundNotFoundText = true;
                            break;
                        }
                    }
                }
            }
            
            if (foundNotFoundText) {
                return false;
            }

            // Check if we're on a valid TikTok profile page
            const profileIndicators = [
                '[data-e2e="user-info"]',
                '.user-info',
                '[data-e2e="user-avatar"]',
                '.user-avatar',
                '[data-e2e="user-title"]',
                '.user-title',
                '[data-e2e="user-subtitle"]',
                '.user-subtitle'
            ];

            for (const selector of profileIndicators) {
                const element = document.querySelector(selector);
                if (element) {
                    console.info('Profile indicator found:', selector);
                    return true;
                }
            }

            // If we're on a TikTok page and have a username in the URL, assume it's accessible
            if (window.location.href.includes('tiktok.com') && window.location.pathname.split('/')[1]) {
                console.info('Assuming account is accessible based on URL structure');
                return true;
            }

            // Additional fallback: if we can find any user-related elements, assume accessible
            const userElements = document.querySelectorAll('[data-e2e*="user"], [data-e2e*="profile"], .user, .profile');
            if (userElements.length > 0) {
                console.info('Found user-related elements, assuming account is accessible');
                return true;
            }

            // Final fallback: if we're on a TikTok page, assume accessible unless we're very certain it's not
            if (window.location.href.includes('tiktok.com')) {
                console.info('On TikTok page, defaulting to accessible');
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error checking if account is accessible:', error);
            // Default to accessible if there's an error
            return true;
        }
    }

    /**
     * Handle blocking for private accounts
     */
    async function handlePrivateAccountBlocking() {
        console.log('🔒 Starting private account blocking process...');
        try {
            // Step 1: Find and click the "More" button (3 dots)
            console.log('🔍 Step 1: Looking for more options button...');
            const selectorLists = readSelectorLists();
            const moreButton = await waitForAnyElement(selectorLists.more, 5000);
            if (!moreButton) {
                console.warn('❌ Could not find more options button');
                const username = window.location.pathname.split('/')[1];
                addUsernameToBlockList(username);
                return;
            }

            console.log('✅ Step 1: Found more options button:', moreButton);
            console.log('🖱️ Step 1: Clicking more options button...');
            simulateMouseEvent(moreButton, 'click');
            console.log('⏳ Step 1: Waiting after click...');
            await new Promise(resolve => setTimeout(resolve, 1500));
            console.log('✅ Step 1: Wait complete');

            // Step 2: Find and click the "Block" option in the popover
            console.log('🔍 Step 2: Looking for block option in popover...');
            const blockOption = await waitForAnyElement(selectorLists.block, 3000);
            if (!blockOption) {
                console.warn('❌ Could not find block option in popover');
                const username = window.location.pathname.split('/')[1];
                addUsernameToBlockList(username);
                return;
            }

            console.log('✅ Step 2: Found block option:', blockOption);
            console.log('🖱️ Step 2: Clicking block option in popover...');
            simulateMouseEvent(blockOption, 'click');
            console.log('⏳ Step 2: Waiting after click...');
            await new Promise(resolve => setTimeout(resolve, 1500));
            console.log('✅ Step 2: Wait complete');

            // Step 3: Find and click the "Block" button in the confirmation modal
            console.log('🔍 Step 3: Looking for confirm button in modal...');
            const confirmButton = await waitForAnyElement(selectorLists.confirm, 3000);
            if (!confirmButton) {
                console.warn('❌ Could not find confirm button in modal');
                const username = window.location.pathname.split('/')[1];
                addUsernameToBlockList(username);
                return;
            }

            console.log('✅ Step 3: Found confirm button:', confirmButton);
            console.log('🖱️ Step 3: Clicking block button in modal...');
            simulateMouseEvent(confirmButton, 'click');
            console.log('✅ Block confirmed successfully!');
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            console.error('❌ Error handling private account blocking:', error);
            // Add to block list as fallback
            const username = window.location.pathname.split('/')[1];
            addUsernameToBlockList(username);
        }
    }

    /**
     * Handle blocking for public accounts (original method)
     */
    async function handlePublicAccountBlocking() {
        console.log('🌐 Starting public account blocking process...');
        try {
            // Step 1: Find and click the "More" button (3 dots)
            console.log('🔍 Step 1: Looking for more options button...');
            const selectorLists = readSelectorLists();
            const moreButton = await waitForAnyElement(selectorLists.more, 5000);
            if (!moreButton) {
                console.warn('❌ Could not find more options button');
                const username = window.location.pathname.split('/')[1];
                addUsernameToBlockList(username);
                return;
            }

            console.log('✅ Step 1: Found more options button:', moreButton);
            console.log('🖱️ Step 1: Clicking more options button...');
            simulateMouseEvent(moreButton, 'click');
            console.log('⏳ Step 1: Waiting after click...');
            await new Promise(resolve => setTimeout(resolve, 1500));
            console.log('✅ Step 1: Wait complete');

            // Step 2: Find and click the "Block" option in the popover
            console.log('🔍 Step 2: Looking for block option in popover...');
            const blockOption = await waitForAnyElement(selectorLists.block, 3000);
            if (!blockOption) {
                console.warn('❌ Could not find block option in popover');
                const username = window.location.pathname.split('/')[1];
                addUsernameToBlockList(username);
                return;
            }

            console.log('✅ Step 2: Found block option:', blockOption);
            console.log('🖱️ Step 2: Clicking block option in popover...');
            simulateMouseEvent(blockOption, 'click');
            console.log('⏳ Step 2: Waiting after click...');
            await new Promise(resolve => setTimeout(resolve, 1500));
            console.log('✅ Step 2: Wait complete');

            // Step 3: Find and click the "Block" button in the confirmation modal
            console.log('🔍 Step 3: Looking for confirm button in modal...');
            const confirmButton = await waitForAnyElement(selectorLists.confirm, 3000);
            if (!confirmButton) {
                console.warn('❌ Could not find confirm button in modal');
                const username = window.location.pathname.split('/')[1];
                addUsernameToBlockList(username);
                return;
            }

            console.log('✅ Step 3: Found confirm button:', confirmButton);
            console.log('🖱️ Step 3: Clicking block button in modal...');
            simulateMouseEvent(confirmButton, 'click');
            console.log('✅ Block confirmed successfully!');
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            console.error('❌ Error handling public account blocking:', error);
            // Add to block list as fallback
            const username = window.location.pathname.split('/')[1];
            addUsernameToBlockList(username);
        }
    }

     /**
     * Processes the next user in the queue.
     */
    function handleNextUser() {
        const users = JSON.parse(pageStorage.getItem('autoBlockQueue') || '[]');
        if (users.length > 0) {
            const nextUser = users.shift();
            pageStorage.setItem('autoBlockQueue', JSON.stringify(users));
            pageStorage.setItem('autoBlock', JSON.stringify(nextUser));
            updateStatus(`Queue: ${users.length} users remaining`, 'info');
            checkForPostNavigationTask();
        } else {
            console.log('✅ No more users in the queue.');
            updateStatus('Process complete!', 'success');
            pageStorage.removeItem('autoBlockQueue');
            pageStorage.removeItem('autoBlock');
        }
    }

    /**
     * Waits for a DOM element to appear within a specified timeout.
     * @param {String} selector - The CSS selector of the element.
     * @param {Number} timeout - The timeout in milliseconds.
     * @returns {Promise<Element>} A promise that resolves with the element.
     */
    const DEFAULT_MORE_SELECTORS = [
        'button[data-e2e="user-more"]',
        '[data-e2e="user-more"]',
        'button[aria-label="Actions"]',
        'button[aria-label="More options"]'
    ];
    const DEFAULT_BLOCK_SELECTORS = [
        'div[role="button"][aria-label="Block"]',
        '[role="button"][aria-label="Block"]',
        '[aria-label="Block"]'
    ];
    const DEFAULT_CONFIRM_SELECTORS = [
        'button[data-e2e="block-popup-block-btn"]',
        'button[class*="StyledButtonBlock"]',
        'button[class*="Button-StyledButtonBlock"]'
    ];
    const DEFAULT_BLOCKED_ACCOUNT_SELECTORS = [
        'h3[data-e2e="block-user-username"]',
        '[data-e2e="block-user-username"]'
    ];

    function readCustomSelectors() {
        try {
            return JSON.parse(pageStorage.getItem(selectorStorageKey) || '{}') || {};
        } catch (error) {
            return {};
        }
    }

    function withCustomSelector(customValue, defaults) {
        const value = String(customValue || '').trim();
        if (!value) return defaults.slice();
        return [value].concat(defaults.filter(function(selector) { return selector !== value; }));
    }

    function readSelectorLists() {
        const custom = readCustomSelectors();
        return {
            more: withCustomSelector(custom.more, DEFAULT_MORE_SELECTORS),
            block: withCustomSelector(custom.block, DEFAULT_BLOCK_SELECTORS),
            confirm: withCustomSelector(custom.confirm, DEFAULT_CONFIRM_SELECTORS),
            blockedAccount: withCustomSelector(custom.blockedAccount, DEFAULT_BLOCKED_ACCOUNT_SELECTORS)
        };
    }

    function saveCustomSelectors(selectors) {
        pageStorage.setItem(selectorStorageKey, JSON.stringify(selectors));
    }

    function selectorForElement(start) {
        let el = start;
        for (let i = 0; i < 6 && el && el !== document.body; i++) {
            const e2e = el.getAttribute && el.getAttribute('data-e2e');
            if (e2e) {
                return el.tagName.toLowerCase() + '[data-e2e="' + e2e.replace(/"/g, '\\"') + '"]';
            }
            const aria = el.getAttribute && el.getAttribute('aria-label');
            const role = el.getAttribute && el.getAttribute('role');
            if (aria && (role === 'button' || el.tagName === 'BUTTON')) {
                const rolePart = role ? '[role="' + role + '"]' : '';
                return el.tagName.toLowerCase() + rolePart + '[aria-label="' + aria.replace(/"/g, '\\"') + '"]';
            }
            el = el.parentElement;
        }
        return '';
    }

    function waitForAnyElement(selectors, timeout) {
        return new Promise((resolve) => {
            const endTime = Date.now() + timeout;
            const timer = setInterval(() => {
                if (Date.now() > endTime) {
                    clearInterval(timer);
                    resolve(null);
                    return;
                }
                for (let i = 0; i < selectors.length; i++) {
                    try {
                        const el = document.querySelector(selectors[i]);
                        if (el) {
                            clearInterval(timer);
                            resolve(el);
                            return;
                        }
                    } catch (error) {
                        console.warn('Invalid selector:', selectors[i], error);
                    }
                }
            }, 150);
        });
    }

    function waitForElement(selector, timeout) {
        return new Promise((resolve, reject) => {
            const intervalTime = 100;
            const endTime = Number(new Date()) + timeout;
            const timer = setInterval(() => {
                if (Number(new Date()) > endTime) {
                    clearInterval(timer);
                    reject(new Error("Element not found within time: " + selector));
                }
                const el = document.querySelector(selector);
                if (el) {
                    clearInterval(timer);
                    resolve(el);
                }
            }, intervalTime);
        });
    }

    /**
     * Simulates a mouse event on the specified element.
     * @param {Element} element - The DOM element to target.
     * @param {String} eventType - The type of event ('click', 'mouseover', etc.).
     */
    function reactProps(element) {
        let node = element;
        for (let guard = 0; node && guard < 6; guard += 1) {
            const key = Object.keys(node).find(function (name) { return name.indexOf('__reactProps') === 0; });
            const props = key ? node[key] : null;
            if (props && (props.onClick || props.onPointerDown || props.onMouseDown)) return props;
            node = node.parentElement;
        }
        return null;
    }

    function simulateMouseEvent(element, eventType) {
        if (!element) return;
        console.log('Simulating ' + eventType + ' event');
        element.setAttribute('data-tiktok-autoblocker-target', '1');
        const pageDoc = (typeof unsafeWindow !== 'undefined' && unsafeWindow.document) ? unsafeWindow.document : document;
        const pageEl = pageDoc.querySelector('[data-tiktok-autoblocker-target]') || element;
        element.removeAttribute('data-tiktok-autoblocker-target');
        const props = reactProps(pageEl);
        const rect = pageEl.getBoundingClientRect();
        const fake = {
            currentTarget: pageEl,
            target: pageEl,
            button: 0,
            buttons: 1,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
            preventDefault: function () {},
            stopPropagation: function () {},
            persist: function () {},
            nativeEvent: { isTrusted: true, button: 0 }
        };
        if (props && props.onPointerDown) props.onPointerDown(Object.assign({ type: 'pointerdown' }, fake));
        if (props && props.onMouseDown) props.onMouseDown(Object.assign({ type: 'mousedown' }, fake));
        if (props && props.onClick) props.onClick(Object.assign({ type: 'click', buttons: 0 }, fake));
    }

    function handleFromProfileHref(href) {
        if (!href) return '';
        const match = String(href).match(/\/@([^/?#]+)/);
        if (!match) return '';
        let name = match[1];
        try { name = decodeURIComponent(name); } catch (error) { return ''; }
        name = name.replace(/^@/, '').trim();
        if (!name || /[\s/]/.test(name)) return '';
        return name;
    }

    function blockedAccountsList() {
        if (location.pathname.indexOf('/setting/block-list') === -1) return null;
        return document.querySelector('[class*="DivBlockList"]')
            || document.getElementById('main-content-setting')
            || document.body;
    }

    function handlesInBlockedList(list, selectors) {
        const listSelectors = selectors && selectors.length ? selectors : DEFAULT_BLOCKED_ACCOUNT_SELECTORS;
        for (let i = 0; i < listSelectors.length; i++) {
            let nodes = [];
            try {
                nodes = list.querySelectorAll(listSelectors[i]);
            } catch (error) {
                continue;
            }
            const names = [];
            nodes.forEach(function(node) {
                const name = (node.textContent || '').replace(/^@/, '').trim();
                if (name && !/[\s/]/.test(name)) names.push(name);
            });
            if (names.length) return names;
        }
        const names = [];
        list.querySelectorAll('a[href*="/@"]').forEach(function(link) {
            const href = link.getAttribute('href') || '';
            if (href.indexOf('/video/') !== -1) return;
            const name = handleFromProfileHref(href);
            if (name) names.push(name);
        });
        return names;
    }

    function blockedListScroller(list) {
        let node = list;
        while (node && node !== document.documentElement) {
            const overflow = window.getComputedStyle(node).overflowY;
            if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight + 8) {
                return node;
            }
            node = node.parentElement;
        }
        return document.scrollingElement || document.documentElement;
    }

    function clickBlockedListLoadMore(list) {
        const buttons = list.querySelectorAll('button');
        for (let i = 0; i < buttons.length; i++) {
            const text = (buttons[i].innerText || '').trim().toLowerCase();
            if (text === 'load more' || text === 'see more') {
                buttons[i].click();
                return true;
            }
        }
        return false;
    }

    async function collectBlockedHandles() {
        const selectorLists = readSelectorLists();
        const started = Date.now();
        const seen = new Set();
        let stable = 0;
        for (let pass = 0; pass < 600 && stable < 3; pass++) {
            const list = blockedAccountsList();
            if (!list) return { ok: false, reason: 'not-page' };
            const before = seen.size;
            handlesInBlockedList(list, selectorLists.blockedAccount).forEach(function(name) { seen.add(name); });
            if (seen.size === before) stable += 1;
            else stable = 0;
            if (seen.size === 0 && Date.now() - started < 4000) stable = 0;
            clickBlockedListLoadMore(list);
            const last = list.lastElementChild;
            if (last && last.scrollIntoView) last.scrollIntoView({ block: 'end' });
            const scroller = blockedListScroller(list);
            scroller.scrollTop = scroller.scrollHeight;
            window.scrollTo(0, document.body.scrollHeight);
            if (seen.size !== before) updateStatus('Reading blocked accounts… ' + seen.size, 'info');
            await new Promise(function(resolve) { setTimeout(resolve, 700); });
        }
        return { ok: true, usernames: Array.from(seen) };
    }

    async function importBlockedAccountsFromPage() {
        if (!window.location.pathname.includes('/setting/block-list')) {
            window.location.href = 'https://www.tiktok.com/setting/block-list';
            return;
        }
        updateStatus('Reading blocked accounts…', 'info');
        const result = await collectBlockedHandles();
        if (!result.ok) {
            updateStatus('Open the Blocked accounts page, then try again.', 'warning');
            return;
        }
        const existing = JSON.parse(pageStorage.getItem(blockListKey) || '[]');
        const seen = new Set(existing.map(function(name) {
            return String(name || '').replace(/^@/, '').trim().toLowerCase();
        }));
        let added = 0;
        result.usernames.forEach(function(name) {
            const raw = String(name || '').replace(/^@/, '').trim();
            const key = raw.toLowerCase();
            if (!key || seen.has(key)) return;
            seen.add(key);
            existing.push('@' + raw);
            added += 1;
        });
        pageStorage.setItem(blockListKey, JSON.stringify(existing));
        if (result.usernames.length === 0) {
            updateStatus('No blocked accounts on this page.', 'warning');
        } else if (added === 0) {
            updateStatus('All ' + result.usernames.length + ' blocked accounts are already in your list.', 'info');
        } else {
            updateStatus('Added ' + added + ' blocked accounts. Download the list to save everyone, including ones you added yourself.', 'success');
        }
    }

    let statusHideTimer = null;
    const panelCollapsedKey = 'tiktokAutoBlockerPanelCollapsed';

    function ensurePanelStyles() {
        if (document.getElementById('tiktok-autoblocker-styles')) return;
        const style = document.createElement('style');
        style.id = 'tiktok-autoblocker-styles';
        style.textContent = `
#tiktok-autoblocker-card {
  --ttab-bg: #f4f6f8;
  --ttab-surface: #ffffff;
  --ttab-ink: #0f172a;
  --ttab-muted: #64748b;
  --ttab-border: #e2e8f0;
  --ttab-border-strong: #cbd5e1;
  --ttab-brand: #ff4757;
  --ttab-brand-hover: #e83e4d;
  --ttab-success: #15803d;
  --ttab-success-bg: #f0fdf4;
  --ttab-success-border: #bbf7d0;
  --ttab-info: #0369a1;
  --ttab-info-bg: #f0f9ff;
  --ttab-info-border: #bae6fd;
  --ttab-warning: #a16207;
  --ttab-warning-bg: #fffbeb;
  --ttab-warning-border: #fde68a;
  --ttab-error: #b91c1c;
  --ttab-error-bg: #fef2f2;
  --ttab-error-border: #fecaca;
  --ttab-radius: 8px;
  position: fixed;
  top: 96px;
  right: 16px;
  width: 300px;
  max-height: calc(100vh - 112px);
  overflow: auto;
  z-index: 1000000;
  box-sizing: border-box;
  padding: 14px;
  font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 13px;
  line-height: 1.45;
  color: var(--ttab-ink);
  background: linear-gradient(180deg, #fafbfc 0%, var(--ttab-bg) 100%);
  border: 1px solid var(--ttab-border);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  -webkit-font-smoothing: antialiased;
}
#tiktok-autoblocker-card * { box-sizing: border-box; }
#tiktok-autoblocker-card.ttab-collapsed {
  width: auto;
  max-height: none;
  overflow: visible;
  padding: 8px 10px;
}
#tiktok-autoblocker-card.ttab-collapsed .ttab-body { display: none; }
#tiktok-autoblocker-card .ttab-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--ttab-border);
}
#tiktok-autoblocker-card.ttab-collapsed .ttab-header {
  margin: 0;
  padding: 0;
  border: 0;
  align-items: center;
}
#tiktok-autoblocker-card .ttab-title {
  margin: 0;
  font-size: 14px;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--ttab-ink);
}
#tiktok-autoblocker-card .ttab-subtitle {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--ttab-muted);
}
#tiktok-autoblocker-card .ttab-icon-btn {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: 1px solid var(--ttab-border-strong);
  border-radius: 6px;
  background: var(--ttab-surface);
  color: var(--ttab-muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
#tiktok-autoblocker-card .ttab-icon-btn:hover {
  color: var(--ttab-ink);
  background: #f8fafc;
}
#tiktok-autoblocker-card .ttab-icon-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(255, 71, 87, 0.28);
}
#tiktok-autoblocker-card .ttab-section { margin-bottom: 10px; }
#tiktok-autoblocker-card .ttab-label {
  margin: 0 0 6px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ttab-muted);
}
#tiktok-autoblocker-card .ttab-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
#tiktok-autoblocker-card .ttab-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin: 0;
  padding: 9px 12px;
  border: 1px solid transparent;
  border-radius: var(--ttab-radius);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}
#tiktok-autoblocker-card .ttab-btn:focus-visible,
#tiktok-autoblocker-card .ttab-file:focus-within,
#tiktok-autoblocker-card summary:focus-visible,
#tiktok-autoblocker-card input:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(255, 71, 87, 0.28);
}
#tiktok-autoblocker-card .ttab-btn-primary {
  background: var(--ttab-brand);
  border-color: var(--ttab-brand);
  color: #fff;
}
#tiktok-autoblocker-card .ttab-btn-primary:hover { background: var(--ttab-brand-hover); border-color: var(--ttab-brand-hover); }
#tiktok-autoblocker-card .ttab-btn-secondary,
#tiktok-autoblocker-card .ttab-file-label {
  background: var(--ttab-surface);
  border-color: var(--ttab-border-strong);
  color: var(--ttab-ink);
  font-weight: 550;
}
#tiktok-autoblocker-card .ttab-btn-secondary:hover,
#tiktok-autoblocker-card .ttab-file-label:hover {
  background: #f8fafc;
  border-color: #94a3b8;
}
#tiktok-autoblocker-card .ttab-file { display: block; }
#tiktok-autoblocker-card .ttab-file input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
#tiktok-autoblocker-card .ttab-file-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--ttab-border-strong);
  border-radius: var(--ttab-radius);
  cursor: pointer;
}
#tiktok-autoblocker-card #block-status {
  display: none;
  margin: 0 0 10px;
  padding: 9px 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  font-size: 12px;
  text-align: left;
}
#tiktok-autoblocker-card #block-status.ttab-success {
  display: block;
  background: var(--ttab-success-bg);
  border-color: var(--ttab-success-border);
  color: var(--ttab-success);
}
#tiktok-autoblocker-card #block-status.ttab-error {
  display: block;
  background: var(--ttab-error-bg);
  border-color: var(--ttab-error-border);
  color: var(--ttab-error);
}
#tiktok-autoblocker-card #block-status.ttab-warning {
  display: block;
  background: var(--ttab-warning-bg);
  border-color: var(--ttab-warning-border);
  color: var(--ttab-warning);
}
#tiktok-autoblocker-card #block-status.ttab-info {
  display: block;
  background: var(--ttab-info-bg);
  border-color: var(--ttab-info-border);
  color: var(--ttab-info);
}
#tiktok-autoblocker-card .ttab-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 10px;
  padding: 9px 10px;
  background: var(--ttab-surface);
  border: 1px solid var(--ttab-border);
  border-radius: var(--ttab-radius);
  font-size: 12px;
}
#tiktok-autoblocker-card .ttab-stats span:first-child { color: var(--ttab-muted); font-weight: 550; }
#tiktok-autoblocker-card .ttab-stats strong { font-weight: 650; font-variant-numeric: tabular-nums; }
#tiktok-autoblocker-card .ttab-selectors {
  margin: 0 0 10px;
  background: var(--ttab-surface);
  border: 1px solid var(--ttab-border);
  border-radius: var(--ttab-radius);
  overflow: hidden;
}
#tiktok-autoblocker-card .ttab-selectors summary {
  cursor: pointer;
  list-style: none;
  padding: 9px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ttab-ink);
  user-select: none;
}
#tiktok-autoblocker-card .ttab-selectors summary::-webkit-details-marker { display: none; }
#tiktok-autoblocker-card .ttab-selectors[open] summary {
  border-bottom: 1px solid var(--ttab-border);
  background: #f8fafc;
}
#tiktok-autoblocker-card .ttab-selectors-body { padding: 10px; }
#tiktok-autoblocker-card .ttab-hint {
  margin: 0 0 8px;
  font-size: 11px;
  color: var(--ttab-muted);
  line-height: 1.4;
}
#tiktok-autoblocker-card .ttab-group {
  margin: 10px 0 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--ttab-muted);
}
#tiktok-autoblocker-card .ttab-selectors label {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  font-weight: 550;
}
#tiktok-autoblocker-card .ttab-selectors input[type="text"] {
  width: 100%;
  margin-top: 4px;
  padding: 7px 8px;
  border: 1px solid var(--ttab-border-strong);
  border-radius: 6px;
  background: #fff;
  color: var(--ttab-ink);
  font-family: ui-monospace, "Cascadia Code", "Segoe UI Mono", Menlo, Consolas, monospace;
  font-size: 11px;
}
#tiktok-autoblocker-card .ttab-footer {
  padding-top: 10px;
  border-top: 1px solid var(--ttab-border);
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--ttab-muted);
}
#tiktok-autoblocker-card .ttab-footer strong { color: #475569; font-weight: 650; }
@media (prefers-reduced-motion: reduce) {
  #tiktok-autoblocker-card .ttab-btn { transition: none; }
}
`;
        document.documentElement.appendChild(style);
    }

    function refreshPanelStats() {
        const countEl = document.getElementById('ttab-block-count');
        if (!countEl) return;
        try {
            const list = JSON.parse(pageStorage.getItem(blockListKey) || '[]');
            countEl.textContent = String(list.length);
        } catch (e) {
            countEl.textContent = '—';
        }
    }

    function init() {
        if (document.getElementById('tiktok-autoblocker-card')) return;

        try {
            ensurePanelStyles();
            const card = createCard();
            const body = card.querySelector('.ttab-body');

            const primarySection = document.createElement('div');
            primarySection.className = 'ttab-section';
            primarySection.appendChild(makeButton('Add current user', addUserToBlockList, 'primary'));
            body.appendChild(primarySection);

            const listSection = document.createElement('div');
            listSection.className = 'ttab-section';
            const listLabel = document.createElement('p');
            listLabel.className = 'ttab-label';
            listLabel.textContent = 'Block list';
            listSection.appendChild(listLabel);

            const stack = document.createElement('div');
            stack.className = 'ttab-stack';
            stack.appendChild(makeButton('Download list', downloadBlockList, 'secondary'));
            stack.appendChild(createFileInput());
            stack.appendChild(makeButton('Add my blocked accounts', importBlockedAccountsFromPage, 'secondary'));
            listSection.appendChild(stack);
            body.appendChild(listSection);

            body.appendChild(createStatusIndicator());
            body.appendChild(createStatsRow());
            addSelectorSettings(body, card);

            const footer = document.createElement('div');
            footer.className = 'ttab-footer';
            footer.innerHTML = '<strong>v0.7.1</strong><span>.txt upload</span>';
            body.appendChild(footer);

            refreshPanelStats();
        } catch (error) {
            console.error('Error creating AutoBlocker UI:', error);
        }
    }

    function makeButton(text, onClick, variant) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = text;
        button.className = 'ttab-btn ttab-btn-' + (variant || 'secondary');
        button.addEventListener('click', onClick);
        return button;
    }

    function createFileInput() {
        const wrap = document.createElement('label');
        wrap.className = 'ttab-file';
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,text/plain';
        input.addEventListener('change', handleFileUpload);
        const label = document.createElement('span');
        label.className = 'ttab-file-label';
        label.textContent = 'Upload list';
        wrap.appendChild(input);
        wrap.appendChild(label);
        return wrap;
    }

    function createStatusIndicator() {
        const statusDiv = document.createElement('div');
        statusDiv.id = 'block-status';
        statusDiv.setAttribute('role', 'status');
        return statusDiv;
    }

    function createStatsRow() {
        const stats = document.createElement('div');
        stats.className = 'ttab-stats';
        stats.innerHTML = '<span>Saved accounts</span><strong id="ttab-block-count">0</strong>';
        return stats;
    }

    function updateStatus(message, type) {
        type = type || 'info';
        const statusDiv = document.getElementById('block-status');
        if (!statusDiv) return;

        if (statusHideTimer) {
            clearTimeout(statusHideTimer);
            statusHideTimer = null;
        }

        statusDiv.textContent = message;
        statusDiv.className = 'ttab-' + type;
        statusDiv.style.display = 'block';
        statusDiv.setAttribute('role', (type === 'error' || type === 'warning') ? 'alert' : 'status');

        if (type === 'success') {
            statusHideTimer = setTimeout(function() {
                statusDiv.style.display = 'none';
            }, 4000);
        } else if (type === 'info') {
            statusHideTimer = setTimeout(function() {
                statusDiv.style.display = 'none';
            }, 5000);
        }

        refreshPanelStats();
    }

    async function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        const text = await file.text();
        const usernames = text.split(/\r?\n/).filter(u => u.trim() !== '').map(username => ({username: username.trim(), action: 'block'}));
        pageStorage.setItem('autoBlockQueue', JSON.stringify(usernames));
        updateStatus('Loaded ' + usernames.length + ' usernames for blocking', 'info');
        handleNextUser();
    }

    function createCard() {
        const card = document.createElement('div');
        card.id = 'tiktok-autoblocker-card';
        card.setAttribute('role', 'region');
        card.setAttribute('aria-label', 'TikTok AutoBlocker');

        const header = document.createElement('div');
        header.className = 'ttab-header';

        const copy = document.createElement('div');
        const title = document.createElement('h2');
        title.className = 'ttab-title';
        title.textContent = 'TikTok AutoBlocker';
        const subtitle = document.createElement('p');
        subtitle.className = 'ttab-subtitle';
        subtitle.textContent = 'Block users and manage lists';
        copy.appendChild(title);
        copy.appendChild(subtitle);

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'ttab-icon-btn';
        toggle.setAttribute('aria-expanded', 'true');
        toggle.setAttribute('aria-label', 'Collapse panel');
        toggle.textContent = '–';
        toggle.addEventListener('click', function() {
            const collapsed = card.classList.toggle('ttab-collapsed');
            toggle.textContent = collapsed ? '+' : '–';
            toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            toggle.setAttribute('aria-label', collapsed ? 'Expand panel' : 'Collapse panel');
            try {
                pageStorage.setItem(panelCollapsedKey, collapsed ? '1' : '0');
            } catch (e) {}
        });

        header.appendChild(copy);
        header.appendChild(toggle);
        card.appendChild(header);

        const body = document.createElement('div');
        body.className = 'ttab-body';
        card.appendChild(body);

        document.body.appendChild(card);

        try {
            if (pageStorage.getItem(panelCollapsedKey) === '1') {
                card.classList.add('ttab-collapsed');
                toggle.textContent = '+';
                toggle.setAttribute('aria-expanded', 'false');
                toggle.setAttribute('aria-label', 'Expand panel');
            }
        } catch (e) {}

        return card;
    }

    function addSelectorSettings(body, card) {
        const saved = readCustomSelectors();
        const details = document.createElement('details');
        details.className = 'ttab-selectors';

        const summary = document.createElement('summary');
        summary.textContent = 'Advanced · Page selectors';
        details.appendChild(summary);

        const panel = document.createElement('div');
        panel.className = 'ttab-selectors-body';

        const hint = document.createElement('p');
        hint.className = 'ttab-hint';
        hint.textContent = 'Leave empty for built-in selectors. Pick, then click the control on the page.';
        panel.appendChild(hint);

        function group(text) {
            const heading = document.createElement('p');
            heading.className = 'ttab-group';
            heading.textContent = text;
            panel.appendChild(heading);
        }

        function field(labelText, key, placeholder) {
            const label = document.createElement('label');
            label.appendChild(document.createTextNode(labelText));
            const input = document.createElement('input');
            input.type = 'text';
            input.value = saved[key] || '';
            input.placeholder = placeholder;
            input.spellcheck = false;
            input.dataset.selectorKey = key;
            label.appendChild(input);
            panel.appendChild(label);
            return input;
        }

        group('Blocking a profile');
        const moreInput = field('Actions button', 'more', 'button[data-e2e="user-more"]');
        const blockInput = field('Block menu item', 'block', 'div[role="button"][aria-label="Block"]');
        const confirmInput = field('Confirm button', 'confirm', 'button[data-e2e="block-popup-block-btn"]');
        group('Blocked accounts page');
        const blockedAccountInput = field('Username', 'blockedAccount', 'h3[data-e2e="block-user-username"]');
        const inputs = { more: moreInput, block: blockInput, confirm: confirmInput, blockedAccount: blockedAccountInput };

        function currentValues() {
            return {
                more: moreInput.value.trim(),
                block: blockInput.value.trim(),
                confirm: confirmInput.value.trim(),
                blockedAccount: blockedAccountInput.value.trim()
            };
        }

        let picker = null;
        function stopPicker() {
            if (!picker) return;
            document.removeEventListener('click', picker, true);
            picker = null;
        }

        function pick(key, labelText) {
            stopPicker();
            updateStatus('Click the ' + labelText + ' on the page', 'info');
            picker = function(event) {
                if (card.contains(event.target)) return;
                event.preventDefault();
                event.stopPropagation();
                const selector = selectorForElement(event.target);
                stopPicker();
                if (!selector) {
                    updateStatus('Could not read a selector from that click', 'warning');
                    return;
                }
                inputs[key].value = selector;
                saveCustomSelectors(currentValues());
                updateStatus('Saved ' + labelText + ' selector', 'success');
            };
            document.addEventListener('click', picker, true);
        }

        // Re-order: field rows already appended; insert pick buttons after each input's label
        moreInput.parentNode.insertAdjacentElement('afterend', makeButton('Pick', function() { pick('more', 'Actions button'); }, 'secondary'));
        blockInput.parentNode.insertAdjacentElement('afterend', makeButton('Pick', function() { pick('block', 'Block item'); }, 'secondary'));
        confirmInput.parentNode.insertAdjacentElement('afterend', makeButton('Pick', function() { pick('confirm', 'confirm button'); }, 'secondary'));
        blockedAccountInput.parentNode.insertAdjacentElement('afterend', makeButton('Pick', function() { pick('blockedAccount', 'blocked-account username'); }, 'secondary'));

        const saveStack = document.createElement('div');
        saveStack.className = 'ttab-stack';
        saveStack.style.marginTop = '10px';
        saveStack.appendChild(makeButton('Save selectors', function() {
            saveCustomSelectors(currentValues());
            updateStatus('Selectors saved', 'success');
        }, 'primary'));
        panel.appendChild(saveStack);

        details.appendChild(panel);
        body.appendChild(details);
    }

    // Add current profile username to blocklist
    function addUserToBlockList() {
        const username = currentProfileUsername();
        if (!username) {
            updateStatus('Open a TikTok profile page first (for example /@username).', 'warning');
            return;
        }
        const blockList = JSON.parse(pageStorage.getItem(blockListKey) || '[]');
        const norm = function(u) { return String(u || '').replace(/^@/, '').toLowerCase(); };
        const already = blockList.some(function(u) { return norm(u) === norm(username); });
        if (!already) {
            blockList.push(username);
            pageStorage.setItem(blockListKey, JSON.stringify(blockList));
            updateStatus('Added ' + username + ' to block list.', 'success');
        } else {
            updateStatus(username + ' is already in the block list.', 'info');
        }
        refreshPanelStats();
    }

    // Add a specific username to blocklist (for use in automation)
    function addUsernameToBlockList(username) {
        const blockList = JSON.parse(pageStorage.getItem(blockListKey) || '[]');
        if (!blockList.includes(username)) {
            blockList.push(username);
            pageStorage.setItem(blockListKey, JSON.stringify(blockList));
            console.info(`Added ${username} to block list.`);
            return true;
        } else {
            console.info(`${username} is already in the block list.`);
            return false;
        }
    }

    // Download blocklist as TXT file
    function downloadBlockList() {
        const blockList = JSON.parse(pageStorage.getItem(blockListKey) || '[]');
        const blob = new Blob([blockList.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tiktok-blocklist.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        updateStatus('Downloaded ' + blockList.length + ' accounts.', 'success');
    }

    // Call init function to initialize interface
    function initializeUI() {
        if (!window.location.href.includes('tiktok.com')) return;

        const pathParts = window.location.pathname.split('/').filter(part => part.trim() !== '');
        let username = null;

        if (pathParts.length > 0 && pathParts[0].startsWith('@')) {
            username = pathParts[0].substring(1);
        } else if (pathParts.length > 0 && pathParts[0] !== '' && !pathParts[0].includes('.')) {
            username = pathParts[0];
        } else if (pathParts.length > 1 && pathParts[0] === 'user') {
            username = pathParts[1];
        } else {
            username = 'current';
        }

        if (!username) return;

        setTimeout(function() {
            try {
                init();
            } catch (error) {
                console.error('Error during UI initialization:', error);
            }
        }, 1000);
    }
    
    // Initialize immediately if DOM is ready
    if (document.readyState === 'loading') {
        console.log('⏳ DOM still loading, waiting for DOMContentLoaded...');
        document.addEventListener('DOMContentLoaded', function() {
            console.log('✅ DOMContentLoaded fired, initializing UI...');
            initializeUI();
        });
    } else {
        console.log('✅ DOM already ready, initializing UI immediately...');
        initializeUI();
    }
    
    // Also try to initialize after a longer delay as fallback
    setTimeout(() => {
        console.log('🔄 Fallback UI initialization attempt 1...');
        initializeUI();
    }, 3000);
    
    // Additional fallback attempts
    setTimeout(() => {
        console.log('🔄 Fallback UI initialization attempt 2...');
        initializeUI();
    }, 5000);
    
    setTimeout(() => {
        console.log('🔄 Fallback UI initialization attempt 3...');
        initializeUI();
    }, 10000);
    
    // Listen for page load completion
    window.addEventListener('load', function() {
        console.log('✅ Window load event fired, attempting UI initialization...');
        setTimeout(() => {
            initializeUI();
        }, 1000);
    });
})();
