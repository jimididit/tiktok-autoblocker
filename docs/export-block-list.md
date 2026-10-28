# Get your existing TikTok block list into AutoBlocker

If you already blocked many accounts on TikTok and want that list in AutoBlocker (for example to reuse on another account), use one of these options.

## Option 1: TikTok "Download your data" (full archive)

TikTok's full data archive can include a **Block List** (date + username).

1. In the **TikTok app**: Profile - **Menu** - **Settings and privacy** - **Account** - **Download your data**.
2. Request your data and choose the **full archive** (or include Block list / blocked accounts if TikTok lets you pick categories).
3. When TikTok emails you (often within a few days), download the ZIP.
4. Open the ZIP and look for a Block list / blocked accounts file (names vary by region), for example `Block list.txt` or `blocked_accounts.json`.
5. If it is one username per line, save as `.txt` and use **Upload list** in the extension or userscript.
6. If it is JSON (for example `[{"date":"...","username":"..."}]`), upload that JSON with **Upload list** - AutoBlocker can parse TikTok-style exports - or copy usernames into a `.txt`, one per line.

If the export has no block list, request the full archive again.

## Option 2: Add accounts you have already blocked (web)

While logged in on TikTok web:

1. Open [tiktok.com/setting/block-list](https://www.tiktok.com/setting/block-list).
2. Click **Add my blocked accounts** in the extension popup or userscript card.
3. Click **Download list** to save a `.txt` of the whole saved list.

That button **appends** names from TikTok's page. Names you added yourself stay. Clicking again only adds new names. It does **not** start a block run. If the page is empty, use Option 1.
