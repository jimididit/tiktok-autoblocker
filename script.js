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
            console.error('No more options button found!!')
        }

        // Move on to the next user in the queue.
        handleNextUser();
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
            checkForPostNavigationTask();
        } else {
            console.log('No more users in the queue.');
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
        addButton(card, 'Download Block List', downloadBlock List);
        createFileInput(card);
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

    // Handle the upload of a file and process the included usernames.
    async function handleFileUpload(event) {
        const file = event.target.files[0];
        const text = await file.text();
        const usernames = text.split(/\r?\n/).filter(u => u.trim() !== '').map(username => ({username: username.trim(), action: 'block'}));
        localStorage.setItem('autoBlockQueue', JSON.stringify(usernames));
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
            alert(`Added ${username} to block list.`);
        } else {
            alert(`${username} is already in the block list.`);
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
