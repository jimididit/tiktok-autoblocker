// TikTok AutoBlocker Popup Script
// Handles user interactions and communicates with content script
'use strict';

// ===== DEVELOPER SETTINGS =====
// Set this to true to enable debug features (only for developers with source code)
const DEBUG_MODE_ENABLED = false;
// =============================

document.addEventListener('DOMContentLoaded', function() {
    // Initialize popup
    loadBlockListStats();
    initializeDebugFeatures();
    
    // Add event listeners
    document.getElementById('addCurrentUser').addEventListener('click', addCurrentUser);
    document.getElementById('downloadBlockList').addEventListener('click', downloadBlockList);
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    document.getElementById('helpBlockList').addEventListener('click', showBlockListHelp);
    document.getElementById('importBlockedAccounts').addEventListener('click', importBlockedAccounts);
    document.getElementById('saveSelectors').addEventListener('click', saveSelectors);
    document.getElementById('testSelectors').addEventListener('click', testSelectors);
    document.getElementById('resetSelectors').addEventListener('click', resetSelectors);
    document.getElementById('pickMore').addEventListener('click', function() { pickSelector('more'); });
    document.getElementById('pickBlock').addEventListener('click', function() { pickSelector('block'); });
    document.getElementById('pickConfirm').addEventListener('click', function() { pickSelector('confirm'); });
    loadSelectors();
    
    // Add debug event listeners only if debug mode is enabled
    if (DEBUG_MODE_ENABLED) {
        document.getElementById('debugPage').addEventListener('click', debugPageStructure);
        document.getElementById('testBlocking').addEventListener('click', testBlockingProcess);
        document.getElementById('exportDebug').addEventListener('click', exportDebugLog);
        document.getElementById('clearDebug').addEventListener('click', clearDebugLog);
        document.getElementById('clearTasks').addEventListener('click', clearStuckTasks);
    }
    
    // Listen for status updates from content script
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'updateStatus') {
            updateStatus(request.message, request.type);
        } else if (request.action === 'showDetailedToast') {
            showToast(request.message, request.type, 8000); // Show for 8 seconds
        }
    });
    
    // Add keyboard shortcut for debug mode (Ctrl+Shift+D)
    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.shiftKey && event.key === 'D') {
            event.preventDefault();
            const debugModeToggle = document.getElementById('debugModeToggle');
            debugModeToggle.checked = !debugModeToggle.checked;
            toggleDebugMode();
        }
    });
});

/** Message shown when content script isn't loaded (e.g. tab opened before extension) */
var CONTENT_SCRIPT_MISSING_MSG = 'Extension couldn\'t connect to the TikTok tab. Refresh the TikTok page (F5), then try again.';

/**
 * Ensure content script is running in the tab (inject if needed), then run callback.
 * Fixes "Receiving end does not exist" when the tab was opened before the extension was enabled.
 * We always run callback even if injection reports an error (e.g. script already loaded and threw).
 */
function withContentScript(tabId, callback) {
    chrome.tabs.sendMessage(tabId, { action: 'ping' }, function(response) {
        if (!chrome.runtime.lastError && response && response.ok) {
            callback();
            return;
        }
        chrome.scripting.executeScript(
            { target: { tabId: tabId }, files: ['page-world.js'], world: 'MAIN' },
            function () {
                chrome.scripting.executeScript(
                    { target: { tabId: tabId }, files: ['content.js'] },
                    function () {
                        setTimeout(callback, 80);
                    }
                );
            }
        );
    });
}

function selectorFields() {
    return {
        more: document.getElementById('selectorMore').value.trim(),
        block: document.getElementById('selectorBlock').value.trim(),
        confirm: document.getElementById('selectorConfirm').value.trim()
    };
}

function fillSelectorFields(selectors) {
    document.getElementById('selectorMore').value = (selectors && selectors.more) || '';
    document.getElementById('selectorBlock').value = (selectors && selectors.block) || '';
    document.getElementById('selectorConfirm').value = (selectors && selectors.confirm) || '';
}

function loadSelectors() {
    chrome.storage.local.get(['tiktokBlockSelectors'], function(result) {
        fillSelectorFields(result.tiktokBlockSelectors || {});
    });
}

function saveSelectors() {
    const selectors = selectorFields();
    chrome.storage.local.set({ tiktokBlockSelectors: selectors }, function() {
        if (chrome.runtime.lastError) {
            updateStatus('Could not save selectors.', 'error');
            return;
        }
        updateStatus('Selectors saved.', 'success');
    });
}

function resetSelectors() {
    fillSelectorFields({});
    chrome.storage.local.remove(['tiktokBlockSelectors'], function() {
        updateStatus('Using built-in selectors.', 'success');
    });
}

function activeTikTokTab(callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const currentTab = tabs[0];
        if (!currentTab || !currentTab.url || currentTab.url.indexOf('tiktok.com') === -1) {
            updateStatus('Open a TikTok profile page first.', 'warning');
            return;
        }
        callback(currentTab);
    });
}

function testSelectors() {
    activeTikTokTab(function(currentTab) {
        withContentScript(currentTab.id, function() {
            chrome.tabs.sendMessage(currentTab.id, { action: 'testSelectors' }, function(response) {
                if (chrome.runtime.lastError || !response || !response.success) {
                    updateStatus(CONTENT_SCRIPT_MISSING_MSG, 'error');
                    return;
                }
                function firstHit(list) {
                    for (let i = 0; i < list.length; i++) {
                        if (list[i].count > 0) return list[i].selector + ' (' + list[i].count + ')';
                    }
                    return 'not visible';
                }
                updateStatus('Actions: ' + firstHit(response.more) + '\nBlock item: ' + firstHit(response.block) + '\nConfirm: ' + firstHit(response.confirm), 'info');
            });
        });
    });
}

function pickSelector(slot) {
    activeTikTokTab(function(currentTab) {
        withContentScript(currentTab.id, function() {
            chrome.tabs.sendMessage(currentTab.id, { action: 'pickElement', slot: slot }, function(response) {
                if (chrome.runtime.lastError || !response || !response.success) {
                    updateStatus(CONTENT_SCRIPT_MISSING_MSG, 'error');
                    return;
                }
                updateStatus('Click that control on the TikTok page. Reopen the popup to see the saved selector.', 'info');
            });
        });
    });
}

/**
 * Add the current user to the block list (button is disabled while request is in flight to prevent spam)
 */
function addCurrentUser() {
    var btn = document.getElementById('addCurrentUser');
    if (btn) btn.disabled = true;
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        if (!currentTab || !currentTab.url || !currentTab.url.includes('tiktok.com')) {
            updateStatus('Please navigate to a TikTok profile page first.', 'warning');
            if (btn) btn.disabled = false;
            return;
        }
        withContentScript(currentTab.id, function() {
            chrome.tabs.sendMessage(currentTab.id, {action: 'addCurrentUser'}, function(response) {
                if (btn) btn.disabled = false;
                if (chrome.runtime.lastError) {
                    updateStatus(CONTENT_SCRIPT_MISSING_MSG, 'error');
                    return;
                }
                if (response && response.success) {
                    updateStatus(response.alreadyInList ? 'User already in block list.' : 'User added to block list!', 'success');
                    loadBlockListStats();
                } else {
                    updateStatus('Failed to add user. Make sure you\'re on a TikTok profile page.', 'error');
                }
            });
        });
        // Re-enable button if no response within 3s (e.g. tab closed)
        setTimeout(function() { if (btn) btn.disabled = false; }, 3000);
    });
}

/**
 * Download the block list as a text file
 */
function downloadBlockList() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        if (!currentTab || !currentTab.url || !currentTab.url.includes('tiktok.com')) {
            updateStatus('Please navigate to a TikTok page first.', 'warning');
            return;
        }
        withContentScript(currentTab.id, function() {
            chrome.tabs.sendMessage(currentTab.id, {action: 'downloadBlockList'}, function(response) {
                if (chrome.runtime.lastError) {
                    updateStatus(CONTENT_SCRIPT_MISSING_MSG, 'error');
                    return;
                }
                if (response && response.blockList) {
                    const blockList = response.blockList;
                    if (blockList.length > 0) {
                        const blob = new Blob([blockList.join('\n')], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'tiktok-blocklist.txt';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        updateStatus(`Downloaded ${blockList.length} usernames!`, 'success');
                    } else {
                        updateStatus('Block list is empty.', 'warning');
                    }
                } else {
                    updateStatus('Failed to download block list.', 'error');
                }
            });
        });
    });
}

/**
 * Parse uploaded file: .txt (one username per line) or .json (TikTok-style block list)
 * @param {string} text - File content
 * @param {string} fileName - File name (for format detection)
 * @returns {string[]} Array of usernames (without @)
 */
function parseBlockListFile(text, fileName) {
    const ext = (fileName || '').toLowerCase().split('.').pop();
    if (ext === 'json') {
        try {
            const data = JSON.parse(text);
            const list = Array.isArray(data) ? data : (data['Block list'] || data['BlockList'] || data.block_list || data.blockList || []);
            return list
                .map(item => (item && (item.username || item.Username || item.user_name))) 
                .filter(Boolean)
                .map(u => String(u).trim().replace(/^@/, ''));
        } catch (err) {
            return null; // fallback to plain text
        }
    }
    return text.split(/\r?\n/).map(u => u.trim().replace(/^@/, '')).filter(u => u !== '');
}

/**
 * Handle file upload for block list
 */
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const text = e.target.result;
            const usernames = parseBlockListFile(text, file.name);
            
            if (usernames && usernames.length > 0) {
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    const currentTab = tabs[0];
                    if (!currentTab || !currentTab.url || !currentTab.url.includes('tiktok.com')) {
                        updateStatus('Please navigate to a TikTok page first.', 'warning');
                        return;
                    }
                    withContentScript(currentTab.id, function() {
                        chrome.tabs.sendMessage(currentTab.id, {
                            action: 'uploadBlockList',
                            usernames: usernames,
                            mode: 'block'
                        }, function(response) {
                            if (chrome.runtime.lastError) {
                                updateStatus(CONTENT_SCRIPT_MISSING_MSG, 'error');
                                return;
                            }
                            if (response && response.success) {
                                updateStatus(`Uploaded ${usernames.length} usernames for blocking!`, 'success');
                                event.target.value = '';
                            } else {
                                updateStatus('Failed to upload block list.', 'error');
                            }
                        });
                    });
                });
            } else {
                updateStatus('No valid usernames found in file. Use .txt (one per line) or TikTok export .json.', 'warning');
            }
        };
        reader.readAsText(file);
    }
}

/**
 * Open help for getting existing blocked list from TikTok (README section)
 */
function showBlockListHelp() {
    const url = 'https://github.com/jimididit/tiktok-autoblocker#-getting-your-existing-blocked-list-from-tiktok';
    chrome.tabs.create({ url: url });
    updateStatus('Opened guide in new tab.', 'info');
}

const BLOCKED_ACCOUNTS_URL = 'https://www.tiktok.com/setting/block-list';

function importBlockedAccounts() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const currentTab = tabs[0];
        if (!currentTab || !currentTab.id) {
            updateStatus('Open a browser tab first.', 'warning');
            return;
        }
        const onTikTok = currentTab.url && currentTab.url.includes('tiktok.com');
        const onBlockList = currentTab.url && currentTab.url.includes('/setting/block-list');
        if (!onTikTok) {
            chrome.tabs.create({ url: BLOCKED_ACCOUNTS_URL });
            updateStatus('Opened the Blocked accounts page. Click Import again after it loads.', 'info');
            return;
        }
        if (!onBlockList) {
            chrome.tabs.update(currentTab.id, { url: BLOCKED_ACCOUNTS_URL });
            updateStatus('Opened the Blocked accounts page. Click Import again after it loads.', 'info');
            return;
        }
        updateStatus('Reading blocked accounts…', 'info');
        withContentScript(currentTab.id, function() {
            chrome.tabs.sendMessage(currentTab.id, { action: 'importBlockedAccounts' }, function(response) {
                if (chrome.runtime.lastError) {
                    updateStatus(CONTENT_SCRIPT_MISSING_MSG, 'error');
                    return;
                }
                if (!response || !response.success) {
                    updateStatus('Open the Blocked accounts page, then try again.', 'warning');
                    return;
                }
                loadBlockListStats();
                if (response.found === 0) {
                    updateStatus('No blocked accounts on this page.', 'warning');
                } else if (response.added === 0) {
                    updateStatus('All ' + response.found + ' blocked accounts are already in your list.', 'info');
                } else {
                    updateStatus('Imported ' + response.added + ' new usernames (' + response.total + ' in your list). Use Download Block List to save a file.', 'success');
                }
            });
        });
    });
}





/**
 * Load and display block list statistics
 */
function loadBlockListStats() {
    chrome.storage.local.get(['tiktokBlockList'], function(result) {
        const blockList = result.tiktokBlockList || [];
        const blockCountElement = document.getElementById('blockCount');
        blockCountElement.textContent = `${blockList.length} users in block list`;
    });
}

/**
 * Initialize debug features based on DEBUG_MODE_ENABLED
 */
function initializeDebugFeatures() {
    const debugFeatures = document.getElementById('debugFeatures');
    if (DEBUG_MODE_ENABLED) {
        debugFeatures.style.display = 'block';
    } else {
        debugFeatures.style.display = 'none';
    }
}

/**
 * Debug page structure
 */
function debugPageStructure() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        if (currentTab.url && currentTab.url.includes('tiktok.com')) {
            chrome.tabs.sendMessage(currentTab.id, {action: 'analyzePage'}, function(response) {
                if (response && response.success) {
                    updateStatus('Page analysis complete! Check console for details.', 'info');
                } else {
                    updateStatus('Failed to analyze page.', 'error');
                }
            });
        } else {
            updateStatus('Please navigate to a TikTok page first.', 'warning');
        }
    });
}

/**
 * Test blocking process
 */
function testBlockingProcess() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        if (currentTab.url && currentTab.url.includes('tiktok.com')) {
            chrome.tabs.sendMessage(currentTab.id, {action: 'testBlocking'}, function(response) {
                if (response && response.success) {
                    updateStatus('Blocking test started! Check console for step-by-step details.', 'info');
                } else {
                    updateStatus('Failed to start blocking test.', 'error');
                }
            });
        } else {
            updateStatus('Please navigate to a TikTok page first.', 'warning');
        }
    });
}

/**
 * Export debug log
 */
function exportDebugLog() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        if (currentTab.url && currentTab.url.includes('tiktok.com')) {
            chrome.tabs.sendMessage(currentTab.id, {action: 'exportDebugLog'}, function(response) {
                if (response && response.success) {
                    updateStatus('Debug log exported! Check your downloads folder.', 'success');
                } else {
                    updateStatus('Failed to export debug log.', 'error');
                }
            });
        } else {
            updateStatus('Please navigate to a TikTok page first.', 'warning');
        }
    });
}

/**
 * Clear debug log
 */
function clearDebugLog() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        if (currentTab.url && currentTab.url.includes('tiktok.com')) {
            chrome.tabs.sendMessage(currentTab.id, {action: 'clearDebugLog'}, function(response) {
                if (response && response.success) {
                    updateStatus('Debug log cleared!', 'success');
                } else {
                    updateStatus('Failed to clear debug log.', 'error');
                }
            });
        } else {
            updateStatus('Please navigate to a TikTok page first.', 'warning');
        }
    });
}

/**
 * Clear stuck tasks
 */
function clearStuckTasks() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        if (currentTab.url && currentTab.url.includes('tiktok.com')) {
            chrome.tabs.sendMessage(currentTab.id, {action: 'clearStuckTasks'}, function(response) {
                if (response && response.success) {
                    updateStatus('Stuck tasks cleared!', 'success');
                } else {
                    updateStatus('Failed to clear stuck tasks.', 'error');
                }
            });
        } else {
            updateStatus('Please navigate to a TikTok page first.', 'warning');
        }
    });
}

/**
 * Show a toast notification
 */
function showToast(message, type = 'info', duration = 4000) {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Handle multi-line messages
    if (message.includes('\n')) {
        toast.innerHTML = message.replace(/\n/g, '<br>');
    } else {
        toast.textContent = message;
    }
    
    toastContainer.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    // Auto-remove after duration
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);
}

/**
 * Update the status display
 */
function updateStatus(message, type = 'info') {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
    statusElement.style.display = 'block';
    
    // Also show a toast for important messages
    if (type === 'success' || type === 'warning' || type === 'error' || type === 'info') {
        showToast(message, type);
    }
    
    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 3000);
    }
    
    // Auto-hide info messages after 5 seconds
    if (type === 'info') {
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 5000);
    }
} 