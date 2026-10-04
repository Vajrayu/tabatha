# Chrome Web Store dashboard: fill-in sheet for Tabatha 1.3.2

Work top to bottom. Paste each block exactly as shown (the dashboard shows plain text, not Markdown). Generated from `store-listing.md`, so the two always agree.
Anything not mentioned here stays as it is. Submit **once**, with everything below done.

## 0. Before you open the dashboard (these can get the review rejected or the links broken)
- [ ] **The website is live** at https://gettabatha.vercel.app and its pages open (Home, Manual, Help, Privacy, Feedback). The extension's Help and Feedback links point there, and a reviewer may click them.
- [ ] **The feedback form works** (send yourself a test). If it does not, either finish the Supabase/Resend setup first or tell me to hide the Feedback links.
- [ ] **`PRIVACY.md` is pushed to GitHub** (the Privacy tab links to it there).
- [ ] **The contact email** (the new product Gmail) is set in the dashboard under Account.
- [ ] You loaded the final build once from `extension/` and checked the yellow bar / previews.

## 1. Package
- **Upload new package** → `tabatha-1.3.2.zip` (this folder).
- After it processes, confirm on the Store listing tab: version **1.3.2**, name **Tabatha: Visual Tab Switcher with Live Previews** (47/75), summary **Alt+Tab for Chrome tabs: live previews, instant search and recently closed tabs. Free, private, nothing leaves your computer.** (125/132).
- If the dashboard warns about a new permission: there is none. `tabGroups` is declared as *optional*.

## 2. Store listing tab
**Description** (replace everything):
```
Too many tabs? Tabatha is a visual tab switcher for Chrome. Press Alt+Q to see live previews of every open tab, search across all your windows and reopen the tabs you just closed. It's Alt+Tab for your browser tabs, and a simple tab manager that never sends your tabs anywhere.

HOW IT WORKS
• Tap Alt+Q and Tabatha stays open. No need to keep holding anything: use the arrow keys, type to search, or click with the mouse. Enter opens a tab, Esc or a click outside closes Tabatha.
• Prefer Alt+Tab style? Hold Alt and tap Q again to move through your tabs, most recently used first, then let go to jump.
• Alt+Shift+Q moves backwards.

WHAT YOU GET
• Live previews: see a screenshot of each tab, not just its title.
• Search: start typing to filter open tabs and tabs you closed in the last 7 days, by title or address.
• All your windows: tabs from every Chrome window in one view, each labelled with its site and window. Press Alt+W (or click a window chip) to narrow it to one window.
• Recently closed: reopen tabs and windows you closed in the last few hours, with a preview of what they looked like. Search reaches back 7 days, further than Chrome's own list.
• Tidy up fast: press Delete (Cmd+Backspace on a Mac) or middle-click to close tabs straight from the switcher.
• Sleeping tabs: tabs Chrome puts to sleep while you browse are marked Sleeping, with their last preview faded. After a restart, tabs keep their saved preview. Tabs Tabatha can't screenshot yet say No preview yet.
• Capture all previews: Chrome only lets extensions screenshot the tab on screen, so a tab you haven't looked at has no preview yet. One click flips through your open tabs for a few seconds, captures each, skips sleeping tabs, and puts you back where you were.
• Tab groups (optional): your Chrome tab groups appear as sections, with their names and colours. Close a group, or its whole window, and Tabatha keeps it under "Saved tab groups" until you remove it; Enter brings it back as a real tab group. Turn it on from the footer: Chrome then asks for one extra permission.
• A short tour the first time you open Tabatha, and a "How it works" button whenever you want it again.
• Help when you need it: the manual, answers and a feedback form at https://gettabatha.vercel.app (links in the switcher's footer).
• Free, with a small Buy Me a Coffee button in the corner if you want to say thanks.
• Works everywhere: on pages extensions can't draw on (New Tab, Chrome settings, the Web Store) Tabatha opens in its own small window instead.

KEYBOARD SHORTCUTS
Alt+Q: open Tabatha / next tab
Alt+Shift+Q: previous tab
Alt+W: switch window filter
Enter: open the selected tab
Arrow keys: move the selection
Delete (Mac: Cmd+Backspace): close the selected tab
Esc: clear search, or close Tabatha
Ctrl+F: jump to search

On a Mac, Alt is the Option key. You can change the shortcut at chrome://extensions/shortcuts.

PRIVATE BY DESIGN
• Previews never leave your computer. They are saved on your computer so they are still there after a restart: kept while the tab is open, and for 7 days after you close it. They are never uploaded anywhere.
• The titles and addresses of tabs you closed are kept on your computer for 7 days (never uploaded) so you can find them again.
• Saved tab groups (name, colour, tab titles and addresses) also stay on your computer, until you remove them.
• Old previews and entries are deleted automatically, and uninstalling Tabatha removes them.
• No accounts, no analytics, no tracking, no ads. The extension is blocked from making any network requests at all. (The optional Buy Me a Coffee button simply opens buymeacoffee.com in a new tab when you click it.)
• Tabatha does not run in Incognito windows.

WHY IT ASKS FOR ACCESS TO ALL SITES
Chrome can only take a screenshot of a tab, and show the switcher on top of a page, if the extension has access to that site. Tabatha uses that access only to capture the preview and draw the switcher. It never reads or changes what's on the page.

QUESTIONS
- Does Tabatha send my tabs or screenshots anywhere? No. Everything stays on your computer, and the extension is blocked from making network requests.
- Why does a tab have no preview? Chrome only lets extensions screenshot the tab that is on screen, so a tab gets its preview the first time you look at it. Click "Capture all previews" in Tabatha to fill in the rest in a few seconds. If no tab ever gets one, check chrome://extensions > Tabatha > Site access is "On all sites"; Tabatha tells you if it isn't.
- Why is the tab-groups permission separate? It is optional, so Tabatha works fully without it. Chrome only asks when you click "Turn on tab groups".
- How do I change the Alt+Q shortcut? Open chrome://extensions/shortcuts.
- Does it work on a Mac? Yes. Alt is the Option key.

Open source: https://github.com/Vajrayu/tabatha
```
**Additional fields**
- Homepage URL: `https://gettabatha.vercel.app`
- Support URL: `https://gettabatha.vercel.app/help`
- Official URL: leave as *None*
- Mature content: No

**Screenshots, promo tiles, icon, category, language:** unchanged. (The screenshots are from 1.3.1: still accurate for the main screen. Your demo video can be added any time.)

## 3. Privacy tab
**Single purpose description**
```
Tabatha is a visual tab switcher: pressing Alt+Q shows live previews of the user's open and recently closed tabs so they can search for, switch to, close or reopen a tab.
```

**Permission justifications** (replace each one):

`tabs`
```
Needed to list the user's open tabs across all windows with their titles and URLs, to switch to the tab the user picks (tabs.update), to close tabs from the switcher (tabs.remove), and to take the preview screenshot of the visible tab (tabs.captureVisibleTab). When the user clicks "Capture all previews", it briefly activates each awake tab in turn (tabs.update) to screenshot it, then restores each window's tab. Tab titles and URLs are only shown in the switcher and matched against the user's own search text.
```
`storage`
```
Saves, on the user's own computer (chrome.storage.local): small tab-preview thumbnails keyed by page URL (kept while a tab with that page is open, otherwise 7 days; max 300 / about 6 MB); the title and address of tabs closed in the last 7 days (max 200); tab groups the user chose to keep (name, colour, tab titles and addresses) until the user removes them; and small counters/flags for the one-time tour and review reminder. Uses chrome.storage.session (memory only) for tab order, open-tab titles and addresses, which tabs Chrome discarded, and a launch token. Nothing is synced or sent anywhere; the CSP blocks all network requests.
```
`scripting`
```
Used to show the switcher on top of the current page: scripting.executeScript inserts an iframe containing the extension's own switcher.html and removes it again when the switcher closes. On install it also injects the small shortcut listener (hotkey.js) into tabs that were already open, so Alt+Q works without reloading them, and shows a small one-time "Press Alt+Q" notice (fixed text, reads nothing) on the current page. No remote code is ever injected. All injected code ships inside the package.
```
`favicon`
```
Shows each tab's site icon in the switcher using Chrome's built-in favicon cache (chrome-extension://<id>/_favicon/). This avoids fetching icons from the network. The extension's Content Security Policy blocks all network requests.
```
`sessions`
```
Lists recently closed tabs and windows (sessions.getRecentlyClosed) in the switcher's "Recently closed" section and reopens the one the user picks (sessions.restore).
```
`tabGroups` (only if the dashboard lists it: it is an optional permission)
```
Optional. Used to read the names and colours of the user's tab groups (tabGroups.query), show them as sections in the switcher, keep a saved copy after a group is closed (so it survives its window closing), and recreate a saved group (tabs.group + tabGroups.update) when the user reopens it. Nothing is sent anywhere.
```
Host permission (`<all_urls>`)
```
Chrome only allows tabs.captureVisibleTab and scripting.executeScript on sites the extension has host access to. Tabatha needs both on whatever site the user happens to be on: to capture the live preview of the current tab, and to draw the switcher overlay on top of it. Because the user can press the shortcut on any website, access cannot be limited to specific domains.

The content script (hotkey.js) is a 30-line listener that watches only for the Alt+Q key combination, because Chrome's own shortcut can be taken by another app or extension. It reads nothing from the page, ignores synthetic key events, and sends no data other than the message "open the switcher". Screenshots are downscaled thumbnails saved on the user's own computer only and never leave the device.
```

**Remote code:** No, I am not using remote code. (All JavaScript is in the package; the CSP forbids anything else.)

**Data usage:** tick only **Web history** and **Website content**. Leave everything else unticked. Then tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** `https://github.com/Vajrayu/tabatha/blob/main/PRIVACY.md`

## 4. Distribution tab
Free · Public · All regions. No changes.

## 5. Test instructions (391/500)
```
1. Open 3-4 websites in tabs and view each once.
2. On an https page tap Alt+Q. A short tour shows (Esc skips). Alt+Q then opens the switcher: arrows+Enter or a click switches tab, typing searches, Esc closes.
3. Footer "Capture all previews" flips through the tabs, then returns.
4. Close a tab, press Alt+Q: it is under "Recently closed".
No login. The extension makes no network requests.
```

## 6. Submit
- Optional: tick "publish manually after approval" so it goes live only when you choose (useful if the site isn't ready the day it is approved).
- Click **Submit for review**. Expect the in-depth review (the extension has all-sites access); it can take several days.
- Tell me when submitted, and I will tag `v1.3.2` at the submitted commit and update PROJECTS.md and Projects.xlsx.

## What the reviewer checks, and why this should pass
| They check | Where it is covered |
|---|---|
| Permissions match what the extension does | Every permission has a justification above; `tabGroups` is optional and explained |
| "Single purpose" | One purpose: a visual tab switcher (search, switch, close, reopen, group, preview) |
| Data disclosure matches reality | Web history + Website content ticked; the policy lists everything kept (previews, closed tabs, saved groups, counters) and says nothing is sent |
| No remote code | None; strict CSP (`script-src 'self'`, `connect-src 'none'`) |
| Listing is honest and not spammy | Keywords appear in natural sentences; no fake claims; ratings are not mentioned |
| Review prompts are allowed | Shown to everyone alike, no reward, no gating by answer, easy to dismiss |
| Links work | Homepage, Support and the in-extension Help/Feedback open the live site |
| Privacy policy is reachable | GitHub link above, pushed before submitting |
