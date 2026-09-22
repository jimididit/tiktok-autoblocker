// TikTok AutoBlocker Background Service Worker
// Handles extension lifecycle, badge count, and background tasks
'use strict';

console.log('TikTok AutoBlocker Background Service Worker Loaded');

function remainingBlockCount(queue, task) {
    const queued = Array.isArray(queue) ? queue.length : 0;
    const current = (task && task.username) ? 1 : 0;
    return queued + current;
}

function refreshActionBadge() {
    chrome.storage.local.get(['autoBlockQueue', 'autoBlock', 'autoBlockPaused'], function(result) {
        const remaining = remainingBlockCount(result.autoBlockQueue || [], result.autoBlock);
        const paused = !!result.autoBlockPaused;
        const text = remaining > 0 ? (remaining > 999 ? '999+' : String(remaining)) : '';
        chrome.action.setBadgeText({ text: text });
        chrome.action.setBadgeBackgroundColor({ color: paused ? '#64748b' : '#ff4757' });
        chrome.action.setTitle({
            title: remaining > 0
                ? ('TikTok AutoBlocker - ' + remaining + ' left' + (paused ? ' (paused)' : ''))
                : 'TikTok AutoBlocker'
        });
    });
}

chrome.storage.onChanged.addListener(function(changes, area) {
    if (area !== 'local') return;
    if (changes.autoBlockQueue || changes.autoBlock || changes.autoBlockPaused) {
        refreshActionBadge();
    }
});

chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason === 'install') {
        console.log('TikTok AutoBlocker installed');
        chrome.storage.local.set({
            tiktokBlockList: [],
            autoBlockQueue: [],
            autoBlock: null,
            autoBlockPaused: false
        });
        chrome.tabs.create({
            url: 'https://github.com/jimididit/tiktok-autoblocker'
        });
    } else if (details.reason === 'update') {
        console.log('TikTok AutoBlocker updated');
        chrome.storage.local.get(['tiktokBlockList'], function(result) {
            if (!result.tiktokBlockList) {
                chrome.storage.local.set({ tiktokBlockList: [] });
            }
        });
    }
    refreshActionBadge();
});

chrome.runtime.onStartup.addListener(function() {
    refreshActionBadge();
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request && request.action === 'refreshBadge') {
        refreshActionBadge();
        sendResponse({ ok: true });
        return false;
    }
    return true;
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('tiktok.com')) {
        console.log('TikTok page loaded, content script should be active');
    }
});

refreshActionBadge();
