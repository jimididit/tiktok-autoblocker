// ==UserScript==
// @name         tiktok-autoblocker
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Collect TikTok usernames to block and download them as a .txt file.
// @author       jimididit
// @match        *://*.tiktok.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

// Use of an Immediately Invoked Function Expression (IIFE) to avoid polluting the global scope.
(function() {
    'use strict';  // Enforcing stricter parsing and error handling in the script.

    // Key to access TikTok block list in localStorage.
    const blockListKey = 'tiktokBlockList';
    console.log('Running Autoblock and Blocklist Creator Script');

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
            updateStatus(`Account ${task.username} not accessible - added to blocklist`, 'warning');
            // Add to block list anyway and move to next user
            addUsernameToBlockList(task.username);
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
                '.user-info .private'
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

            // Check for "User not found" or "Account not found" text
            const pageText = document.body.textContent.toLowerCase();
            if (pageText.includes('user not found') || 
                pageText.includes('account not found') ||
                pageText.includes('this user doesn\'t exist') ||
                pageText.includes('couldn\'t find this account')) {
                console.info('Account not found text found in page content');
                return false;
            }

            // Check if we're on a valid TikTok profile page
            const profileIndicators = [
                '[data-e2e="user-info"]',
                '.user-info',
                '[data-e2e="user-avatar"]',
                '.user-avatar'
            ];

            for (const selector of profileIndicators) {
                const element = document.querySelector(selector);
                if (element) {
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error('Error checking if account is accessible:', error);
            return false;
        }
    }

    /**
     * Handle blocking for private accounts
     */
    async function handlePrivateAccountBlocking() {
        try {
            // Method 1: Try to find the more options button with different selectors
            const alternativeSelectors = [
                '[data-e2e="user-more"]',
                '[data-e2e="more-options"]',
                '.more-options',
                '.user-actions button',
                '[aria-label="More options"]',
                '[aria-label="More"]'
            ];

            let moreButton = null;
            for (const selector of alternativeSelectors) {
                try {
                    moreButton = await waitForElement(selector, 2000);
                    if (moreButton) {
                        console.info('Found more options button with selector:', selector);
                        break;
                    }
                } catch (error) {
                    console.log(`Selector ${selector} not found, trying next...`);
                }
            }

            if (moreButton) {
                simulateMouseEvent(moreButton, 'mouseover');
                console.info('More options button clicked for private account...');
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Try to find block button with various selectors
                const blockSelectors = [
                    '[aria-label="Block"]',
                    '[data-e2e="block-user"]',
                    '.block-user',
                    'button:contains("Block")',
                    '[data-e2e="block-popup-block-btn"]'
                ];

                let blockButton = null;
                for (const selector of blockSelectors) {
                    try {
                        blockButton = await waitForElement(selector, 2000);
                        if (blockButton) {
                            console.info('Found block button with selector:', selector);
                            break;
                        }
                    } catch (error) {
                        console.log(`Block selector ${selector} not found, trying next...`);
                    }
                }

                if (blockButton) {
                    simulateMouseEvent(blockButton, 'click');
                    console.info('Block button clicked for private account...');
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // Try to confirm the block
                    const confirmSelectors = [
                        'button[data-e2e="block-popup-block-btn"]',
                        '[data-e2e="confirm-block"]',
                        '.confirm-block',
                        'button:contains("Block")',
                        'button:contains("Confirm")'
                    ];

                    let confirmButton = null;
                    for (const selector of confirmSelectors) {
                        try {
                            confirmButton = await waitForElement(selector, 2000);
                            if (confirmButton) {
                                console.info('Found confirm button with selector:', selector);
                                break;
                            }
                        } catch (error) {
                            console.log(`Confirm selector ${selector} not found, trying next...`);
                        }
                    }

                    if (confirmButton) {
                        simulateMouseEvent(confirmButton, 'click');
                        console.info('Block confirmed for private account...');
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } else {
                        console.warn('Could not find confirm button for private account');
                    }
                } else {
                    console.warn('Could not find block button for private account');
                }
            } else {
                console.warn('Could not find more options button for private account');
                // Add to block list anyway since we can't block them directly
                const username = window.location.pathname.split('/')[1];
                addUsernameToBlockList(username);
            }
        } catch (error) {
            console.error('Error handling private account blocking:', error);
            // Add to block list as fallback
            const username = window.location.pathname.split('/')[1];
            addUsernameToBlockList(username);
        }
    }

    /**
     * Handle blocking for public accounts (original method)
     */
    async function handlePublicAccountBlocking() {
        try {
            // Wait for the "more options" button and interact with it.
            const moreButton = await waitForElement('[data-e2e="user-more"]', 5000);
            if (moreButton) {
                simulateMouseEvent(moreButton, 'mouseover');
                console.info('User-more button found, showing more options...');
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Try to click the "Block" button once it appears.
                const blockButton = await waitForElement('[aria-label="Block"]', 1000);
                if (blockButton) {
                    simulateMouseEvent(blockButton, 'click');
                    console.info('Block button clicked...');
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // Find and click the confirmation button in the popup.
                    const confirmButton = await waitForElement('button[data-e2e="block-popup-block-btn"]', 1000);
                    if (confirmButton) {
                        simulateMouseEvent(confirmButton, 'click');
                        console.info('Block confirmed...');
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            } else {
                console.error('No more options button found for public account!');
                // Add to block list as fallback
                const username = window.location.pathname.split('/')[1];
                addUsernameToBlockList(username);
            }
        } catch (error) {
            console.error('Error handling public account blocking:', error);
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
            console.log('No more users in the queue.');
            updateStatus('Blocking complete!', 'success');
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
        const card = createCard('Block List Manager');
        addButton(card, 'Add User to Block List', addUserToBlockList);
        addButton(card, 'Download Block List', downloadBlockList);
        createFileInput(card);
        createStatusIndicator(card);
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
        handleNextUser();
    }

    // Create the main UI card that hosts all UI elements.
    function createCard(cardTitle) {
        const card = document.createElement('div');
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

        document.body.appendChild(card);
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
    init();
})();
