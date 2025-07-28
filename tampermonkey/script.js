// ==UserScript==
// @name         tiktok-autoblocker
// @namespace    http://tampermonkey.net/
// @version      0.4.0
// @description  Collect TikTok usernames to block and download them as a .txt file. Enhanced with private account support and improved blocking sequence.
// @author       jimididit
// @match        *://*.tiktok.com/*
// @grant        none
// @run-at       document-start
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

    // Key to access TikTok block list in localStorage.
    const blockListKey = 'tiktokBlockList';
    console.log('Running Enhanced TikTok AutoBlocker Script v0.3');
    console.log('📍 Current URL:', window.location.href);
    console.log('📍 Page title:', document.title);
    console.log('📍 Script loaded at:', new Date().toISOString());

    // Initialize the script by checking if there's a post-navigation task to be performed.
    checkForPostNavigationTask();

    /**
     * Checks for tasks that should continue after page navigation.
     * This typically involves continuing a blocking process that was interrupted by a page load.
     */
    function checkForPostNavigationTask() {
        const task = JSON.parse(localStorage.getItem('autoBlock'));
        if (task) {
            performBlockOperation(task);
        }
    }

    /**
     * Perform blocking operation based on the task details.
     * @param {Object} task - Task information including the username.
     */
    async function performBlockOperation(task) {
        // Task name check to protect against a recursive block check/refresh loop
        if(task.username == "@N/A"){
            localStorage.removeItem('autoBlock'); // Remove the stored Task since it's a broken user
            handleNextUser(); // Force another check to ensure the queue continues if @N/A is found part way through
            return;
        }

        // Check if the current location is the correct user page, if not redirect.
        if (!window.location.href.includes(`https://www.tiktok.com/${task.username}`)) {
            window.location.href = `https://www.tiktok.com/${task.username}`;
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
                pageText.includes('account is private') ||
                pageText.includes('private')) {
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
            const moreButton = await waitForElement('[data-e2e="user-more"]', 5000);
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
            const blockOption = await waitForElement('div[role="button"][aria-label="Block"]', 3000);
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
            const confirmButton = await waitForElement('button[data-e2e="block-popup-block-btn"], button[class*="Button-StyledButtonBlock"]', 3000);
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
            const moreButton = await waitForElement('[data-e2e="user-more"]', 5000);
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
            const blockOption = await waitForElement('div[role="button"][aria-label="Block"]', 3000);
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
            const confirmButton = await waitForElement('button[data-e2e="block-popup-block-btn"], button[class*="Button-StyledButtonBlock"]', 3000);
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
        const users = JSON.parse(localStorage.getItem('autoBlockQueue') || '[]');
        if (users.length > 0) {
            const nextUser = users.shift();
            localStorage.setItem('autoBlockQueue', JSON.stringify(users));
            localStorage.setItem('autoBlock', JSON.stringify(nextUser));
            updateStatus(`Queue: ${users.length} users remaining`, 'info');
            checkForPostNavigationTask();
        } else {
            console.log('✅ No more users in the queue.');
            updateStatus('Process complete!', 'success');
            localStorage.removeItem('autoBlockQueue');
            localStorage.removeItem('autoBlock');
        }
    }

    /**
     * Waits for a DOM element to appear within a specified timeout.
     * @param {String} selector - The CSS selector of the element.
     * @param {Number} timeout - The timeout in milliseconds.
     * @returns {Promise<Element>} A promise that resolves with the element.
     */
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
    function simulateMouseEvent(element, eventType) {
        console.log(`Simulating ${eventType} event`);
        const event = new MouseEvent(eventType, {
            view: window,
            bubbles: true,
            cancelable: true
        });
        element.dispatchEvent(event);
        console.log(`${eventType} event triggered`);
    }

    // Initialize the user interface.
    function init() {
        console.log('🎯 init() function called');
        console.log('🎯 Document ready state:', document.readyState);
        console.log('🎯 Document body exists:', !!document.body);
        console.log('🎯 Document body children count:', document.body ? document.body.children.length : 'N/A');
        console.log('🎯 Document head exists:', !!document.head);
        console.log('🎯 Window location:', window.location.href);
        
        // Check if UI already exists to prevent duplicates
        if (document.getElementById('tiktok-autoblocker-card')) {
            console.log('🎯 UI already exists, skipping initialization');
            return;
        }
        
        console.log('🎯 Creating TikTok AutoBlocker UI...');
        
        try {
            const card = createCard('Block List Manager');
            console.log('✅ Card created successfully:', card);
            
            addButton(card, 'Add User to Block List', addUserToBlockList);
            console.log('✅ Add button added');
            
            addButton(card, 'Download Block List', downloadBlockList);
            console.log('✅ Download button added');
            
            createFileInput(card);
            console.log('✅ File input created');
            
            createStatusIndicator(card);
            console.log('✅ Status indicator created');
            
            console.log('✅ TikTok AutoBlocker UI created successfully!');
            console.log('✅ Card element in DOM:', document.getElementById('tiktok-autoblocker-card'));
            console.log('✅ Card visible:', document.getElementById('tiktok-autoblocker-card') ? 'YES' : 'NO');
            
            // Force a repaint to ensure visibility
            if (document.getElementById('tiktok-autoblocker-card')) {
                document.getElementById('tiktok-autoblocker-card').style.display = 'none';
                document.getElementById('tiktok-autoblocker-card').offsetHeight; // Force reflow
                document.getElementById('tiktok-autoblocker-card').style.display = 'block';
                console.log('✅ Forced repaint of card element');
            }
            
        } catch (error) {
            console.error('❌ Error creating UI:', error);
            console.error('❌ Error stack:', error.stack);
        }
    }

    // Add buttons to the UI for user interactions like adding to the block list and downloading it.
    function addButtonFunctionality(card) {
        addButton(card, 'Add to Block List', addUserToBlockList);
        addButton(card, 'Download Block List', downloadBlockList);
    }

    // Create a file input for handling block list uploads.
    function createFileInput(card) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.style.width = '100%';
        fileInput.style.marginTop = '10px';
        fileInput.onchange = handleFileUpload;
        card.appendChild(fileInput);
    }

    // Create a status indicator for showing blocking progress
    function createStatusIndicator(card) {
        const statusDiv = document.createElement('div');
        statusDiv.id = 'block-status';
        statusDiv.style.marginTop = '10px';
        statusDiv.style.padding = '8px';
        statusDiv.style.backgroundColor = '#f0f0f0';
        statusDiv.style.borderRadius = '4px';
        statusDiv.style.fontSize = '12px';
        statusDiv.style.textAlign = 'center';
        statusDiv.style.display = 'none';
        statusDiv.textContent = 'Ready';
        card.appendChild(statusDiv);
    }

    // Update the status indicator
    function updateStatus(message, type = 'info') {
        const statusDiv = document.getElementById('block-status');
        if (statusDiv) {
            statusDiv.style.display = 'block';
            statusDiv.textContent = message;
            
            // Set color based on type
            switch(type) {
                case 'success':
                    statusDiv.style.backgroundColor = '#d4edda';
                    statusDiv.style.color = '#155724';
                    break;
                case 'error':
                    statusDiv.style.backgroundColor = '#f8d7da';
                    statusDiv.style.color = '#721c24';
                    break;
                case 'warning':
                    statusDiv.style.backgroundColor = '#fff3cd';
                    statusDiv.style.color = '#856404';
                    break;
                default:
                    statusDiv.style.backgroundColor = '#d1ecf1';
                    statusDiv.style.color = '#0c5460';
            }
        }
    }

    // Handle the upload of a file and process the included usernames.
    async function handleFileUpload(event) {
        const file = event.target.files[0];
        const text = await file.text();
        const usernames = text.split(/\r?\n/).filter(u => u.trim() !== '').map(username => ({username: username.trim(), action: 'block'}));
        localStorage.setItem('autoBlockQueue', JSON.stringify(usernames));
        updateStatus(`Loaded ${usernames.length} usernames for blocking`, 'info');
        console.log('🚀 Starting blocking process...');
        handleNextUser();
    }

    // Create the main UI card that hosts all UI elements.
    function createCard(cardTitle) {
        console.log('🎯 createCard() called with title:', cardTitle);
        
        const card = document.createElement('div');
        card.id = 'tiktok-autoblocker-card';
        card.style.position = 'fixed';
        card.style.top = '150px';
        card.style.right = '20px';
        card.style.width = '250px';
        card.style.backgroundColor = '#fff';
        card.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        card.style.padding = '10px';
        card.style.borderRadius = '8px';
        card.style.zIndex = '1000000';

        const title = document.createElement('div');
        title.innerHTML = `<h3>${cardTitle}</h3>`;
        title.style.textAlign = 'center';
        title.style.marginBottom = '10px';
        title.style.color = '#333333';
        card.appendChild(title);

        console.log('🎯 About to append card to document.body');
        console.log('🎯 Document body exists:', !!document.body);
        console.log('🎯 Card element created:', card);
        
        document.body.appendChild(card);
        console.log('✅ Card appended to document.body successfully');
        console.log('✅ Card now in DOM:', document.getElementById('tiktok-autoblocker-card'));
        
        return card;
    }
    
    // Add a button to the card with defined actions.
    function addButton(card, text, onClick) {
        const button = document.createElement('button');
        button.textContent = text;
        button.style.backgroundColor = 'rgb(254, 44, 85)';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.padding = '10px';
        button.style.marginTop = '5px';
        button.style.width = '100%';
        button.style.borderRadius = '5px';
        button.style.cursor = 'pointer';
        button.onclick = onClick;
        card.appendChild(button);
    }

     // Initiate the download of the block list.
    function createFilenameInput(card) {
        // Divider
        const divider = document.createElement('hr');
        divider.style.marginTop = '10px';
        divider.style.marginBottom = '10px';
        card.appendChild(divider);

        const filenameLabel = document.createElement('label');
        filenameLabel.textContent = 'Blocklist file:';
        filenameLabel.style.display = 'block';
        filenameLabel.style.marginBottom = '5px';
        filenameLabel.style.marginTop = '5px';
        filenameLabel.style.color = '#333';
        card.appendChild(filenameLabel);
    }

    // Add current profile username to blocklist
    function addUserToBlockList() {
        const username = window.location.pathname.split('/')[1];
        const blockList = JSON.parse(localStorage.getItem(blockListKey) || '[]');
        if (!blockList.includes(username)) {
            blockList.push(username);
            localStorage.setItem(blockListKey, JSON.stringify(blockList));
            console.info(`Added ${username} to block list.`);
        } else {
            console.info(`${username} is already in the block list.`);
        }
    }

    // Add a specific username to blocklist (for use in automation)
    function addUsernameToBlockList(username) {
        const blockList = JSON.parse(localStorage.getItem(blockListKey) || '[]');
        if (!blockList.includes(username)) {
            blockList.push(username);
            localStorage.setItem(blockListKey, JSON.stringify(blockList));
            console.info(`Added ${username} to block list.`);
            return true;
        } else {
            console.info(`${username} is already in the block list.`);
            return false;
        }
    }

    // Download blocklist as TXT file
    function downloadBlockList() {
        const blockList = JSON.parse(localStorage.getItem(blockListKey) || '[]');
        //const filename = filenameInput.value.trim();
        const blob = new Blob([blockList.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tiktok-blocklist.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Call init function to initialize interface
    // Wait for DOM to be ready and only show on TikTok profile pages
    console.log('🎯 Script initialization starting...');
    console.log('📍 Document ready state:', document.readyState);
    console.log('📍 Current URL:', window.location.href);
    console.log('📍 Is TikTok page:', window.location.href.includes('tiktok.com'));
    console.log('📍 Has username in path:', window.location.pathname.split('/')[1]);
    
    // Simple test to verify script is running
    function createTestElement() {
        console.log('🧪 Creating test element to verify script is running...');
        const testDiv = document.createElement('div');
        testDiv.id = 'tiktok-autoblocker-test';
        testDiv.style.position = 'fixed';
        testDiv.style.top = '10px';
        testDiv.style.left = '10px';
        testDiv.style.backgroundColor = 'red';
        testDiv.style.color = 'white';
        testDiv.style.padding = '5px';
        testDiv.style.zIndex = '9999999';
        testDiv.style.fontSize = '12px';
        testDiv.textContent = 'TikTok AutoBlocker Script Running!';
        document.body.appendChild(testDiv);
        console.log('✅ Test element created and visible');
        
        // Remove test element after 5 seconds
        setTimeout(() => {
            if (testDiv.parentNode) {
                testDiv.parentNode.removeChild(testDiv);
                console.log('🗑️ Test element removed');
            }
        }, 5000);
    }
    
    // Function to initialize UI with retry logic
    function initializeUI() {
        console.log('🎯 Attempting to initialize UI...');
        
        // Check if we're on a TikTok page
        if (!window.location.href.includes('tiktok.com')) {
            console.log('❌ Not on TikTok page, skipping UI initialization');
            return;
        }
        
        // More robust username detection
        const pathParts = window.location.pathname.split('/').filter(part => part.trim() !== '');
        console.log('📍 Path parts:', pathParts);
        
        // Check for different TikTok URL patterns
        let username = null;
        
        // Pattern 1: /@username
        if (pathParts.length > 0 && pathParts[0].startsWith('@')) {
            username = pathParts[0].substring(1); // Remove @ symbol
            console.log('✅ Found username with @ pattern:', username);
        }
        // Pattern 2: /username (without @)
        else if (pathParts.length > 0 && pathParts[0] !== '' && !pathParts[0].includes('.')) {
            username = pathParts[0];
            console.log('✅ Found username without @ pattern:', username);
        }
        // Pattern 3: /user/username
        else if (pathParts.length > 1 && pathParts[0] === 'user') {
            username = pathParts[1];
            console.log('✅ Found username in /user/ pattern:', username);
        }
        // Pattern 4: Check if we're on any TikTok page (fallback)
        else {
            console.log('⚠️ No clear username pattern found, but on TikTok page');
            console.log('📍 Full pathname:', window.location.pathname);
            console.log('📍 Full URL:', window.location.href);
            
            // If we're on TikTok, show UI anyway (might be homepage or other page)
            username = 'current'; // Dummy value to allow UI creation
        }
        
        if (!username || username === '') {
            console.log('❌ No username detected, not a profile page');
            return;
        }
        
        console.log('✅ TikTok page detected, initializing UI...');
        
        // Create test element first
        createTestElement();
        
        // Add a small delay to ensure page is fully loaded
        setTimeout(() => {
            try {
                init();
                console.log('✅ UI initialization completed successfully!');
            } catch (error) {
                console.error('❌ Error during UI initialization:', error);
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
