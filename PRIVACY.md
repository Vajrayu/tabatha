# Tabatha Privacy Policy

_Last updated: 4 October 2026 (version 1.3.2). Earlier versions of this policy are kept at the end, under "Changes to this policy"._

Tabatha is a Chrome extension that shows previews of your open tabs when you press Alt+Q. This policy explains what it handles and what it doesn't. In short: **nothing ever leaves your computer.**

## What Tabatha handles

To work, Tabatha uses the following on your device:

| Data | Why | Where it's kept | How long |
|---|---|---|---|
| **Title and address (URL) of each open tab**, plus the address of its site icon | To show and search them in the switcher, and to be able to list a tab after you close it | Read from Chrome when the switcher opens. A copy is kept in `chrome.storage.session`: in memory only, never written to disk | Until the tab closes or Chrome quits |
| **Screenshots of tabs** (downscaled JPEG thumbnails, max 560 px), saved together with the page address (URL) they belong to | To show a preview of each tab, including after you restart Chrome | `chrome.storage.local`: **saved on your computer's disk**, inside your Chrome profile folder | Kept for as long as a tab with that page is open. After that, deleted 7 days after it was last captured or used. At most 300 previews / about 6 MB (previews of open tabs are removed last). Uninstalling Tabatha deletes them. |
| **Order in which you used your tabs** (tab ID numbers only) | To list the most recently used tabs first | `chrome.storage.session` | Until Chrome quits |
| **Recently closed tabs and windows** | To show them in "Recently closed" and reopen them | Read from Chrome's own recently-closed list when the switcher opens. Not stored by Tabatha (see the next row for its own list). | Only while the switcher is open |
| **Tabs you closed: title, address (URL) and icon address**, and when you closed them | To find and reopen tabs beyond Chrome's own 25-item list, and to search them | `chrome.storage.local`: **saved on your computer's disk**, inside your Chrome profile folder | Deleted automatically after 7 days, at most 200 entries. Uninstalling Tabatha deletes them. |
| **Saved tab groups: each group's name and colour, and the title and address (URL) of its tabs** (only if you switch on tab groups, see Permissions) | To keep a tab group after Chrome has forgotten it (its window or its last tab was closed), and let you reopen it | `chrome.storage.local`: **saved on your computer's disk**, inside your Chrome profile folder | Kept until you remove the group in Tabatha (or uninstall it). While a group is open, its saved copy follows it. At most 100 groups. |
| **Review reminder counters**: when Tabatha was installed, how many times you opened it, how many times a review reminder was shown, and whether you have answered it | To ask for a review a few times, never too often, and never again once you answer | `chrome.storage.local` on your computer | Until you uninstall Tabatha. Never sent anywhere. |
| **A first-run flag**: whether the welcome notice and tour have been shown | To show them only once | `chrome.storage.local` on your computer | Until you uninstall Tabatha |

Screenshots are taken of the visible tab only, and only in normal windows. Tabatha never captures Incognito windows (it isn't allowed to run in them).

Right after you install Tabatha, a small "Press Alt+Q" notice is shown once on an ordinary web page. It is written by Tabatha, shows fixed text, and reads nothing from the page.

The shortcut listener that runs on web pages only checks whether you pressed Alt+Q. It doesn't read page content and doesn't record any other keystrokes.

## What Tabatha does not do

- It does **not** send any data anywhere. The extension has no server, and its security policy (`connect-src 'none'`) blocks all network requests.
- The switcher has an optional **Buy Me a Coffee** button. Only if you click it, Chrome opens buymeacoffee.com in a new tab, like any link. Tabatha sends nothing to that site and loads nothing from it before you click.
- The review reminder has a **Review** button and a **Send feedback** button. Only if you click one, Chrome opens the Chrome Web Store, or a new GitHub issue (public, with the text you typed filled in so you can edit it before posting), in a new tab. Tabatha itself sends nothing.
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
| `tabGroups` (optional) | Not requested when you install Tabatha. Only if you click "Turn on tab groups", Chrome asks you for it. It lets Tabatha show your Chrome tab groups as sections (with their names and colours) and keep a saved copy of them. You can take it back at any time at chrome://extensions. |
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

**4 October 2026 (1.3.2, still being submitted): tab groups, welcome tour and review reminder**
- Added: **saved tab groups**. If you switch on tab groups, Tabatha keeps a copy of each tab group's name, colour and tabs (title and address) on your computer until you remove it, so a group survives its window being closed. This uses a new *optional* permission, `tabGroups`, which is only requested when you click "Turn on tab groups".
- Added: a **review reminder** and a **first-run tour**. They use small counters and flags kept on your computer (see the table). The review reminder's buttons open the Chrome Web Store or a GitHub issue only when you click them.
- Added: a one-time "Press Alt+Q" notice shown on a web page right after install.
- Unchanged: nothing is sent anywhere by Tabatha, there are no analytics, and no required permission was added.

**2 October 2026 (1.3.2): tab previews and closed tabs are now saved on disk**
- Changed: tab screenshots used to be kept in memory only and wiped when Chrome closed. They are now saved on your computer (`chrome.storage.local`, keyed by page address) so previews are still there after you restart Chrome. A preview is kept for as long as a tab with that page is open, and deleted 7 days after it was last captured or used once no open tab has it. They are capped at 300 previews / about 6 MB (previews of open tabs are removed last), and removed when you uninstall Tabatha.
- Replaced: "It does **not** save anything to disk. Everything is gone when you close Chrome." and "Previews of closed tabs are deleted after 30 minutes." Both no longer apply.
- Added: Tabatha now keeps its own list of the tabs you closed (title, address, icon address, time), saved on your computer for 7 days (up to 200), so you can search and reopen tabs that Chrome's own recently-closed list (25 items) has already forgotten. Tabs from Incognito windows are never recorded (Tabatha doesn't run there).
- Unchanged: nothing is sent anywhere, there are no analytics, and no new permissions.

**30 September 2026 (1.3.1)**
- Added: the paragraph about the optional Buy Me a Coffee button.
- (Superseded by the 2 October entry above: previews are now kept on disk.)
- No new permissions.

**27 September 2026 (1.3.0)**
- First version of this policy.
