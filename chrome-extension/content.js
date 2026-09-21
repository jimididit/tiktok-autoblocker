// TikTok AutoBlocker Content Script
// This script runs on TikTok pages and handles the blocking functionality
// Wrapped in IIFE so re-injection (e.g. from popup) does not redeclare const/let → "Identifier has already been declared"
(function() {
'use strict';
if (window.tiktokAutoBlockerLoaded) {
    console.log('TikTok AutoBlocker already loaded, skipping...');
    return;
}
window.tiktokAutoBlockerLoaded = true;

// ===== DEVELOPER SETTINGS =====
// Set this to true to enable debug features (only for developers with source code)
const DEBUG_MODE_ENABLED = false;
// =============================

console.log('TikTok AutoBlocker Content Script Loaded');
console.log('Current URL:', window.location.href);
console.log('Page title:', document.title);

// Key to access TikTok block list in chrome.storage
const blockListKey = 'tiktokBlockList';

// Statistics tracking for the current session
let blockingStats = {
    total: 0,
    blocked: 0,
    alreadyBlocked: 0,
    errors: 0,
    skipped: 0
};

// Load blocking stats from storage on script initialization
chrome.storage.local.get(['blockingStats'], function(result) {
    if (result.blockingStats) {
        blockingStats = result.blockingStats;
        console.log('📊 Loaded blocking stats from storage:', blockingStats);
    } else {
        console.log('📊 No existing blocking stats found, starting fresh');
    }
});

// Debug logging system
let debugLog;
if (typeof debugLog === 'undefined') {
    debugLog = [];
}
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
const originalConsoleInfo = console.info;

// Override console methods to capture debug messages
console.log = function(...args) {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] LOG: ${args.join(' ')}`;
    debugLog.push(message);
    originalConsoleLog.apply(console, args);
};

console.warn = function(...args) {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] WARN: ${args.join(' ')}`;
    debugLog.push(message);
    originalConsoleWarn.apply(console, args);
};

console.error = function(...args) {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] ERROR: ${args.join(' ')}`;
    debugLog.push(message);
    originalConsoleError.apply(console, args);
};

console.info = function(...args) {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] INFO: ${args.join(' ')}`;
    debugLog.push(message);
    originalConsoleInfo.apply(console, args);
};

// Function to export debug log
function exportDebugLog() {
    const logText = debugLog.join('\n');
    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tiktok-autoblocker-debug-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('✅ Debug log exported successfully!');
}

// Function to clear debug log
function clearDebugLog() {
    debugLog.length = 0;
    console.log('🗑️ Debug log cleared!');
}

// Auto-cleanup debug log to prevent memory leaks
// Keep only the last 1000 entries
function cleanupDebugLog() {
    if (debugLog.length > 1000) {
        debugLog = debugLog.slice(-1000);
        console.log('🧹 Debug log cleaned up (kept last 1000 entries)');
    }
}

// Set up periodic cleanup
setInterval(cleanupDebugLog, 60000); // Clean up every minute

// Function to check if debug mode is enabled
function isDebugModeEnabled() {
    return DEBUG_MODE_ENABLED;
}

// Function to log only if debug mode is enabled
function logDebug(message, type = 'log') {
    if (DEBUG_MODE_ENABLED) {
        switch(type) {
            case 'warn':
                console.warn(message);
                break;
            case 'error':
                console.error(message);
                break;
            case 'info':
                console.info(message);
                break;
            default:
                console.log(message);
        }
    }
}

// Initialize the script by checking if there's a post-navigation task to be performed.
checkForPostNavigationTask();

/** Known TikTok path segments that are NOT profile pages (avoid redirect loops) */
const TIKTOK_NON_PROFILE_PATHS = new Set([
    '', 'explore', 'following', 'fyp', 'login', 'signup', 'settings', 'discover',
    'search', 'live', 'music', 'notifications', 'inbox', 'upload', 'studio',
    'trending', 'recommended', 'friend', 'rewards', 'legal', 'policy', 'about',
    '404'  // error page – treat as non-profile so we clear session and stop refresh loop
]);

/** Max age of a blocking task in ms; older tasks are cleared to prevent reload loops (e.g. after re-enabling extension) */
const TASK_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Returns true if the current URL looks like a TikTok user profile page (e.g. /username or /@user).
 * Used to avoid redirecting on homepage/explore/etc. which can cause infinite reload loops.
 */
function isTikTokProfilePage() {
    const path = window.location.pathname.replace(/^\/|\/$/g, '');
    const segment = path.split('/')[0] || '';
    const normalized = segment.replace(/^@/, '').toLowerCase();
    if (TIKTOK_NON_PROFILE_PATHS.has(normalized) || TIKTOK_NON_PROFILE_PATHS.has(segment.toLowerCase())) {
        return false;
    }
    return segment.length > 0;
}

/** Username without a leading @. */
function profileHandle(username) {
    return String(username || '').trim().replace(/^@/, '');
}

/** Canonical profile URL. TikTok profiles live at /@handle. */
function profileUrl(username) {
    return 'https://www.tiktok.com/@' + profileHandle(username);
}

/** True when the open page is this user's profile, with or without @ in storage. */
function isOnProfile(username) {
    const handle = profileHandle(username).toLowerCase();
    let segment = '';
    try {
        segment = decodeURIComponent((window.location.pathname.split('/')[1] || ''));
    } catch (e) {
        segment = window.location.pathname.split('/')[1] || '';
    }
    return handle.length > 0 && segment.replace(/^@/, '').toLowerCase() === handle;
}

/**
 * Clears blocking task and queue from storage (stops redirect/reload loops).
 */
function clearStuckBlockingSession(reason) {
    console.log('🛑 Clearing blocking session:', reason);
    chrome.storage.local.remove(['autoBlock', 'autoBlockQueue', 'autoBlockTaskSetAt'], function() {
        console.log('✅ Cleared autoBlock and queue');
    });
}

/**
 * Checks for tasks that should continue after page navigation.
 * This typically involves continuing a blocking process that was interrupted by a page load.
 * Safeguards: do not redirect on non-profile pages (clears stuck session); expire old tasks.
 */
function checkForPostNavigationTask() {
    console.log('🔍 Checking for post-navigation tasks...');
    chrome.storage.local.get(['autoBlock', 'autoBlockQueue', 'autoBlockTaskSetAt'], function(result) {
        const task = result.autoBlock;
        const queue = (result.autoBlockQueue || []);
        const taskSetAt = result.autoBlockTaskSetAt;
        const onProfilePage = isTikTokProfilePage();

        // If we're not on a profile page (e.g. homepage, explore), never redirect – clear stuck session to stop reload loop
        if (!onProfilePage && (task?.username || queue.length > 0)) {
            clearStuckBlockingSession('not on a profile page (avoid redirect loop)');
            return;
        }

        // Expire old tasks so re-enabling the extension doesn’t resume an old run
        if (taskSetAt && (Date.now() - taskSetAt > TASK_MAX_AGE_MS)) {
            clearStuckBlockingSession('task older than ' + (TASK_MAX_AGE_MS / 60000) + ' minutes');
            return;
        }

        if (task && task.username) {
            console.log('🚀 Starting block operation for:', task);
            performBlockOperation(task);
        } else if (queue.length > 0) {
            console.log('🚀 Starting new task from queue...');
            handleNextUser();
        } else {
            console.log('❌ No valid auto block task or queue');
        }
    });
}

/**
 * Perform blocking or unblocking operation based on the task details.
 * @param {Object} task - Task information including the username and action.
 */
async function performBlockOperation(task) {
    console.log('🚀 performBlockOperation started for task:', task);
    
    // Increment total count for this user
    updateBlockingStats('total');
    
    if (!profileHandle(task.username) || profileHandle(task.username).toLowerCase() === 'n/a') {
        chrome.storage.local.remove(['autoBlock'], function() {
            console.log('🗑️ Removed N/A task from storage');
            handleNextUser();
        });
        return;
    }

    if (!isOnProfile(task.username)) {
        const nextUrl = profileUrl(task.username);
        console.log('🔄 Redirecting to user page:', nextUrl);
        window.location.href = nextUrl;
        return;
    }

    console.log('✅ On correct user page, starting process...');

    // Start the process to block or unblock a user.
    console.log('User Operation Init');

    // Wait a bit for the page to load
    console.log('⏳ Waiting for page to load...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Page load wait complete');

    // Check if the account is accessible
    console.log('🔍 Checking if account is accessible...');
    const isAccessible = await checkIfAccountAccessible();
    console.log('📊 Account accessible:', isAccessible);
    
    if (!isAccessible) {
        console.warn(`Account ${task.username} is not accessible (deleted, banned, or not found)`);
        const actionText = task.action === 'unblock' ? 'unblocking' : 'blocking';
        updateStatus(`Account ${task.username} not accessible - skipped`, 'warning');
        updateBlockingStats('skipped');
        // Skip this user and move to next
        handleNextUser();
        return;
    }

    // Already-blocked is decided after the Actions menu opens, inside the block step.
    // Checking it here clicked that menu once, and the block step clicked it again, which closed it.

    // Check if this is a private account
    console.log('🔍 Checking if account is private...');
    const isPrivateAccount = await checkIfPrivateAccount();
    console.log('📊 Private account detected:', isPrivateAccount);
    
    if (isPrivateAccount) {
        console.info('Private account detected, attempting alternative methods...');
        updateStatus(`Processing private account: ${task.username}`, 'warning');
        // Unblock functionality temporarily disabled
        // if (task.action === 'unblock') {
        //     await handlePrivateAccountUnblocking();
        // } else {
            await handlePrivateAccountBlocking(task);
        // }
    } else {
        updateStatus(`Processing public account: ${task.username}`, 'info');
        // Unblock functionality temporarily disabled
        // if (task.action === 'unblock') {
        //     await handlePublicAccountUnblocking();
        // } else {
            await handlePublicAccountBlocking(task);
        // }
    }

    // Move on to the next user in the queue.
    console.log('🔄 Moving to next user...');
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

        const profileRoot = document.querySelector('[data-e2e="user-page"]');
        const pageText = (profileRoot || document.body).textContent.toLowerCase();
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
        // These should be more specific to avoid false positives
        const notFoundTexts = [
            'user not found',
            'account not found',
            'this user doesn\'t exist',
            'couldn\'t find this account',
            'this account doesn\'t exist',
            'account unavailable'
        ];
        
        // Only check for these texts if they appear in a more specific context
        // Look for them in error messages, titles, or specific error containers
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
async function handlePrivateAccountBlocking(task) {
    console.log('🔒 Starting private account blocking process...');
    try {
        // Step 1: Find and click the "More" button (3 dots)
        console.log('🔍 Step 1: Looking for more options button...');
        const selectorLists = await getSelectorLists();
        const moreButton = await waitForAnyElement(selectorLists.more, 5000);
        if (!moreButton) {
            console.warn('❌ Could not find more options button');
            updateStatus(`Error blocking ${task.username}: Could not find more options button`, 'error');
            updateBlockingStats('errors');
            const username = window.location.pathname.split('/')[1];
            addUsernameToBlockList(username, true);
            return;
        }

        console.log('✅ Step 1: Found more options button:', moreButton);
        console.log('🖱️ Step 1: Clicking more options button...');
        const menuAction = await openActionsAndFindBlock(moreButton);
        if (menuAction && menuAction.type === 'unblock') {
            console.info('Unblock is visible, so ' + task.username + ' is already blocked');
            updateStatus('User ' + task.username + ' is already blocked on TikTok', 'info');
            updateBlockingStats('alreadyBlocked');
            return;
        }
        const blockOption = menuAction && menuAction.element;
        if (!blockOption) {
            console.warn('❌ Could not find block option in popover');
            updateStatus('Error blocking ' + task.username + ': Could not find block option', 'error');
            updateBlockingStats('errors');
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
        let confirmButton = await waitForAnyElement(selectorLists.confirm, 2500).catch(() => null);
        if (!confirmButton) confirmButton = await new Promise(function(resolve) {
            const end = Date.now() + 2000;
            const t = setInterval(function() {
                if (Date.now() > end) { clearInterval(t); resolve(null); return; }
                var el = findConfirmBlockByText();
                if (el) { clearInterval(t); resolve(el); }
            }, 200);
        });
        if (!confirmButton) {
            console.warn('❌ Could not find confirm button in modal');
            updateStatus(`Error blocking ${task.username}: Could not find confirm button`, 'error');
            updateBlockingStats('errors');
            const username = window.location.pathname.split('/')[1];
            addUsernameToBlockList(username, true);
            return;
        }

        console.log('✅ Step 3: Found confirm button:', confirmButton);
        console.log('🖱️ Step 3: Clicking block button in modal...');
        simulateMouseEvent(confirmButton, 'click');
        console.log('✅ Block confirmed successfully!');
        updateBlockingStats('blocked');
        await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
        console.error('❌ Error handling private account blocking:', error);
        updateStatus(`Error blocking ${task.username}: ${error.message}`, 'error');
        updateBlockingStats('errors');
        // Add to block list as fallback
        const username = window.location.pathname.split('/')[1];
        addUsernameToBlockList(username, true);
    }
}

/**
 * Handle blocking for public accounts (original method)
 */
async function handlePublicAccountBlocking(task) {
    console.log('🌐 Starting public account blocking process...');
    try {
        // Step 1: Find and click the "More" button (3 dots)
        console.log('🔍 Step 1: Looking for more options button...');
        const selectorLists = await getSelectorLists();
        const moreButton = await waitForAnyElement(selectorLists.more, 5000);
        if (!moreButton) {
            console.warn('❌ Could not find more options button');
            updateStatus(`Error blocking ${task.username}: Could not find more options button`, 'error');
            updateBlockingStats('errors');
            const username = window.location.pathname.split('/')[1];
            addUsernameToBlockList(username, true);
            return;
        }

        console.log('✅ Step 1: Found more options button:', moreButton);
        console.log('🖱️ Step 1: Clicking more options button...');
        const menuAction = await openActionsAndFindBlock(moreButton);
        if (menuAction && menuAction.type === 'unblock') {
            console.info('Unblock is visible, so ' + task.username + ' is already blocked');
            updateStatus('User ' + task.username + ' is already blocked on TikTok', 'info');
            updateBlockingStats('alreadyBlocked');
            return;
        }
        const blockOption = menuAction && menuAction.element;
        if (!blockOption) {
            console.warn('❌ Could not find block option in popover');
            updateStatus('Error blocking ' + task.username + ': Could not find block option', 'error');
            updateBlockingStats('errors');
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
        let confirmButton = await waitForAnyElement(selectorLists.confirm, 2500).catch(() => null);
        if (!confirmButton) confirmButton = await new Promise(function(resolve) {
            const end = Date.now() + 2000;
            const t = setInterval(function() {
                if (Date.now() > end) { clearInterval(t); resolve(null); return; }
                var el = findConfirmBlockByText();
                if (el) { clearInterval(t); resolve(el); }
            }, 200);
        });
        if (!confirmButton) {
            console.warn('❌ Could not find confirm button in modal');
            updateStatus(`Error blocking ${task.username}: Could not find confirm button`, 'error');
            updateBlockingStats('errors');
            const username = window.location.pathname.split('/')[1];
            addUsernameToBlockList(username, true);
            return;
        }

        console.log('✅ Step 3: Found confirm button:', confirmButton);
        console.log('🖱️ Step 3: Clicking block button in modal...');
        simulateMouseEvent(confirmButton, 'click');
        console.log('✅ Block confirmed successfully!');
        updateBlockingStats('blocked');
        await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
        console.error('❌ Error handling public account blocking:', error);
        updateStatus(`Error blocking ${task.username}: ${error.message}`, 'error');
        updateBlockingStats('errors');
        // Add to block list as fallback
        const username = window.location.pathname.split('/')[1];
        addUsernameToBlockList(username, true);
    }
}

/**
 * Processes the next user in the queue.
 */
function handleNextUser() {
    console.log('🔄 handleNextUser called');
    chrome.storage.local.get(['autoBlockQueue'], function(result) {
        const users = result.autoBlockQueue || [];
        console.log('📋 Current queue:', users);
        console.log('📊 Queue length:', users.length);
        
        if (users.length > 0) {
            let nextUser = users.shift();
            console.log('👤 Next user to process:', nextUser);
            console.log('📊 Next user type:', typeof nextUser);
            console.log('📊 Next user stringified:', JSON.stringify(nextUser));
            
            // Ensure the user object has the required properties
            if (typeof nextUser === 'string') {
                // If it's just a string, convert to object
                const userObj = { username: nextUser, action: 'block' };
                console.log('🔄 Converted string to object:', userObj);
                nextUser = userObj;
            }
            
            if (!nextUser.username) {
                console.error('❌ Invalid user object, no username found:', nextUser);
                // Try to get username from current URL
                const currentUsername = window.location.pathname.split('/')[1];
                if (currentUsername) {
                    console.log('🔄 Using current username as fallback:', currentUsername);
                    nextUser = { username: currentUsername, action: 'block' };
                } else {
                    console.error('❌ No username available, skipping...');
                    handleNextUser(); // Try next user
                    return;
                }
            }
            
            // Ensure action is set (default to block if not specified)
            if (!nextUser.action) {
                nextUser.action = 'block';
                console.log('🔄 Set default action to block for user:', nextUser.username);
            }
            
            console.log('🎯 Next user action:', nextUser.action);
            
            chrome.storage.local.set({
                'autoBlockQueue': users,
                'autoBlock': nextUser,
                'autoBlockTaskSetAt': Date.now()
            }, function() {
                console.log('💾 Updated storage with next user:', nextUser);
                const actionText = nextUser.action === 'unblock' ? 'unblocking' : 'blocking';
                updateStatus(`Queue: ${users.length} users remaining (${actionText})`, 'info');
                
                // Check if we need to navigate to the user's page
                if (!isOnProfile(nextUser.username)) {
                    const nextUrl = profileUrl(nextUser.username);
                    console.log('🔄 Navigating to user page:', nextUrl);
                    window.location.href = nextUrl;
                } else {
                    console.log('✅ Already on correct user page, starting process...');
                    checkForPostNavigationTask();
                }
            });
                        } else {
                    console.log('✅ No more users in the queue.');
                    displayBlockingStats();
                    updateStatus('Blocking process complete! All users processed.', 'success');
                    chrome.storage.local.remove(['autoBlockQueue', 'autoBlock', 'autoBlockTaskSetAt', 'blockingStats']);
                }
    });
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

/** Try multiple selectors in order; resolve with first match or reject after timeout. */
function waitForAnyElement(selectors, timeout) {
    const intervalTime = 150;
    const endTime = Number(new Date()) + timeout;
    return new Promise((resolve, reject) => {
        const tick = () => {
            if (Number(new Date()) > endTime) {
                reject(new Error("None of [" + selectors.slice(0, 3).join(", ") + "...] found within " + timeout + "ms"));
                return;
            }
            for (let i = 0; i < selectors.length; i++) {
                try {
                    const el = document.querySelector(selectors[i]);
                    if (el) {
                        resolve(el);
                        return;
                    }
                } catch (error) {
                    console.warn('Invalid selector:', selectors[i], error);
                }
            }
            setTimeout(tick, intervalTime);
        };
        tick();
    });
}

// Selectors for block flow (TikTok may change; try data-e2e first, then aria/text)
const MORE_BUTTON_SELECTORS = [
    'button[data-e2e="user-more"]',
    '[data-e2e="user-more"]',
    'button[aria-label="Actions"]',
    '[data-e2e="browse-user-more"]',
    'button[aria-label="More options"]',
    '[aria-label="More options"]'
];
const BLOCK_MENU_OPTION_SELECTORS = [
    'div[role="button"][aria-label="Block"]',
    '[role="button"][aria-label="Block"]',
    '[aria-label="Block"]',
    '[data-e2e="block-option"]'
];
function isShown(el) {
    if (!el || !el.isConnected) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

/** Visible menu row whose label is exactly `label` (for example "block" or "unblock"). */
function findShownMenuItem(label) {
    const want = String(label || '').trim().toLowerCase();
    const nodes = document.querySelectorAll('button, [role="button"]');
    for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i];
        const aria = (el.getAttribute('aria-label') || '').trim().toLowerCase();
        const text = (el.innerText || '').trim().toLowerCase();
        if (aria !== want && text !== want) continue;
        if (!isShown(el)) continue;
        return el;
    }
    return null;
}

/** Fallback: find a visible Block menu item by its own text, not a parent that also contains Report. */
function findBlockOptionByText() {
    return findShownMenuItem('block');
}
const CONFIRM_BLOCK_BUTTON_SELECTORS = [
    'button[data-e2e="block-popup-block-btn"]',
    'button[class*="StyledButtonBlock"]',
    'button[class*="Button-StyledButtonBlock"]',
    '[data-e2e="block-popup-block-btn"]'
];
const BLOCKED_ACCOUNT_USERNAME_SELECTORS = [
    'h3[data-e2e="block-user-username"]',
    '[data-e2e="block-user-username"]'
];
const SELECTOR_STORAGE_KEY = 'tiktokBlockSelectors';

function withCustomSelector(customValue, defaults) {
    const value = String(customValue || '').trim();
    if (!value) return defaults.slice();
    return [value].concat(defaults.filter(function(selector) { return selector !== value; }));
}

function getSelectorLists() {
    return new Promise(function(resolve) {
        chrome.storage.local.get([SELECTOR_STORAGE_KEY], function(result) {
            const custom = result[SELECTOR_STORAGE_KEY] || {};
            resolve({
                more: withCustomSelector(custom.more, MORE_BUTTON_SELECTORS),
                block: withCustomSelector(custom.block, BLOCK_MENU_OPTION_SELECTORS),
                confirm: withCustomSelector(custom.confirm, CONFIRM_BLOCK_BUTTON_SELECTORS),
                blockedAccount: withCustomSelector(custom.blockedAccount, BLOCKED_ACCOUNT_USERNAME_SELECTORS)
            });
        });
    });
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

let activePicker = null;

function stopElementPicker() {
    if (!activePicker) return;
    document.removeEventListener('click', activePicker.onClick, true);
    document.removeEventListener('keydown', activePicker.onKey, true);
    if (activePicker.banner && activePicker.banner.parentNode) {
        activePicker.banner.parentNode.removeChild(activePicker.banner);
    }
    activePicker = null;
}

function startElementPicker(slot) {
    stopElementPicker();
    const labels = { more: 'Actions (⋯) button', block: 'Block menu item', confirm: 'Block confirmation button', blockedAccount: 'blocked-account username' };
    const banner = document.createElement('div');
    banner.id = 'tiktok-autoblocker-picker';
    banner.textContent = 'Click the ' + (labels[slot] || 'target') + ' on this page. Press Esc to cancel.';
    banner.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#111;color:#fff;padding:10px 14px;border-radius:8px;font:14px/1.4 sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.35);';
    (document.body || document.documentElement).appendChild(banner);

    function onClick(event) {
        event.preventDefault();
        event.stopPropagation();
        const selector = selectorForElement(event.target);
        stopElementPicker();
        if (!selector) {
            console.warn('Could not build a selector from that click');
            return;
        }
        chrome.storage.local.get([SELECTOR_STORAGE_KEY], function(result) {
            const custom = result[SELECTOR_STORAGE_KEY] || {};
            custom[slot] = selector;
            chrome.storage.local.set({ [SELECTOR_STORAGE_KEY]: custom }, function() {
                console.log('Saved selector', slot, selector);
            });
        });
    }

    function onKey(event) {
        if (event.key === 'Escape') stopElementPicker();
    }

    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    activePicker = { onClick: onClick, onKey: onKey, banner: banner };
}

function describeSelectorMatches(selectors) {
    return selectors.map(function(selector) {
        let count = 0;
        let error = '';
        try {
            count = document.querySelectorAll(selector).length;
        } catch (err) {
            error = err.message;
        }
        return { selector: selector, count: count, error: error };
    });
}

/** Fallback: find the Block button in a modal by its text. */
function findConfirmBlockByText() {
    const dialogs = document.querySelectorAll('[role="dialog"], [data-e2e*="block-popup"], [class*="Modal"], [class*="modal"]');
    for (let i = 0; i < dialogs.length; i++) {
        const buttons = dialogs[i].querySelectorAll('button, [role="button"]');
        for (let j = 0; j < buttons.length; j++) {
            const b = buttons[j];
            if (b.textContent && b.textContent.trim().toLowerCase() === 'block') return b;
        }
    }
    return null;
}

/**
 * Simulates a mouse event on the specified element.
 * @param {Element} element - The DOM element to target.
 * @param {String} eventType - The type of event ('click', 'mouseover', etc.).
 */
function simulateMouseEvent(element, eventType) {
    if (!element) return;
    console.log('Simulating ' + eventType + ' event in the page');
    document.querySelectorAll('[data-tiktok-autoblocker-target]').forEach(function (node) {
        node.removeAttribute('data-tiktok-autoblocker-target');
    });
    // page-world.js watches this attribute and calls TikTok's React click handler.
    // A content-script click never reaches that handler, so the Block menu never opens.
    element.setAttribute('data-tiktok-autoblocker-target', '1');
}

function findBlockInReportMenu() {
    const root = document.querySelector('[data-e2e="user-report"]');
    if (!root) return null;
    const nodes = root.querySelectorAll('button, [role="button"]');
    for (let i = 0; i < nodes.length; i++) {
        const aria = (nodes[i].getAttribute('aria-label') || '').trim().toLowerCase();
        const text = (nodes[i].innerText || '').trim().toLowerCase();
        if ((aria === 'block' || text === 'block') && isShown(nodes[i])) return nodes[i];
    }
    return null;
}

function waitForMenuAction(timeout) {
    return new Promise(function (resolve) {
        const end = Date.now() + timeout;
        const timer = setInterval(function () {
            const unblock = findShownMenuItem('unblock') || findShownMenuItem('unblock user');
            if (unblock) {
                clearInterval(timer);
                resolve({ type: 'unblock', element: unblock });
                return;
            }
            const block = findShownMenuItem('block') || findBlockInReportMenu();
            if (block) {
                clearInterval(timer);
                resolve({ type: 'block', element: block });
                return;
            }
            if (Date.now() > end) {
                clearInterval(timer);
                resolve(null);
            }
        }, 150);
    });
}

function currentActionsButton(fallback) {
    const buttons = document.querySelectorAll('button[data-e2e="user-more"]');
    for (let i = 0; i < buttons.length; i++) {
        const rect = buttons[i].getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return buttons[i];
    }
    return fallback && fallback.isConnected ? fallback : null;
}

function profileMenuIsOpen() {
    const report = document.querySelector('[data-e2e="user-report"]');
    return !!(report && isShown(report));
}

async function openActionsAndFindBlock(moreButton) {
    for (let attempt = 0; attempt < 4; attempt++) {
        if (!profileMenuIsOpen()) {
            const current = currentActionsButton(moreButton);
            if (!current) {
                await new Promise(function (resolve) { setTimeout(resolve, 500); });
                continue;
            }
            try {
                current.scrollIntoView({ block: 'center', inline: 'nearest' });
            } catch (error) {}
            simulateMouseEvent(current, 'click');
        }
        const action = await waitForMenuAction(2000);
        if (action) return action;
    }
    return null;
}

/** Usernames that are actually error/special paths – never add to block list or treat as profile */
const INVALID_USERNAME_PATHS = new Set(['404', '500', 'error', 'null', 'undefined']);

// Add current profile username to blocklist. Calls done(success, alreadyInList) when finished (so popup can avoid spam/race).
// Keeps @ if present in URL (e.g. /@ai.movie66 → "@ai.movie66") so downloaded list matches user expectation.
function addUserToBlockList(done) {
    const username = (window.location.pathname.split('/')[1] || '').trim();
    const normalized = username.replace(/^@/, '').toLowerCase();
    if (!username || INVALID_USERNAME_PATHS.has(normalized)) {
        console.warn('Cannot add current page to block list (not a valid profile URL).');
        if (done) done(false, false);
        return;
    }
    chrome.storage.local.get([blockListKey], function(result) {
        const blockList = result[blockListKey] || [];
        const norm = function(u) { return (u || '').replace(/^@/, '').toLowerCase(); };
        const already = blockList.some(function(u) { return norm(u) === norm(username); });
        if (!already) {
            blockList.push(username);
            chrome.storage.local.set({ [blockListKey]: blockList });
            console.info(`Added ${username} to block list.`);
            if (done) done(true, false);
        } else {
            console.info(`${username} is already in the block list.`);
            if (done) done(true, true);
        }
    });
}

/**
 * Update blocking statistics
 */
function updateBlockingStats(type) {
    const oldValue = blockingStats[type];
    blockingStats[type]++;
    console.log(`📊 Updated stats - ${type}: ${oldValue} -> ${blockingStats[type]}`);
    
    // Save to storage to persist across page reloads
    chrome.storage.local.set({ blockingStats: blockingStats }, function() {
        console.log('💾 Saved blocking stats to storage');
    });
}

/**
 * Display blocking statistics summary
 */
function displayBlockingStats() {
    console.log('📊 Displaying final blocking statistics:', blockingStats);
    const summary = `Processed: ${blockingStats.total} | Blocked: ${blockingStats.blocked} | Already Blocked: ${blockingStats.alreadyBlocked} | Errors: ${blockingStats.errors} | Skipped: ${blockingStats.skipped}`;
    updateStatus(summary, 'info');
    
    // Show a more detailed toast notification
    const detailMessage = `✅ Process Complete!\n\n📊 Summary:\n• Total: ${blockingStats.total}\n• Successfully Blocked: ${blockingStats.blocked}\n• Already Blocked: ${blockingStats.alreadyBlocked}\n• Errors: ${blockingStats.errors}\n• Skipped: ${blockingStats.skipped}`;
    
    // Send detailed message to popup for toast
    chrome.runtime.sendMessage({
        action: 'showDetailedToast',
        message: detailMessage,
        type: 'success'
    });
    
    console.log('📊 Final blocking statistics:', blockingStats);
}

/**
 * Reset blocking statistics
 */
function resetBlockingStats() {
    blockingStats = {
        total: 0,
        blocked: 0,
        alreadyBlocked: 0,
        errors: 0,
        skipped: 0
    };
    
    // Clear from storage as well
    chrome.storage.local.remove(['blockingStats'], function() {
        console.log('🗑️ Cleared blocking stats from storage');
    });
    
    console.log('🔄 Reset blocking statistics');
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

function handlesFromNodes(nodes) {
    const names = [];
    nodes.forEach(function(node) {
        const name = (node.textContent || '').replace(/^@/, '').trim();
        if (name && !/[\s/]/.test(name)) names.push(name);
    });
    return names;
}

function handlesInBlockedList(list, selectors) {
    const listSelectors = selectors && selectors.length ? selectors : BLOCKED_ACCOUNT_USERNAME_SELECTORS;
    for (let i = 0; i < listSelectors.length; i++) {
        let nodes = [];
        try {
            nodes = list.querySelectorAll(listSelectors[i]);
        } catch (error) {
            continue;
        }
        const names = handlesFromNodes(nodes);
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

/**
 * Read usernames from the Blocked accounts settings page.
 * Only links inside the list count. Scrolling lets TikTok render the next rows.
 */
async function collectBlockedHandles() {
    const selectorLists = await getSelectorLists();
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

function blockListKeyOf(name) {
    return String(name || '').replace(/^@/, '').trim().toLowerCase();
}

function mergeUsernamesIntoBlockList(usernames, done) {
    chrome.storage.local.get([blockListKey], function(stored) {
        const merged = (stored[blockListKey] || []).slice();
        const seen = new Set(merged.map(blockListKeyOf));
        let added = 0;
        usernames.forEach(function(name) {
            const key = blockListKeyOf(name);
            if (!key || seen.has(key)) return;
            seen.add(key);
            merged.push('@' + String(name).replace(/^@/, '').trim());
            added += 1;
        });
        chrome.storage.local.set({ [blockListKey]: merged }, function() {
            done({
                found: usernames.length,
                added: added,
                total: merged.length
            });
        });
    });
}

/**
 * Check if the current user is already blocked
 * @returns {Promise<boolean>} True if the user is already blocked
 */
async function checkIfAlreadyBlocked() {
    return !!(findShownMenuItem('unblock') || findShownMenuItem('unblock user'));
}

// Add a specific username to blocklist (for use in automation)
function addUsernameToBlockList(username, quiet) {
    chrome.storage.local.get([blockListKey], function(result) {
        const blockList = result[blockListKey] || [];
        if (!blockList.includes(username)) {
            blockList.push(username);
            chrome.storage.local.set({ [blockListKey]: blockList });
            console.info('Added ' + username + ' to block list.');
            if (!quiet) updateStatus('Added ' + username + ' to block list', 'success');
            return true;
        }
        console.info(username + ' is already in the block list.');
        if (!quiet) updateStatus(username + ' is already in block list', 'info');
        return false;
    });
}

// Update the status indicator
function updateStatus(message, type = 'info') {
    // Send message to popup to update status
    chrome.runtime.sendMessage({
        action: 'updateStatus',
        message: message,
        type: type
    });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'ping') {
        sendResponse({ ok: true });
        return false;
    } else if (request.action === 'getSelectors') {
        chrome.storage.local.get([SELECTOR_STORAGE_KEY], function(result) {
            sendResponse({ selectors: result[SELECTOR_STORAGE_KEY] || {} });
        });
        return true;
    } else if (request.action === 'saveSelectors') {
        const incoming = request.selectors || {};
        const selectors = {
            more: String(incoming.more || '').trim(),
            block: String(incoming.block || '').trim(),
            confirm: String(incoming.confirm || '').trim(),
            blockedAccount: String(incoming.blockedAccount || '').trim()
        };
        chrome.storage.local.set({ [SELECTOR_STORAGE_KEY]: selectors }, function() {
            sendResponse({ success: !chrome.runtime.lastError, selectors: selectors });
        });
        return true;
    } else if (request.action === 'testSelectors') {
        getSelectorLists().then(function(lists) {
            sendResponse({
                success: true,
                more: describeSelectorMatches(lists.more),
                block: describeSelectorMatches(lists.block),
                confirm: describeSelectorMatches(lists.confirm),
                blockedAccount: describeSelectorMatches(lists.blockedAccount)
            });
        });
        return true;
    } else if (request.action === 'pickElement') {
        startElementPicker(request.slot);
        sendResponse({ success: true });
        return false;
    } else if (request.action === 'addCurrentUser') {
        addUserToBlockList(function(success, alreadyInList) {
            sendResponse({ success: success, alreadyInList: !!alreadyInList });
        });
        return true; // keep channel open for async sendResponse
    } else if (request.action === 'downloadBlockList') {
        chrome.storage.local.get([blockListKey], function(result) {
            const blockList = result[blockListKey] || [];
            sendResponse({blockList: blockList});
        });
        return true; // Keep message channel open for async response
    } else if (request.action === 'uploadBlockList') {
        console.log('📁 Upload block list request received:', request);
        console.log('📋 Usernames to process:', request.usernames);
        console.log('🎯 Mode:', request.mode || 'block');
        
        // Clear any existing stuck tasks first
        chrome.storage.local.remove(['autoBlock'], function() {
            console.log('🗑️ Cleared any existing auto block task');
            
            // Reset blocking statistics for new session
            resetBlockingStats();
            
            const usernames = request.usernames.map(username => ({
                username: username.trim(), 
                action: 'block' // Always use block mode for now
                // action: request.mode === 'unblock' ? 'unblock' : 'block'
            }));
            console.log('🔄 Processed usernames:', usernames);
            
            // Set total count for statistics
            blockingStats.total = usernames.length;
            
            chrome.storage.local.set({autoBlockQueue: usernames}, function() {
                console.log('💾 Block queue saved to storage');
                const actionText = 'blocking'; // Always blocking for now
                // const actionText = request.mode === 'unblock' ? 'unblocking' : 'blocking';
                updateStatus(`Loaded ${usernames.length} usernames for ${actionText}`, 'info');
                console.log('🚀 Starting process...');
                handleNextUser();
            });
        });
        
        sendResponse({success: true});
    } else if (request.action === 'analyzePage') {
        // Debug function to analyze page structure
        analyzePageStructure();
        sendResponse({success: true});
    } else if (request.action === 'testBlocking') {
        // Test the blocking process step by step
        testBlockingProcess();
        sendResponse({success: true});
    } else if (request.action === 'exportDebugLog') {
        // Export debug log to file
        exportDebugLog();
        sendResponse({success: true});
    } else if (request.action === 'clearDebugLog') {
        // Clear debug log
        clearDebugLog();
        sendResponse({success: true});
    } else if (request.action === 'clearStuckTasks') {
        // Clear stuck tasks
        chrome.storage.local.remove(['autoBlock', 'autoBlockQueue', 'autoBlockTaskSetAt'], function() {
            console.log('🗑️ Cleared stuck tasks and queue');
            sendResponse({success: true});
        });
        return true; // Keep message channel open for async response
    } else if (request.action === 'clearBlockList') {
        // Clear the entire block list
        chrome.storage.local.remove([blockListKey], function() {
            console.log('🗑️ Block list cleared');
            sendResponse({success: true});
        });
        return true; // Keep message channel open for async response
    } else if (request.action === 'importBlockedAccounts') {
        collectBlockedHandles().then(function(result) {
            if (!result.ok) {
                sendResponse({ success: false, reason: result.reason });
                return;
            }
            mergeUsernamesIntoBlockList(result.usernames, function(summary) {
                sendResponse({ success: true, found: summary.found, added: summary.added, total: summary.total });
            });
        });
        return true;
    }
});

/**
 * Analyze the current page structure for debugging
 */
function analyzePageStructure() {
    console.log('=== PAGE STRUCTURE ANALYSIS ===');
    
    // Analyze all buttons
    console.log('--- ALL BUTTONS ---');
    const buttons = document.querySelectorAll('button');
    buttons.forEach((btn, index) => {
        console.log(`Button ${index}:`, {
            text: btn.textContent?.trim(),
            ariaLabel: btn.getAttribute('aria-label'),
            dataE2e: btn.getAttribute('data-e2e'),
            className: btn.className,
            id: btn.id,
            title: btn.getAttribute('title')
        });
    });
    
    // Analyze all elements with data-e2e attributes
    console.log('--- ELEMENTS WITH DATA-E2E ---');
    const e2eElements = document.querySelectorAll('[data-e2e]');
    e2eElements.forEach((el, index) => {
        console.log(`E2E Element ${index}:`, {
            tag: el.tagName,
            dataE2e: el.getAttribute('data-e2e'),
            text: el.textContent?.trim(),
            className: el.className
        });
    });
    
    // Look for private account indicators
    console.log('--- PRIVATE ACCOUNT CHECK ---');
    const pageText = document.body.textContent.toLowerCase();
    const privateKeywords = ['private', 'account is private', 'this account is private'];
    privateKeywords.forEach(keyword => {
        if (pageText.includes(keyword)) {
            console.log(`Found private keyword: "${keyword}"`);
        }
    });
    
    // Look for block-related elements
    console.log('--- BLOCK-RELATED ELEMENTS ---');
    const blockElements = document.querySelectorAll('[data-e2e*="block"], [aria-label*="block"], [aria-label*="Block"]');
    blockElements.forEach((el, index) => {
        console.log(`Block Element ${index}:`, {
            tag: el.tagName,
            dataE2e: el.getAttribute('data-e2e'),
            ariaLabel: el.getAttribute('aria-label'),
            text: el.textContent?.trim()
        });
    });
} 

/**
 * Test the blocking process step by step
 */
async function testBlockingProcess() {
    console.log('=== TESTING BLOCKING PROCESS ===');
    
    // Step 1: Check if we're on a profile page
    const userTitle = document.querySelector('[data-e2e="user-title"]');
    if (userTitle) {
        console.log('✅ Found user title:', userTitle.textContent);
    } else {
        console.log('❌ No user title found - not on a profile page');
        return;
    }
    
    // Step 2: Check for private account
    const isPrivate = await checkIfPrivateAccount();
    console.log('Private account detected:', isPrivate);
    
    // Step 3: Find the more options button
    const moreButton = document.querySelector('[data-e2e="user-more"]');
    if (moreButton) {
        console.log('✅ Found more options button:', moreButton);
        console.log('Button attributes:', {
            ariaLabel: moreButton.getAttribute('aria-label'),
            className: moreButton.className,
            text: moreButton.textContent
        });
        
        // Step 4: Simulate click on more button
        console.log('🔄 Clicking more options button...');
        simulateMouseEvent(moreButton, 'click');
        
        // Step 5: Wait and look for block options
        setTimeout(async () => {
            console.log('🔍 Looking for block options after clicking more...');
            
            // Look for any new buttons that appeared
            const allButtons = document.querySelectorAll('button');
            console.log('All buttons after clicking more:', allButtons.length);
            
            // Check if any buttons changed or appeared
            allButtons.forEach((btn, index) => {
                const text = btn.textContent?.trim();
                const ariaLabel = btn.getAttribute('aria-label');
                const dataE2e = btn.getAttribute('data-e2e');
                
                // Look for any block-related buttons
                if (text?.toLowerCase().includes('block') || ariaLabel?.toLowerCase().includes('block') || dataE2e?.toLowerCase().includes('block')) {
                    console.log(`✅ Found potential block button ${index}:`, {
                        text: text,
                        ariaLabel: ariaLabel,
                        dataE2e: dataE2e,
                        className: btn.className
                    });
                }
                
                            // Look for any buttons that might be menu items
            if (text && (text.toLowerCase().includes('report') || text.toLowerCase().includes('block') || text.toLowerCase().includes('unfollow'))) {
                console.log(`🔍 Found potential action button ${index}:`, {
                    text: text,
                    ariaLabel: ariaLabel,
                    dataE2e: dataE2e
                });
                
                // If we found a block button, try clicking it
                if (text.toLowerCase().includes('block')) {
                    console.log(`🎯 Found Block button! Attempting to click...`);
                    try {
                        simulateMouseEvent(btn, 'click');
                        console.log(`✅ Clicked Block button`);
                    } catch (error) {
                        console.log(`❌ Failed to click Block button:`, error);
                    }
                }
            }
            });
            
            // Look for dropdown/menu items with more specific selectors
            const menuSelectors = [
                '[role="menuitem"]',
                '[role="option"]',
                '.menu-item',
                '.dropdown-item',
                '[data-e2e*="menu"]',
                '[data-e2e*="dropdown"]',
                '.popup-menu',
                '.dropdown-menu',
                '[aria-haspopup="true"]'
            ];
            
            let totalMenuItems = 0;
            menuSelectors.forEach(selector => {
                const items = document.querySelectorAll(selector);
                if (items.length > 0) {
                    console.log(`Menu items with selector "${selector}":`, items.length);
                    items.forEach((item, index) => {
                        console.log(`  Menu item ${index}:`, {
                            text: item.textContent?.trim(),
                            ariaLabel: item.getAttribute('aria-label'),
                            role: item.getAttribute('role'),
                            dataE2e: item.getAttribute('data-e2e')
                        });
                        totalMenuItems++;
                    });
                }
            });
            
            console.log(`Total menu items found: ${totalMenuItems}`);
            
            // Check if any popups or overlays appeared
            const popups = document.querySelectorAll('[role="dialog"], .popup, .overlay, .modal');
            console.log('Popups/overlays found:', popups.length);
            popups.forEach((popup, index) => {
                console.log(`Popup ${index}:`, {
                    text: popup.textContent?.trim(),
                    role: popup.getAttribute('role'),
                    className: popup.className
                });
            });
            
        }, 3000); // Increased timeout to 3 seconds
        
    } else {
        console.log('❌ More options button not found');
    }
}

})();