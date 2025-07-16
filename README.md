# TikTok AutoBlocker | MassBlock, Create & Share Custom BlockLists

**COMING SOON!!**: Instagram AutoBlocker & TikTok AutoBlocker Chrome Extension

TikTok AutoBlocker is a custom script that can be injected into your browser using a code injection browser addon (TamperMonkey is suggested) and is inspired by the modern movement to block celebrities and individuals on TikTok who are perceived as out-of-touch or not contributing positively to society. This script provides an easy way to build and manage a personal block list on TikTok, empowering users to curate their digital exposure, and create custom blocklists that can be shared within communities and with friends.

## What the Script Does

- **Add Users to Block List**: When visiting a TikTok user's profile, you can click a button to add that user to your block list.
- **Download Block List as TXT**: Easily download your block list at any time in a simple TXT format, making it easier to apply in different contexts or share.
- **AutoBlocker**: Uploading a Blocklist .txt file initiates the AutoBlocker, blocking every user in the list, automagically!
- **Private Account Support**: Automatically detects and handles private TikTok accounts with alternative blocking methods.
- **Real-time Status Updates**: See live progress updates during the blocking process with color-coded status indicators.
- **Enhanced Error Handling**: Gracefully handles deleted, banned, or inaccessible accounts without stopping the queue.

## Getting Started

### Prerequisites

Before you can use the TikTok AutoBlocker script, you must install Tampermonkey. Tampermonkey is a popular userscript manager that's available as a browser extension for Chrome, Firefox, Safari, and other modern browsers.

1. **Install Tampermonkey**:
   - For Chrome: Visit [Chrome Web Store - Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo).
   - For Firefox: Visit [Firefox Add-ons - Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/).
   - For Safari, Microsoft Edge, and other browsers, search for "Tampermonkey" in your browser’s extension store.

### Installing the Script

Once Tampermonkey is installed, follow these steps to install the TikTok AutoBlocker script:

1. Open Tampermonkey in your browser and select “Create a new script”.
2. Copy the entire script from [tiktok-autoblocker/script.js](https://github.com/jimididit/tiktok-autoblocker/blob/main/script.js).
3. Paste the copied script into the new script window in Tampermonkey.
4. Save the script by pressing `Ctrl + S` or clicking File -> Save in the script editor.

### Usage

- **Add to Block List**: Navigate to any TikTok user's profile. Click the "Add to Block List" button in the upper right-hand corner of the screen to add them to your custom block list.
- **Download Block List**: Click the "Download Block List" button whenever you want to download your list. Share with friends, share online, share with the world!
- **Upload A Blocklist, Run The AutoBlocker**: Uploading a blocklist initiates the AutoBlocker feature which blocks every user in the list.

### Advanced Features

- **Private Account Handling**: The script automatically detects private accounts and uses alternative blocking methods. If direct blocking fails, users are still added to your blocklist.
- **Status Monitoring**: Watch real-time progress updates in the UI showing current user being processed, queue status, and completion messages.
- **Queue Management**: The script processes your entire blocklist queue even if some accounts fail, with detailed logging for troubleshooting.
- **Account Accessibility**: Automatically detects and handles deleted, banned, or non-existent accounts without interrupting the blocking process.

## Recent Updates

### v0.2 - Private Account Support & Enhanced UI

- ✅ **Private Account Detection**: Automatically identifies private TikTok accounts
- ✅ **Alternative Blocking Methods**: Uses multiple fallback strategies for private accounts
- ✅ **Real-time Status Updates**: Color-coded progress indicators in the UI
- ✅ **Enhanced Error Handling**: Graceful handling of deleted/banned accounts
- ✅ **Improved Queue Management**: Better logging and status tracking
- ✅ **Account Accessibility Checks**: Prevents script from getting stuck on invalid accounts

## Contribute

Feel free to fork the project, submit issues, and send pull requests to enhance the functionalities of the TikTok AutoBlocker script or fix potential bugs!

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE) file for details.

## Disclaimer

This script is intended for personal use and should be used responsibly. The creator of this script is not responsible for any misuse or consequences arising from the use of TikTok AutoBlocker.

---

"The rich and powerful take what they want", but with TikTok AutoBlocker, you decide who you let into your digital world. To the rich, I say: "Let *Them* Eat Shit!"
