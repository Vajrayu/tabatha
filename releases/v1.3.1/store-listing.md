# Tabatha 1.3.1: Chrome Web Store update

Everything to paste into the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole), tab by tab. Checked against the code in `extension/` at v1.3.1.

## Listing history (newest first)

Only the text that changed is listed; the old wording is quoted so nothing is lost. The full 1.3.0 listing is also kept in `../v1.3.0/store-listing.md`.

**1.3.1** (30 Sep 2026, update)
- *How it works*: was "Hold Alt and tap Q to move through your tabs, most recently used first. Let go of Alt to jump to the selected tab." / "Or tap Alt+Q once and use the arrow keys, Tab, Enter or the mouse." Now leads with tap-to-open; hold-and-release is the alternative.
- *All your windows*: added "each labelled with its site and window".
- *Recently closed*: was "reopen tabs and windows you just closed"; now "closed in the last few hours".
- *Tidy up fast*: added "(Cmd+Backspace on a Mac)".
- *Sleeping tabs*: was "tabs Chrome has put to sleep, or that you haven't opened since starting Chrome, are clearly marked." Now only tabs Chrome has unloaded are called Sleeping; awake tabs with no screenshot yet say "No preview yet".
- New line: Buy Me a Coffee button.
- *Keyboard shortcuts*: "Alt+Q: next tab" → "Alt+Q: open Tabatha / next tab"; added "Arrow keys" and the Mac close key.
- *Private by design* and *Test instructions*: added the coffee-link sentence (the extension still makes no network requests itself).
- *Test instructions*: shortened to fit the dashboard's 500-character limit (the 1.3.0 text is in `../v1.3.0/store-listing.md`).
- *Test instructions step 2*: was "hold Alt and tap Q … release Alt to switch"; now "press Alt+Q and let go … stays open".
- *Screenshots and promo tiles*: regenerated from 1.3.1 (tap-to-open hint bar, site labels, window tags, No preview yet, coffee button). The 1.3.0 images are kept in `../v1.3.0/store-assets/`.
- *Search / Recently closed*: now "tabs you closed in the last 7 days" (Tabatha keeps its own 7-day list of closed tabs, up to 200, so search goes beyond Chrome's 25-item list).
- *Private by design*: added the bullet about the 7-day closed-tab list; was "They are stored in memory only, never written to disk, and wiped when you close Chrome." and "Previews of closed tabs are forgotten after 30 minutes." Previews are now saved on disk for 7 days.
- *Privacy tab, `storage` permission justification*: **must be replaced** (old text: "Uses chrome.storage.session only: an in-memory store (never written to disk, cleared when the browser closes) …"). Other answers unchanged.
- Privacy tab data-usage ticks and other permission justifications: **unchanged** (no new permissions, same data handling).

**1.3.0** (27 Sep 2026, first submission): original listing.



---

## Before you start

- **Developer account**: one-time US$5 registration fee, and 2-step verification must be on for the Google account.
- **Contact email**: must be set and verified under *Account* before you can publish.
- **Upload**: `tabatha-1.3.1.zip` in this folder. It has `manifest.json` at the root and no `.DS_Store` or other junk.
- **Review:** this is an update with no new permissions, so it's usually quicker than the first review, but `<all_urls>` can still trigger the in-depth one.
- **Before submitting:** check the release blocker in `audit.md` (tap-to-open on Windows).

---

## 1. Package tab

Upload `tabatha-1.3.1.zip`. The dashboard reads name, version (1.3.1), description and icons from the manifest.

---

## 2. Store listing tab

### Title (from manifest)
```
Tabatha
```

### Summary (from manifest, 132 characters max; this one is 108)
```
See live previews of all your tabs with Alt+Q. Search, jump between windows and reopen recently closed tabs.
```

### Description (plain text; the store does not render Markdown)
```
Tabatha is Alt+Tab for your browser tabs.

Press Alt+Q and every open tab appears as a live preview, so you can find the one you want by what it looks like, not by squinting at a row of tiny favicons.

HOW IT WORKS
• Tap Alt+Q and Tabatha stays open. No need to keep holding anything: use the arrow keys, type to search, or click with the mouse. Enter opens a tab, Esc or a click outside closes Tabatha.
• Prefer Alt+Tab style? Hold Alt and tap Q again to move through your tabs, most recently used first, then let go to jump.
• Alt+Shift+Q moves backwards.

FEATURES
• Live previews: see a screenshot of each tab, not just its title.
• Search: start typing to filter open tabs and tabs you closed in the last 7 days, by title or address.
• All your windows: tabs from every Chrome window in one view, each labelled with its site and window. Press Alt+W (or click a window chip) to narrow it to one window.
• Recently closed: reopen tabs and windows you closed in the last few hours, with a preview of what they looked like. Search reaches back 7 days, further than Chrome's own list.
• Tidy up fast: press Delete (Cmd+Backspace on a Mac) or middle-click to close tabs straight from the switcher.
• Sleeping tabs: tabs Chrome has unloaded to save memory are marked Sleeping. Awake tabs Tabatha can't screenshot yet say No preview yet.
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
• Previews never leave your computer. They are saved on your computer for up to 7 days, so they are still there after a restart, and are never uploaded anywhere.
• The titles and addresses of tabs you closed are kept on your computer for 7 days (never uploaded) so you can find them again.
• Old previews and entries are deleted automatically, and uninstalling Tabatha removes them.
• No accounts, no analytics, no tracking, no ads. The extension is blocked from making any network requests at all. (The optional Buy Me a Coffee button simply opens buymeacoffee.com in a new tab when you click it.)
• Tabatha does not run in Incognito windows.

WHY IT ASKS FOR ACCESS TO ALL SITES
Chrome can only take a screenshot of a tab, and show the switcher on top of a page, if the extension has access to that site. Tabatha uses that access only to capture the preview and draw the switcher. It never reads or changes what's on the page.

Open source: https://github.com/Vajrayu/tabatha
```

### Category
**Productivity → Tools** (Workflow & Planning also fits if you prefer).

### Language
English

### Graphic assets
| Field | File | Size | Required? |
|---|---|---|---|
| Store icon | `extension/icons/icon128.png` | 128×128 | Yes |
| Screenshots (1–5) | `store-assets/screenshots/` (new for 1.3.1), choose one set (see below) | 1280×800 | At least 1 |
| Small promo tile | `store-assets/promo-small-440x280.png` | 440×280 | Yes, in practice: without it the extension can't be featured |
| Marquee promo tile | `store-assets/promo-marquee-1400x560.png` | 1400×560 | Optional |

**Screenshots: pick one set, don't mix them:**
- `captioned-01/02/03`: a headline over each screenshot. This set works better in the store. **Recommended.**
- `raw-01/02/03`: plain 1280×800 captures of the extension.
- `raw-04-overview-cycled.png` is a spare raw shot if you want a 4th.

Upload in order: overview → search → windows.

All screenshots use made-up websites (Northwind Docs, Mailpost, Stackboard and so on). No real brands or personal data appear in them.

### Additional fields
| Field | Value |
|---|---|
| Official URL | leave as *None* (needs a verified domain) |
| Homepage URL | `https://github.com/Vajrayu/tabatha` |
| Support URL | `https://github.com/Vajrayu/tabatha/issues` |
| Mature content | No |

---

## 3. Privacy tab

### Single purpose description
```
Tabatha is a visual tab switcher: pressing Alt+Q shows live previews of the user's open and recently closed tabs so they can search for, switch to, close or reopen a tab.
```

### Permission justifications
_(Dashboard fields have length limits; the `storage` text below is 515 characters.)_

**tabs**
```
Needed to list the user's open tabs across all windows with their titles and URLs, to switch to the tab the user picks (tabs.update), to close tabs from the switcher (tabs.remove), and to take the preview screenshot of the visible tab (tabs.captureVisibleTab). Tab titles and URLs are only shown in the switcher and matched against the user's own search text.
```

**storage**
```
Saves, on the user's own computer (chrome.storage.local): small tab-preview thumbnails keyed by page URL (kept 7 days, max 300 / about 6 MB), and the title and address of tabs the user closed in the last 7 days (max 200), so they can be found and reopened beyond Chrome's own 25-item list. Uses chrome.storage.session (memory only) for tab order, the title and address of open tabs (so a closed tab can be listed) and a one-time launch token. Nothing is synced or sent anywhere; the CSP blocks all network requests.
```

**scripting**
```
Used to show the switcher on top of the current page: scripting.executeScript inserts an iframe containing the extension's own switcher.html and removes it again when the switcher closes. On install it also injects the small shortcut listener (hotkey.js) into tabs that were already open, so Alt+Q works without reloading them. No remote code is ever injected. All injected code ships inside the package.
```

**favicon**
```
Shows each tab's site icon in the switcher using Chrome's built-in favicon cache (chrome-extension://<id>/_favicon/). This avoids fetching icons from the network. The extension's Content Security Policy blocks all network requests.
```

**sessions**
```
Lists recently closed tabs and windows (sessions.getRecentlyClosed) in the switcher's "Recently closed" section and reopens the one the user picks (sessions.restore).
```

**Host permission (`<all_urls>`, including the content script on all URLs)**
```
Chrome only allows tabs.captureVisibleTab and scripting.executeScript on sites the extension has host access to. Tabatha needs both on whatever site the user happens to be on: to capture the live preview of the current tab, and to draw the switcher overlay on top of it. Because the user can press the shortcut on any website, access cannot be limited to specific domains.

The content script (hotkey.js) is a 30-line listener that watches only for the Alt+Q key combination, because Chrome's own shortcut can be taken by another app or extension. It reads nothing from the page, ignores synthetic key events, and sends no data other than the message "open the switcher". Screenshots are downscaled thumbnails kept in memory only and never leave the device.
```

### Remote code
**No, I am not using remote code.** All JavaScript is included in the package. The CSP (`script-src 'self'`) forbids anything else.

### Data usage

Google requires you to disclose data that is only handled locally, and says screenshots and URLs count ([User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)). So tick:

- [x] **Web history**: tab URLs and titles, plus recently closed tabs, are shown in the switcher
- [x] **Website content**: screenshots of tabs are used as previews

Leave everything else unticked. Personally identifiable info, health, financial, authentication, personal communications, location and user activity are not collected. The key listener only checks for Alt+Q and records nothing, so "User activity / keystroke logging" does not apply.

Then tick all three certifications:
- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

### Privacy policy URL
```
https://github.com/Vajrayu/tabatha/blob/main/PRIVACY.md
```
(The repo must be public for this link to work.)

---

## 4. Distribution tab
- **Payments**: Free
- **Visibility**: Public (or *Unlisted* first if you want to try the store install before announcing it)
- **Regions**: All regions

## 5. Test instructions tab (optional, but it helps the reviewer; max 500 characters, this is 485)
```
1. Open 3-4 websites in tabs and view each once so it gets a preview.
2. On any https page, tap Alt+Q. The switcher opens and stays open. Use arrows + Enter or click a tab to switch.
3. Type to search. Esc closes.
4. Close a tab, press Alt+Q: it shows under "Recently closed"; click to reopen.
5. On chrome:// or New Tab, it opens in a small popup window.
6. "Buy me a coffee" opens buymeacoffee.com in a new tab (plain link).
No login needed. The extension makes no network requests.
```

---

## What users will see when they install
Chrome will warn that Tabatha can:
- *Read and change all your data on all websites*: from `<all_urls>`
- *Read your browsing history*: from `tabs` / `sessions`

This is expected for a tab switcher with previews. The "Private by design" section of the description is there to reassure people who see these warnings.

## After you publish
- Put the store link in the GitHub README and in `PROJECTS.md`.
- Tag the commit that was submitted: `git tag v1.3.1`.
