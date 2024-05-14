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

(function() {
    'use strict';

    const blockListKey = 'tiktokBlockList';
    console.log('Running Autoblock and Blocklist Creator Script');
    checkForPostNavigationTask();

    function checkForPostNavigationTask() {
        const task = JSON.parse(localStorage.getItem('autoBlock'));
        if (task) {
            performBlockOperation(task);
        }
    }

    async function performBlockOperation(task) {
        if (!window.location.href.includes(`https://www.tiktok.com/${task.username}`)) {
            window.location.href = `https://www.tiktok.com/${task.username}`;
            return;
        }

        console.log('User Blocking Init');

        const moreButton = await waitForElement('[data-e2e="user-more"]', 5000);
        if (moreButton) {
            simulateMouseEvent(moreButton, 'mouseover');
            console.info('User-more button found, showing more options...');
            await new Promise(resolve => setTimeout(resolve, 1000));

            const blockButton = await waitForElement('[aria-label="Block"]', 1000);
            if (blockButton) {
                simulateMouseEvent(blockButton, 'click');
                console.info('Block button clicked...');
                await new Promise(resolve => setTimeout(resolve, 1000));

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
        handleNextUser();
    }

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

    function init() {
        const card = createCard('Block List Manager');
        addButton(card, 'Add User to Block List', addUserToBlockList);
        addButton(card, 'Download Block List', downloadBlockList);
        // const filenameInput = createFilenameInput(card);
        createFileInput(card);
    }

    function addButtonFunctionality(card) {
        addButton(card, 'Add to Block List', addUserToBlockList);
        addButton(card, 'Download Block List', downloadBlockList);
    }

    function createFileInput(card) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.style.width = '100%';
        fileInput.style.marginTop = '10px';
        fileInput.onchange = handleFileUpload;
        card.appendChild(fileInput);
    }

    async function handleFileUpload(event) {
        const file = event.target.files[0];
        const text = await file.text();
        const usernames = text.split(/\r?\n/).filter(u => u.trim() !== '').map(username => ({username: username.trim(), action: 'block'}));
        localStorage.setItem('autoBlockQueue', JSON.stringify(usernames));
        handleNextUser();
    }

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

    function createFilenameInput(card) {
        // Divider
        const divider = document.createElement('hr');
        divider.style.marginTop = '10px';
        divider.style.marginBottom = '10px';
        card.appendChild(divider);

        const filenameLabel = document.createElement('label');
        filenameLabel.textContent = 'Blocklist name:';
        filenameLabel.style.display = 'block';
        filenameLabel.style.marginBottom = '5px';
        filenameLabel.style.marginTop = '5px';
        filenameLabel.style.color = '#333';
        card.appendChild(filenameLabel);
    }


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

    init();
})();
