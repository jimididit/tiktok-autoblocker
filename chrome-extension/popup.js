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
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    
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