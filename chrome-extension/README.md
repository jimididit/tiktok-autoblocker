# TikTok AutoBlocker Chrome Extension

A powerful Chrome extension for mass blocking TikTok users with enhanced private account support, real-time status updates, and robust error handling. **Available on Chrome Web Store Soon!!**

## 🚀 Features

### Core Functionality

- **Mass Blocking**: Upload text files with usernames and automatically block them all
- **Private Account Support**: Automatically detects and handles private TikTok accounts
- **Real-time Status Updates**: Live progress feedback during blocking operations
- **Enhanced Error Handling**: Gracefully handles deleted, banned, or inaccessible accounts
- **Block List Management**: Add users, download blocklists, and upload existing lists

### Advanced Features

- **3-Step Blocking Process**: Reliable blocking sequence that works with TikTok's current interface
- **Account Accessibility Detection**: Smart detection of accessible vs. inaccessible accounts
- **Multiple URL Pattern Support**: Handles various TikTok URL formats
- **Comprehensive Logging**: Detailed console output for debugging and monitoring
- **Queue Management**: Robust task queue system for processing large lists
- **Debug Tools**: Built-in debugging features for troubleshooting

## 📦 Installation

### Development Installation

1. **Download the extension files**
   - Clone or download this repository
   - Navigate to the `chrome-extension` folder

2. **Create required icons**
   - Convert `icons/icon.svg` to PNG format
   - Create `icon16.png` (16x16), `icon48.png` (48x48), and `icon128.png` (128x128)
   - Place them in the `icons/` folder

3. **Install in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right corner
   - Click "Load unpacked" and select the `chrome-extension` folder
   - The extension should now appear in your extensions list

### Production Installation

1. Download the latest release from the GitHub repository
2. Extract the `chrome-extension` folder
3. Follow the development installation steps above

## 🎯 Usage

### Adding Users to Block List

1. Navigate to any TikTok user's profile page
2. Click the TikTok AutoBlocker extension icon in your browser toolbar
3. Click "Add Current User to Block List" to add them to your blocklist

### Downloading Your Block List

1. Click the extension icon
2. Click "Download Block List" to download your current blocklist as a .txt file

### Mass Blocking Users

1. Create a text file with one username per line (e.g., `@username1`, `@username2`)
2. Click the extension icon
3. Click "Upload Block List (.txt)" and select your file
4. The extension will automatically start blocking all users in the list

### File Format

Your blocklist text file should contain usernames, one per line:

```txt
@kimkardashian
@diddy
@jlo
@username1
@username2
```

## 🔧 Technical Details

### Architecture

- **Manifest V3**: Uses the latest Chrome extension manifest version
- **Content Script**: Runs on TikTok pages to handle blocking operations
- **Popup Interface**: Modern UI for user interactions
- **Background Service Worker**: Handles extension lifecycle and background tasks
- **Chrome Storage**: Uses chrome.storage.local for data persistence

### Blocking Process

The extension uses a sophisticated 3-step blocking sequence:

1. **Click "More" button** (`[data-e2e="user-more"]`)
2. **Click "Block" option** (`div[role="button"][aria-label="Block"]`)
3. **Confirm blocking** (`button[data-e2e="block-popup-block-btn"]`)

### Private Account Handling

Advanced detection for private accounts:

- DOM element indicators (`[data-e2e="private-account"]`)
- Text content analysis ("This account is private")
- User subtitle detection ("Private")
- Multiple fallback strategies

### Error Handling

- **Inaccessible accounts**: Automatically skipped with logging
- **Failed blocking**: Added to blocklist as fallback
- **Network issues**: Retry mechanisms and graceful degradation
- **Queue management**: Continues processing even if some accounts fail

## 🛠️ Development

### File Structure

```markdown
chrome-extension/
├── manifest.json          # Extension configuration
├── content.js            # Content script for TikTok pages
├── popup.html           # Popup interface HTML
├── popup.js             # Popup interface JavaScript
├── background.js        # Background service worker
├── icons/               # Extension icons (16px, 48px, 128px)
├── test-blocklist.txt   # Test file for uploads
├── README.md           # This file
└── INSTALL.md          # Installation guide
```

### Building

1. Make changes to the source files
2. Reload the extension in `chrome://extensions/`
3. Test on TikTok pages

### Debugging

- Open Chrome DevTools on TikTok pages to see content script logs
- Check the extension's background page for service worker logs
- Use the popup interface to test functionality
- Enable debug mode for additional debugging features

## 🐛 Troubleshooting

### Common Issues

**Extension not loading:**

- Make sure all required files are present
- Check that the `manifest.json` file is valid JSON
- Ensure icons are in PNG format and the correct sizes
- Check Chrome's extension page for error messages

**Extension not working on TikTok:**

- Make sure you're on a TikTok page (tiktok.com domain)
- Check the browser console for any error messages
- Try refreshing the TikTok page
- Ensure the extension has the necessary permissions

**Blocking not working:**

- Ensure you're on a TikTok profile page
- Check console logs for detailed error information
- Try the debug features to analyze page structure

### Debug Features

The extension includes comprehensive debugging tools:

- **Page Structure Analysis**: Analyze current page elements
- **Step-by-step Blocking Tests**: Test the blocking process manually
- **Debug Log Export**: Export detailed logs to file
- **Clear Stuck Tasks**: Reset the blocking queue if needed

## 📈 Version History

### v0.3.0 (Current)

- ✅ Enhanced private account detection
- ✅ Improved 3-step blocking sequence
- ✅ Better error handling and accessibility checks
- ✅ Multiple URL pattern support
- ✅ Comprehensive logging and debugging
- ✅ Robust queue management
- ✅ Real-time status updates

### v0.2.0

- ✅ Private account support
- ✅ Real-time status updates
- ✅ Enhanced error handling
- ✅ Modern UI design

### v0.1.0

- ✅ Basic blocking functionality
- ✅ File upload/download
- ✅ Simple UI

## 📄 License

This project is licensed under the MIT License.

## ⚠️ Disclaimer

This extension is intended for personal use and should be used responsibly. The creators are not responsible for any misuse or consequences arising from the use of this extension. Please respect TikTok's terms of service and use this tool ethically.
