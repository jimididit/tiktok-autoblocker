// ==UserScript==
// @name         TikTok BlockList Creator & AutoBlocker :)
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

    const blockListKey = 'tiktokAutoBlockList';
    console.log('Running Autoblock and Blocklist Creator Script');

    checkForPostNavigationTask();

    function checkForPostNavigationTask() {
        const task = JSON.parse(localStorage.getItem('autoBlock'));
        if (task && window.location.href.includes(`https://www.tiktok.com/${task.username}`)) {
            performBlockOperation(task.username);
            localStorage.removeItem('autoBlock');
        }
    }

    async function performBlockOperation(username) {
        console.log('User Blocking Init');

        const moreButton = await waitForElement('[data-e2e="user-more"]', 10000);
        if (moreButton) {
            simulateMouseEvent(moreButton, 'mouseover');
            console.info('Got user-more...');
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for UI to update

            const blockButton = await waitForElement('[aria-label="Block"]', 1000);
            if (blockButton) {
                simulateMouseEvent(blockButton, 'click'); // Click to block the user
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for modal to appear
                console.info('Got First Block Button...');
                const confirmButton = await waitForElement('#tux-portal-container button[data-e2e="block-popup-block-btn"]', 1000);
                if (confirmButton) {
                    simulateMouseEvent(confirmButton, 'click'); // Confirm blocking the user
                    console.info('Got Block Confirmation Button...');
                    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for the block to be processed
                }
            }
        } else {
            console.error('No user-more button found!!')
        }
    }

    function createCard(cardTitle) {
        const card = document.createElement('div');
        card.style.position = 'fixed';
        card.style.top = '175px';
        card.style.right = '20px';
        card.style.width = '200px';
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
        if (!file) return;

        const text = await file.text();
        const usernames = text.split(/\r?\n/);
        for (let username of usernames) {
            if (username.trim()) {
                localStorage.setItem('autoBlock', JSON.stringify({username: username.trim(), action: 'block'}));
                window.location.href = `https://www.tiktok.com/${username.trim()}`;
                break; // Break after setting up the first redirection
            }
        }
    }

    function addButtonFunctionality(card) {
        addButton(card, 'Add to Block List', addUserToBlockList);
        addButton(card, 'Download Block List', downloadBlockList);
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
        const blob = new Blob([blockList.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tiktok-block-list.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function waitForElement(selector, timeout) {
        return new Promise((resolve, reject) => {
            const intervalTime = 100; // Check every 100 ms
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
        console.log('Simulating Hover Event');
        const mouseOverEvent = new MouseEvent(`${eventType}`, {
            view: window,
            bubbles: true,
            cancelable: true
        });
        element.dispatchEvent(mouseOverEvent);
        console.log(`${eventType.toUpperCase()} Complete: ${mouseOverEvent}`);
    }

    function init() {
        const card = createCard('Let <em><b>Them</b></em> Eat Shit!');
        addButtonFunctionality(card);
        createFileInput(card);
    }

    init();
})();
