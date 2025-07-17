# TikTok AutoBlocker - Tampermonkey Script

A powerful Tampermonkey script for mass blocking TikTok users with enhanced private account support, real-time status updates, and robust error handling. Works in any browser with Tampermonkey support.

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
- **Cross-browser Compatibility**: Works in Chrome, Firefox, Safari, Edge, and more

## 📦 Installation

### Prerequisites

Before you can use the TikTok AutoBlocker script, you must install Tampermonkey. Tampermonkey is a popular userscript manager that's available as a browser extension.

#### Installing Tampermonkey

**Chrome:**
1. Visit [Chrome Web Store - Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
2. Click "Add to Chrome"
3. Confirm the installation

**Firefox:**
1. Visit [Firefox Add-ons - Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
2. Click "Add to Firefox"
3. Confirm the installation

**Other Browsers:**
- Search for "Tampermonkey" in your browser's extension store
- Follow the installation instructions for your specific browser

### Installing the Script

Once Tampermonkey is installed, follow these steps:

1. **Open Tampermonkey Dashboard**
   - Click the Tampermonkey icon in your browser toolbar
   - Select "Dashboard" or "Create a new script"

2. **Create New Script**
   - Click "Create a new script" in the Tampermonkey dashboard
   - This will open the script editor

3. **Copy the Script**
   - Open the file `tampermonkey/script.js` from this repository
   - Copy the entire contents of the file

4. **Paste and Save**
   - Paste the copied script into the Tampermonkey script editor
   - Press `Ctrl + S` (or `Cmd + S` on Mac) to save the script
   - The script should now be enabled and ready to use

## 🎯 Usage

### Adding Users to Block List

1. Navigate to any TikTok user's profile page
2. Look for the "TikTok AutoBlocker" card in the top-right corner of the page
3. Click "Add User to Block List" to add the current user to your blocklist

### Downloading Your Block List

1. On any TikTok page, find the TikTok AutoBlocker card
2. Click "Download Block List" to download your current blocklist as a .txt file
3. The file will be saved to your default downloads folder

### Mass Blocking Users

1. **Create a blocklist file**
   - Create a text file with one username per line
   - Example format:
     ```
     @kimkardashian
     @diddy
     @jlo
     @username1
     @username2
     ```

2. **Upload and process**
   - Navigate to any TikTok page
   - In the TikTok AutoBlocker card, click "Upload Block List (.txt)"
   - Select your text file
   - The script will automatically start blocking all users in the list

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

### Blocking Process

The script uses a sophisticated 3-step blocking sequence:

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

### URL Pattern Support

The script handles various TikTok URL formats:
- `/@username` (with @ symbol)
- `/username` (without @ symbol)
- `/user/username` (alternative format)
- Fallback for any TikTok page

## 🐛 Troubleshooting

### Common Issues

**Script not appearing on TikTok pages:**
1. Check if Tampermonkey is installed and enabled
2. Verify the script is enabled in Tampermonkey dashboard
3. Check browser console for error messages
4. Try refreshing the TikTok page

**Blocking not working:**
1. Ensure you're on a TikTok profile page
2. Check console logs for detailed error information
3. Look for the red test box that appears for 5 seconds
4. Verify the UI card appears in the top-right corner

**Script not loading:**
1. Check Tampermonkey dashboard for script errors
2. Verify the script is saved and enabled
3. Try reinstalling the script
4. Check browser console for JavaScript errors

### Debug Information

The script provides comprehensive logging:
- **Console logs**: Detailed step-by-step information
- **Status updates**: Real-time progress feedback
- **Error messages**: Clear error reporting
- **Test elements**: Visual confirmation that script is running

### Getting Help

If you're still having issues:
1. Check the browser console for error messages
2. Verify Tampermonkey is working with other scripts
3. Try disabling other browser extensions temporarily
4. Check if the script is enabled in Tampermonkey dashboard

## 📈 Version History

### v0.3.0 (Current)
- ✅ Enhanced private account detection
- ✅ Improved 3-step blocking sequence
- ✅ Better error handling and accessibility checks
- ✅ Multiple URL pattern support
- ✅ Comprehensive logging and debugging
- ✅ Robust queue management
- ✅ Real-time status updates
- ✅ Cross-browser compatibility improvements

### v0.2.0
- ✅ Private account support
- ✅ Real-time status updates
- ✅ Enhanced error handling
- ✅ Improved UI design

### v0.1.0
- ✅ Basic blocking functionality
- ✅ File upload/download
- ✅ Simple UI

## 🔒 Security & Privacy

- **Local Storage**: All data is stored locally in your browser
- **No External Servers**: The script doesn't send data to any external servers
- **Open Source**: Full source code is available for review
- **Privacy Focused**: No tracking or data collection

## 📄 License

This project is licensed under the MIT License.

## ⚠️ Disclaimer

This script is intended for personal use and should be used responsibly. The creators are not responsible for any misuse or consequences arising from the use of this script. Please respect TikTok's terms of service and use this tool ethically.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

## 📞 Support

For support, please:
1. Check the troubleshooting section above
2. Review the console logs for error messages
3. Open an issue on the GitHub repository with detailed information 