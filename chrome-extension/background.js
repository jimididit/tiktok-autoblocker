// TikTok AutoBlocker Background Service Worker
// Handles extension lifecycle and background tasks

console.log('TikTok AutoBlocker Background Service Worker Loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason === 'install') {
        console.log('TikTok AutoBlocker installed');
        
        // Initialize storage with default values
        chrome.storage.local.set({
            tiktokBlockList: [],
            autoBlockQueue: [],
            autoBlock: null
        });
        
        // Open welcome page or show notification
        chrome.tabs.create({
            url: 'https://github.com/jimididit/tiktok-autoblocker'
        });
    } else if (details.reason === 'update') {
        console.log('TikTok AutoBlocker updated');
        
        // Check if we need to migrate data from old version
        chrome.storage.local.get(['tiktokBlockList'], function(result) {
            if (!result.tiktokBlockList) {
                // Initialize if not exists
                chrome.storage.local.set({
                    tiktokBlockList: []
                });
            }
        });
    }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'updateStatus') {
        // Forward status updates to popup if it's open
        chrome.runtime.sendMessage(request);
    }
    
    // Always return true for async responses
    return true;
});

// Handle tab updates to inject content script when needed
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('tiktok.com')) {
        // Ensure content script is injected
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        }).catch(error => {
            console.log('Content script already injected or failed to inject:', error);
        });
    }
});

// Handle extension icon click
chrome.action.onClicked.addListener(function(tab) {
    if (tab.url && tab.url.includes('tiktok.com')) {
        // Open popup or perform action
        console.log('Extension icon clicked on TikTok page');
    }
}); 