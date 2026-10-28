# Troubleshooting

## Extension not loading / double injection

- Confirm `chrome-extension/manifest.json` is valid and icons exist.
- Check `chrome://extensions/` for errors.
- Error `Identifier 'blockListKey' has already been declared` means the content script injected twice. Reload the extension, refresh the TikTok tab, and disable a second copy (Store + unpacked).

## Extension not working on TikTok

- Stay on a `tiktok.com` page.
- Refresh the TikTok tab after enabling or reloading the extension (`page-world.js` loads with the page).
- Confirm extension permissions allow access to TikTok.

## Blocking not working

1. Reload the extension at `chrome://extensions/`, then refresh the TikTok tab.
2. Use a real profile URL (`/@username`).
3. If you see "Could not find more options button", "Could not find block option", or confirm never appears, update **Page selectors** - see [page-selectors.md](page-selectors.md).
4. "Could not find block option" can also mean the Actions menu never showed Block (wrong page, already blocked as Unblock, or an uncovered UI language). Open Actions and Pick the Block row.

The saved block list lives in `chrome.storage.local` (`tiktokBlockList`), not page `localStorage`.

## Tampermonkey

- Re-paste [`tampermonkey/script.js`](../tampermonkey/script.js) and keep `@grant unsafeWindow`.
- Confirm the script is enabled in the Tampermonkey dashboard.
- If Actions / Block / Confirm fail, use **Advanced · Page selectors** on the card ([page-selectors.md](page-selectors.md)).

## Still stuck

[Open an issue](https://github.com/jimididit/tiktok-autoblocker/issues) with: browser, extension vs Tampermonkey, TikTok UI language, and the exact status message or console error.
