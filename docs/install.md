# Install

## Chrome Web Store (recommended)

1. Open [TikTok AutoBlocker on the Chrome Web Store](https://chromewebstore.google.com/detail/tiktok-autoblocker/aimhdnemlhpkecbdhgclkckcfgpgolln).
2. Click **Add to Chrome** and confirm.
3. Pin the extension if you want the icon visible in the toolbar.

## Load unpacked (development)

1. Clone or download this repository.
2. Open Chrome to `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the `chrome-extension/` folder.
5. Open a TikTok tab and refresh it so the content script loads.

Icons under `chrome-extension/icons/` are already included for development builds.

If you also have the Store copy installed, disable one of them. Two copies inject twice and break the page.

## Tampermonkey

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser.
2. Open the Tampermonkey dashboard and create a new script (or edit an existing one).
3. Replace the editor contents with [`tampermonkey/script.js`](../tampermonkey/script.js) from this repo.
4. Save (`Ctrl+S` / `Cmd+S`).
5. Open tiktok.com - the AutoBlocker card should appear on the page.

Keep `@grant unsafeWindow` as shipped. `@grant none` can fail under TikTok's page CSP.
