// TikTok AutoBlocker Popup Script
// Handles user interactions and communicates with content script

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
    document.getElementById('clearBlockList').addEventListener('click', clearBlockList);
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    // Unblock mode temporarily disabled
    // document.getElementById('unblockModeToggle').addEventListener('change', toggleUnblockMode);
    // document.getElementById('unblockFileInput').addEventListener('change', handleUnblockFileUpload);
    
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

/**
 * Add the current user to the block list
 */
function addCurrentUser() {
    // Check if we're on a TikTok page
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        if (currentTab.url && currentTab.url.includes('tiktok.com')) {
            // Send message to content script
            chrome.tabs.sendMessage(currentTab.id, {action: 'addCurrentUser'}, function(response) {
                if (response && response.success) {
                    updateStatus('User added to block list!', 'success');
                    loadBlockListStats();
                } else {
                    updateStatus('Failed to add user. Make sure you\'re on a TikTok profile page.', 'error');
                }
            });
        } else {
            updateStatus('Please navigate to a TikTok profile page first.', 'warning');
        }
    });
}

/**
 * Download the block list as a text file
 */
function downloadBlockList() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        if (currentTab.url && currentTab.url.includes('tiktok.com')) {
            chrome.tabs.sendMessage(currentTab.id, {action: 'downloadBlockList'}, function(response) {
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
        } else {
            updateStatus('Please navigate to a TikTok page first.', 'warning');
        }
    });
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
            const usernames = text.split(/\r?\n/).filter(u => u.trim() !== '');
            
            if (usernames.length > 0) {
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    const currentTab = tabs[0];
                    if (currentTab.url && currentTab.url.includes('tiktok.com')) {
                        chrome.tabs.sendMessage(currentTab.id, {
                            action: 'uploadBlockList',
                            usernames: usernames,
                            mode: 'block'
                        }, function(response) {
                            if (response && response.success) {
                                updateStatus(`Uploaded ${usernames.length} usernames for blocking!`, 'success');
                                // Clear the file input
                                event.target.value = '';
                            } else {
                                updateStatus('Failed to upload block list.', 'error');
                            }
                        });
                    } else {
                        updateStatus('Please navigate to a TikTok page first.', 'warning');
                    }
                });
            } else {
                updateStatus('No valid usernames found in file.', 'warning');
            }
        };
        reader.readAsText(file);
    }
}

/**
 * Toggle unblock mode (Temporarily Disabled)
 */
/*
function toggleUnblockMode() {
    const unblockModeToggle = document.getElementById('unblockModeToggle');
    const unblockFileContainer = document.getElementById('unblockFileContainer');
    const fileInputContainer = document.querySelector('.file-input-container');
    
    if (unblockModeToggle.checked) {
        // Unblock mode is on
        unblockFileContainer.style.display = 'block';
        fileInputContainer.style.display = 'none';
        updateStatus('Switched to Unblock Mode', 'info');
    } else {
        // Block mode is on
        unblockFileContainer.style.display = 'none';
        fileInputContainer.style.display = 'block';
        updateStatus('Switched to Block Mode', 'info');
    }
}
*/

/**
 * Handle file upload for unblock list (Temporarily Disabled)
 */
/*
function handleUnblockFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const text = e.target.result;
            const usernames = text.split(/\r?\n/).filter(u => u.trim() !== '');
            
            if (usernames.length > 0) {
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    const currentTab = tabs[0];
                    if (currentTab.url && currentTab.url.includes('tiktok.com')) {
                        chrome.tabs.sendMessage(currentTab.id, {
                            action: 'uploadBlockList',
                            usernames: usernames,
                            mode: 'unblock'
                        }, function(response) {
                            if (response && response.success) {
                                updateStatus(`Uploaded ${usernames.length} usernames for unblocking!`, 'success');
                                // Clear the file input
                                event.target.value = '';
                            } else {
                                updateStatus('Failed to upload unblock list.', 'error');
                            }
                        });
                    } else {
                        updateStatus('Please navigate to a TikTok page first.', 'warning');
                    }
                });
            } else {
                updateStatus('No valid usernames found in file.', 'warning');
            }
        };
        reader.readAsText(file);
    }
}
*/

/**
 * Clear the entire block list
 */
function clearBlockList() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        if (currentTab.url && currentTab.url.includes('tiktok.com')) {
            chrome.tabs.sendMessage(currentTab.id, {action: 'clearBlockList'}, function(response) {
                if (response && response.success) {
                    updateStatus('Block list cleared!', 'success');
                    loadBlockListStats();
                } else {
                    updateStatus('Failed to clear block list.', 'error');
                }
            });
        } else {
            updateStatus('Please navigate to a TikTok page first.', 'warning');
        }
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
 * Update the status display
 */
function updateStatus(message, type = 'info') {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
    statusElement.style.display = 'block';
    
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