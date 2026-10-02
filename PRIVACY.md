# Tabatha Privacy Policy

_Last updated: 2 October 2026 (version 1.3.1). Earlier versions of this policy are kept at the end, under "Changes to this policy"._

Tabatha is a Chrome extension that shows previews of your open tabs when you press Alt+Q. This policy explains what it handles and what it doesn't. In short: **nothing ever leaves your computer.**

## What Tabatha handles

To work, Tabatha uses the following on your device:

| Data | Why | Where it's kept | How long |
|---|---|---|---|
| **Title and address (URL) of each open tab**, plus the address of its site icon | To show and search them in the switcher, and to be able to list a tab after you close it | Read from Chrome when the switcher opens. A copy is kept in `chrome.storage.session`: in memory only, never written to disk | Until the tab closes or Chrome quits |
| **Screenshots of tabs** (downscaled JPEG thumbnails, max 560 px), saved together with the page address (URL) they belong to | To show a preview of each tab, including after you restart Chrome | `chrome.storage.local`: **saved on your computer's disk**, inside your Chrome profile folder | Deleted automatically after 7 days, and the oldest are removed beyond 300 previews or about 6 MB. Uninstalling Tabatha deletes them. |
| **Order in which you used your tabs** (tab ID numbers only) | To list the most recently used tabs first | `chrome.storage.session` | Until Chrome quits |
| **Recently closed tabs and windows** | To show them in "Recently closed" and reopen them | Read from Chrome's own recently-closed list when the switcher opens. Not stored by Tabatha (see the next row for its own list). | Only while the switcher is open |
| **Tabs you closed: title, address (URL) and icon address**, and when you closed them | To find and reopen tabs beyond Chrome's own 25-item list, and to search them | `chrome.storage.local`: **saved on your computer's disk**, inside your Chrome profile folder | Deleted automatically after 7 days, at most 200 entries. Uninstalling Tabatha deletes them. |

Screenshots are taken of the visible tab only, and only in normal windows. Tabatha never captures Incognito windows (it isn't allowed to run in them).

The shortcut listener that runs on web pages only checks whether you pressed Alt+Q. It doesn't read page content and doesn't record any other keystrokes.

## What Tabatha does not do

- It does **not** send any data anywhere. The extension has no server, and its security policy (`connect-src 'none'`) blocks all network requests.
- The switcher has an optional **Buy Me a Coffee** button. Only if you click it, Chrome opens buymeacoffee.com in a new tab, like any link. Tabatha sends nothing to that site and loads nothing from it before you click.
- It does **not** use analytics, tracking, advertising or third-party code.
- It does **not** sell, share or transfer your data to anyone.
- It does **not** use your data for anything other than showing you your tabs.
- It does **not** have accounts or require sign-in.
- It does **not** upload or share the previews it saves on your disk. They stay in your Chrome profile folder on your computer.

## Permissions

| Permission | Used for |
|---|---|
| `tabs` | Listing, switching to, closing and screenshotting your tabs |
| `storage` | Keeping previews and the 7-day closed-tab list on your computer (`storage.local`) and a little temporary state in memory (`storage.session`) |
| `scripting` | Showing the switcher on top of the current page |
| `favicon` | Showing site icons from Chrome's local icon cache |
| `sessions` | Showing and reopening recently closed tabs |
| Access to all sites | Chrome only lets extensions screenshot a tab, or draw on top of it, if they have access to that site |

## Children

Tabatha is a general-purpose tool and does not knowingly handle any information about children.

## Changes

If this policy changes, the new version will be published here with a new date. The full history is in this repository's commit log.

## Contact

Questions or concerns: open an issue at https://github.com/Vajrayu/tabatha/issues, or use the contact email shown on the Chrome Web Store listing.

## Store
https://chromewebstore.google.com/detail/edjglhlabdmgacehahfdjjffapbkaekk?utm_source=item-share-cb

## Changes to this policy (newest first)

**2 October 2026 (1.3.1): tab previews are now saved on disk**
- Changed: tab screenshots used to be kept in memory only and wiped when Chrome closed. They are now saved on your computer (`chrome.storage.local`, keyed by page address) so previews are still there after you restart Chrome. They are deleted after 7 days, capped at 300 previews / about 6 MB, and removed when you uninstall Tabatha.
- Replaced: "It does **not** save anything to disk. Everything is gone when you close Chrome." and "Previews of closed tabs are deleted after 30 minutes." Both no longer apply.
- Added: Tabatha now keeps its own list of the tabs you closed (title, address, icon address, time), saved on your computer for 7 days (up to 200), so you can search and reopen tabs that Chrome's own recently-closed list (25 items) has already forgotten. Tabs from Incognito windows are never recorded (Tabatha doesn't run there).
- Unchanged: nothing is sent anywhere, there are no analytics, and no new permissions.

**30 September 2026 (1.3.1)**
- Added: the paragraph about the optional Buy Me a Coffee button.
- (Superseded by the 2 October entry above: previews are now kept on disk.)
- No new permissions.

**27 September 2026 (1.3.0)**
- First version of this policy.
