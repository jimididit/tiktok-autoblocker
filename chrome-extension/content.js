// TikTok AutoBlocker Content Script
// This script runs on TikTok pages and handles the blocking functionality

// Prevent multiple executions of this script
if (window.tiktokAutoBlockerLoaded) {
    console.log('TikTok AutoBlocker already loaded, skipping...');
    // Exit early to prevent re-execution
    throw new Error('TikTok AutoBlocker already loaded');
}

// Mark as loaded to prevent re-execution
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

/**
 * Checks for tasks that should continue after page navigation.
 * This typically involves continuing a blocking process that was interrupted by a page load.
 */
function checkForPostNavigationTask() {
    console.log('🔍 Checking for post-navigation tasks...');
    chrome.storage.local.get(['autoBlock'], function(result) {
        console.log('📋 Auto block task found:', result.autoBlock);
        console.log('📊 Task type:', typeof result.autoBlock);
        console.log('📊 Task stringified:', JSON.stringify(result.autoBlock));
        
        if (result.autoBlock && result.autoBlock.username) {
            console.log('🚀 Starting block operation for:', result.autoBlock);
            performBlockOperation(result.autoBlock);
        } else {
            console.log('❌ No valid auto block task found');
            console.log('🔍 Checking if we need to start a new task...');
            
            // Check if there are users in the queue
            chrome.storage.local.get(['autoBlockQueue'], function(queueResult) {
                const queue = queueResult.autoBlockQueue || [];
                console.log('📋 Queue found:', queue);
                console.log('📊 Queue length:', queue.length);
                
                if (queue.length > 0) {
                    console.log('🚀 Starting new task from queue...');
                    handleNextUser();
                } else {
                    console.log('❌ No users in queue, nothing to do');
                }
            });
        }
    });
}

/**
 * Perform blocking or unblocking operation based on the task details.
 * @param {Object} task - Task information including the username and action.
 */
async function performBlockOperation(task) {
    console.log('🚀 performBlockOperation started for task:', task);
    
    // Task name check to protect against a recursive block check/refresh loop
    if(task.username == "@N/A"){
        chrome.storage.local.remove(['autoBlock'], function() {
            console.log('🗑️ Removed @N/A task from storage');
            handleNextUser(); // Force another check to ensure the queue continues if @N/A is found part way through
        });
        return;
    }
    
    // Check if the current location is the correct user page, if not redirect.
    if (!window.location.href.includes(`https://www.tiktok.com/${task.username}`)) {
        console.log('🔄 Redirecting to user page:', `https://www.tiktok.com/${task.username}`);
        window.location.href = `https://www.tiktok.com/${task.username}`;
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
        // Skip this user and move to next
        handleNextUser();
        return;
    }

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
            await handlePrivateAccountBlocking();
        // }
    } else {
        updateStatus(`Processing public account: ${task.username}`, 'info');
        // Unblock functionality temporarily disabled
        // if (task.action === 'unblock') {
        //     await handlePublicAccountUnblocking();
        // } else {
            await handlePublicAccountBlocking();
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
                'autoBlock': nextUser
            }, function() {
                console.log('💾 Updated storage with next user:', nextUser);
                const actionText = nextUser.action === 'unblock' ? 'unblocking' : 'blocking';
                updateStatus(`Queue: ${users.length} users remaining (${actionText})`, 'info');
                
                // Check if we need to navigate to the user's page
                const currentUsername = window.location.pathname.split('/')[1];
                if (currentUsername !== nextUser.username) {
                    console.log('🔄 Navigating to user page:', `https://www.tiktok.com/${nextUser.username}`);
                    window.location.href = `https://www.tiktok.com/${nextUser.username}`;
                } else {
                    console.log('✅ Already on correct user page, starting process...');
                    checkForPostNavigationTask();
                }
            });
        } else {
            console.log('✅ No more users in the queue.');
            updateStatus('Process complete!', 'success');
            chrome.storage.local.remove(['autoBlockQueue', 'autoBlock']);
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

// Add current profile username to blocklist
function addUserToBlockList() {
    const username = window.location.pathname.split('/')[1];
    chrome.storage.local.get([blockListKey], function(result) {
        const blockList = result[blockListKey] || [];
        if (!blockList.includes(username)) {
            blockList.push(username);
            chrome.storage.local.set({ [blockListKey]: blockList });
            console.info(`Added ${username} to block list.`);
        } else {
            console.info(`${username} is already in the block list.`);
        }
    });
}

// Add a specific username to blocklist (for use in automation)
function addUsernameToBlockList(username) {
    chrome.storage.local.get([blockListKey], function(result) {
        const blockList = result[blockListKey] || [];
        if (!blockList.includes(username)) {
            blockList.push(username);
            chrome.storage.local.set({ [blockListKey]: blockList });
            console.info(`Added ${username} to block list.`);
            return true;
        } else {
            console.info(`${username} is already in the block list.`);
            return false;
        }
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
    if (request.action === 'addCurrentUser') {
        addUserToBlockList();
        sendResponse({success: true});
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
            
            const usernames = request.usernames.map(username => ({
                username: username.trim(), 
                action: 'block' // Always use block mode for now
                // action: request.mode === 'unblock' ? 'unblock' : 'block'
            }));
            console.log('🔄 Processed usernames:', usernames);
            
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
        chrome.storage.local.remove(['autoBlock', 'autoBlockQueue'], function() {
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