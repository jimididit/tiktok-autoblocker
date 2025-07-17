# TikTok AutoBlocker

A powerful tool for mass blocking TikTok users with support for both Chrome extensions and Tampermonkey scripts. Features enhanced private account detection, real-time status updates, and robust error handling.

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

## 📁 Project Structure

```
tiktok-autoblocker/
├── chrome-extension/          # Chrome extension version
│   ├── manifest.json         # Extension configuration
│   ├── content.js           # Content script for TikTok pages
│   ├── popup.html          # Popup interface
│   ├── popup.js            # Popup logic
│   ├── background.js       # Background service worker
│   ├── icons/              # Extension icons
│   ├── README.md           # Chrome extension documentation
│   └── INSTALL.md          # Installation guide
├── tampermonkey/            # Tampermonkey script version
│   ├── script.js           # Main Tampermonkey script
│   ├── README.md           # Tampermonkey documentation
│   └── test-blocklist.txt  # Test blocklist file
├── test-blocklist.txt      # Sample blocklist for testing
└── README.md              # This file
```

## 🛠️ Installation Options

### Option 1: Chrome Extension (Recommended)
- **Pros**: Modern UI, integrated popup, persistent storage
- **Cons**: Requires Chrome browser
- **Installation**: See [Chrome Extension README](chrome-extension/README.md)

### Option 2: Tampermonkey Script
- **Pros**: Works in any browser with Tampermonkey, lightweight
- **Cons**: Requires Tampermonkey extension
- **Installation**: See [Tampermonkey README](tampermonkey/README.md)

## 📋 Usage

### File Format
Your blocklist text file should contain usernames, one per line:

```txt
@kimkardashian
@diddy
@jlo
@username1
@username2
```

### Basic Workflow
1. **Create a blocklist**: Add usernames to a text file
2. **Upload the file**: Use the upload feature in either version
3. **Monitor progress**: Watch real-time status updates
4. **Download results**: Save your blocklist for future use

## 🔧 Technical Details

### Blocking Process
The tool uses a sophisticated 3-step blocking sequence:

1. **Click "More" button** (`[data-e2e="user-more"]`)
2. **Click "Block" option** (`div[role="button"][aria-label="Block"]`)
3. **Confirm blocking** (`button[data-e2e="block-popup-block-btn"]`)

### Private Account Detection
Advanced detection for private accounts:
- DOM element indicators (`[data-e2e="private-account"]`)
- Text content analysis ("This account is private")
- User subtitle detection ("Private🦈")
- Multiple fallback strategies

### Error Handling
- **Inaccessible accounts**: Automatically skipped with logging
- **Failed blocking**: Added to blocklist as fallback
- **Network issues**: Retry mechanisms and graceful degradation
- **Queue management**: Continues processing even if some accounts fail

## 🎯 Version History

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

## 🐛 Troubleshooting

### Common Issues

**Script not appearing on TikTok pages:**
- Check if Tampermonkey is installed and enabled
- Verify the script is enabled in Tampermonkey dashboard
- Check browser console for error messages

**Blocking not working:**
- Ensure you're on a TikTok profile page
- Check console logs for detailed error information
- Try the debug features to analyze page structure

**Extension errors:**
- Reload the extension in `chrome://extensions/`
- Check for syntax errors in console
- Verify all files are present in the extension folder

### Debug Features
Both versions include comprehensive debugging:
- Page structure analysis
- Step-by-step blocking tests
- Debug log export
- Real-time status monitoring

## 📄 License

This project is licensed under the MIT License.

## ⚠️ Disclaimer

This tool is intended for personal use and should be used responsibly. The creators are not responsible for any misuse or consequences arising from the use of this tool. Please respect TikTok's terms of service and use this tool ethically.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

## 📞 Support

For support, please:
1. Check the troubleshooting section above
2. Review the console logs for error messages
3. Open an issue on the GitHub repository with detailed information
