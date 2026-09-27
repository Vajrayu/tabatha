# Tabatha Privacy Policy

_Last updated: 27 September 2026_

Tabatha is a Chrome extension that shows previews of your open tabs when you press Alt+Q. This policy explains what it handles and what it doesn't. In short: **nothing ever leaves your computer.**

## What Tabatha handles

To work, Tabatha uses the following on your device:

| Data | Why | Where it's kept | How long |
|---|---|---|---|
| **Tab titles and URLs** of your open tabs | To show and search them in the switcher | Read from Chrome when the switcher opens. Not stored. | Only while the switcher is open |
| **Screenshots of tabs** (downscaled JPEG thumbnails, max 560 px) | To show a preview of each tab | `chrome.storage.session`: in memory only, never written to disk | Until the tab is closed or Chrome quits. Previews of closed tabs are deleted after 30 minutes. |
| **Order in which you used your tabs** (tab ID numbers only) | To list the most recently used tabs first | `chrome.storage.session` | Until Chrome quits |
| **Recently closed tabs and windows** | To show them in "Recently closed" and reopen them | Read from Chrome's own history when the switcher opens. Not stored. | Only while the switcher is open |

Screenshots are taken of the visible tab only, and only in normal windows. Tabatha never captures Incognito windows (it isn't allowed to run in them).

The shortcut listener that runs on web pages only checks whether you pressed Alt+Q. It doesn't read page content and doesn't record any other keystrokes.

## What Tabatha does not do

- It does **not** send any data anywhere. The extension has no server, and its security policy (`connect-src 'none'`) blocks all network requests.
- It does **not** use analytics, tracking, advertising or third-party code.
- It does **not** sell, share or transfer your data to anyone.
- It does **not** use your data for anything other than showing you your tabs.
- It does **not** have accounts or require sign-in.
- It does **not** save anything to disk. Everything is gone when you close Chrome.

## Permissions

| Permission | Used for |
|---|---|
| `tabs` | Listing, switching to, closing and screenshotting your tabs |
| `storage` | Keeping previews in memory (`storage.session`) while Chrome is open |
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
