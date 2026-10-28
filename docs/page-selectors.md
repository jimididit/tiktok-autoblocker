# Page selectors (when TikTok changes the UI)

You do not need to edit code. The Chrome popup and the Tampermonkey card both have **Advanced · Page selectors**.

Leave fields empty to use built-in matchers (including common Block / Unblock languages). Use **Pick** when a step fails after a TikTok redesign or in a language that is not covered yet.

## Blocking a profile

Do this on a normal profile page while logged in.

1. Open the extension popup (or expand Page selectors on the userscript card).
2. Open **Advanced · Page selectors**.
3. **Actions (⋯) button**: click **Pick**, then click the ⋯ / Actions control on the profile. The popup closes for Pick - reopen it afterward.
4. **Block menu item**: open the Actions menu first so Block is visible, click **Pick**, then click the Block row.
5. **Confirm Block button**: start a block until the confirm dialog appears (or use a test profile), click **Pick**, then click Confirm.
6. Click **Save selectors**.
7. Optional (extension): **Test on this page** to see which selectors match right now.
8. If something is wrong, **Reset to defaults** and try again, or [open an issue](https://github.com/jimididit/tiktok-autoblocker/issues).

You should not need to type CSS by hand. Pick builds the selector for you.

## Blocked accounts page

On [tiktok.com/setting/block-list](https://www.tiktok.com/setting/block-list), use **Username** + **Pick** on one username in the list so **Add my blocked accounts** keeps working after TikTok restyles that page.

## Tips

- For Block, the menu must be open before you Pick - otherwise the row is not on the page.
- Built-in multi-language labels cover many TikTok UI languages. Pick is the escape hatch for anything missing.
- After saving, refresh the TikTok tab if a run was already stuck.
