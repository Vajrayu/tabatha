# Tabatha Privacy Policy

_Last updated: 14 October 2026 (version 1.3.5). Earlier versions of this policy are kept at the end, under "Changes to this policy"._

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
| **Saved tab groups: each group's name and colour, and the title and address (URL) of its tabs** (only if you switch on tab groups, see Permissions) | To keep a tab group after Chrome has forgotten it (its window or its last tab was closed), and let you reopen it | `chrome.storage.local`: **saved on your computer's disk**, inside your Chrome profile folder | Kept until you remove the group in Tabatha (or uninstall it). While a group is open, its saved copy follows it. At most 100 groups and about 2 MB (beyond that, the oldest closed groups are dropped). |
| **The outcome of the last preview attempt**: when it happened, "saved" or the error text Chrome gave, and the site's host name (for example `example.com`), never page content | To tell you why a preview is missing (for example that Chrome is limiting Tabatha's site access) | `chrome.storage.session`: in memory only | Until Chrome quits |
| **"How is Tabatha working for you?" counters**: when Tabatha was installed, how many times you opened it, the day you last opened it, how many times the question was shown, and whether you have answered it. Your answer itself is not stored | To ask a couple of times, never too often, never on the first open of a day, and never again once you answer | `chrome.storage.local` on your computer | Until you uninstall Tabatha. Never sent anywhere. |
| **"Use Alt+Q" note counters**: on which day, and how many times, Tabatha noticed you flipping through tabs one by one (for example with Ctrl+Tab), how many times it showed its note, and whether you chose "Don't show again". Only these counts: not which tabs, not which sites, no keystrokes | To suggest Alt+Q at most once a day and three times in all | `chrome.storage.local` on your computer, plus the time Tabatha was last opened in `chrome.storage.session` (memory only) | Until you uninstall Tabatha. Never sent anywhere. |
| **A first-run flag**: whether the welcome notice and tour have been shown, and (1.3.5) whether you have answered the "Want previews for all of them?" card | To show them only once | `chrome.storage.local` on your computer | Until you uninstall Tabatha |
| **Starred pages: the address (URL) and title of each page you star**, and when you starred it | To show your starred tabs with the Starred filter, and to reopen a starred page that is no longer open. The preview of a starred page is kept like an open tab's | `chrome.storage.local`: **saved on your computer's disk**, inside your Chrome profile folder | Until you unstar the page (or uninstall Tabatha). At most 300 (beyond that, the oldest stars are dropped). Not Chrome bookmarks: they stay inside Tabatha. |
| **Layout choices**: how you sort the switcher, how you group it (tab groups, site, last used or none), which sections you collapsed (a group's name and colour, or a site's name), whether the side panel is open and which of its tabs, and the bookmark folder you used last (its ID number) | To open the switcher the way you left it | `chrome.storage.local` on your computer | Until you uninstall Tabatha |
| **Settings**: the language you chose for Tabatha (or "auto"), and whether it opens when Chrome starts | To show Tabatha in your language, and to open it at start-up only if you asked | `chrome.storage.local` on your computer | Until you change them or uninstall Tabatha |
| **Small display notes**: the day Y-bit last peeked from behind the corner buttons, the day you said "Not now" to the note that Alt+Q isn't set (1.3.4), the Tabatha version you updated from, kept only until the walkthrough of what changed has been shown (1.3.5), the order you dragged saved groups into, and (in memory only) the names you give your windows in the switcher (until Chrome quits), how many previews the last "capture previews" run took, which pages Chrome refused to screenshot and which sites (for example `https://docs.google.com`, the site only, no page addresses) hid or covered Tabatha's in-page view (1.3.5) | So Y-bit peeks at most once a day, your order is kept, Tabatha stops offering a capture Chrome will refuse, and opens as its own window straight away on sites where the in-page view can't take clicks | `chrome.storage.local`; the refused pages and the sites in `chrome.storage.session` (memory only) | Until you uninstall Tabatha; the refused pages and the sites until Chrome quits |
| **Your Chrome bookmarks** (only if you switch on bookmarks, see Permissions) | To show them in the side panel, and to add, rename, move or delete one when you ask | Read from and written to Chrome's own bookmarks when you use the panel. **Tabatha keeps no copy of them.** Chrome may sync bookmarks to your Google account if you have Chrome sync on, as it does for any bookmark | Chrome keeps them as usual |

Screenshots are taken of the visible tab only, and only in normal windows. Tabatha never captures Incognito windows (it isn't allowed to run in them).

Right after you install Tabatha, a small "Press Alt+Q" notice is shown once on an ordinary web page. It is written by Tabatha, shows fixed text, and reads nothing from the page.

The shortcut listener that runs on web pages only checks whether you pressed Alt+Q. It doesn't read page content and doesn't record any other keystrokes.

The number on Tabatha's toolbar icon is your count of open tabs, worked out on your computer each time a tab opens or closes. "Copy links" puts the addresses of the tabs you chose on your clipboard, only when you click it.

## What Tabatha does not do

- It does **not** send any data anywhere. The extension has no server, and its security policy (`connect-src 'none'`) blocks all network requests.
- The switcher has an optional **Buy Me a Coffee** button. Only if you click it, Chrome opens buymeacoffee.com in a new tab, like any link. Tabatha sends nothing to that site and loads nothing from it before you click.
- The switcher has **Help** and **Feedback** links, a **Pro · join the waitlist** button, and the "How is Tabatha working for you?" question has **Review**, **Tell me what would help** and **Join the Tabatha Pro waitlist** buttons. Only if you click one, Chrome opens the Tabatha website (tabatha-vert.vercel.app) or the Chrome Web Store in a new tab. The link tells the website only where you clicked (for example `extension-prompt`), Tabatha's version and its interface language (en, ru or es), and for the survey the answer you picked (good, okay or bad). Tabatha itself sends nothing: nothing reaches the website unless you fill in its form and press its button. What you choose to send there (a message, your email for the waitlist) is covered by the website's privacy page.
- **When you remove Tabatha**, Chrome opens a page on the Tabatha website asking, optionally, why. Its address carries only Tabatha's version and interface language. Removing Tabatha sends nothing by itself; your answer is sent only if you pick one and press Send.
- **What the website stores when you send something** (feedback, the Pro waitlist, the survey, the uninstall answer, a vote or a feature request): what you wrote or picked, your email only if you add it, the page language and Tabatha's version, and a one-way scrambled form of your IP address (it can't be turned back into the address; it is used only to stop spam floods). Feedback messages also keep your browser's name and version, to help with bug reports. Nothing is shared or sold; ask on the feedback page to have anything deleted.
- **Capture all previews** is a button you press. Tabatha then shows each of your tabs for a moment to take its screenshot, skips tabs Chrome has put to sleep, and puts you back on your tabs. The screenshots are stored as described above and go nowhere.
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
| `bookmarks` (optional) | Not requested when you install Tabatha. Only if you click "Turn on bookmarks" in the side panel (or use "Bookmark" on a tab), Chrome asks you for it. It lets Tabatha show your Chrome bookmarks in the panel and add, rename, move or delete them when you ask. Tabatha keeps no copy. You can take it back at any time at chrome://extensions. |
| Access to all sites | Chrome only lets extensions screenshot a tab, or draw on top of it, if they have access to that site. If you have set Tabatha's "Site access" to "On click" in chrome://extensions, Tabatha says so and offers a button to allow all sites |

## Children

Tabatha is a general-purpose tool and does not knowingly handle any information about children.

## Changes

If this policy changes, the new version will be published here with a new date. The full history is in this repository's commit log.

## Contact

Questions or concerns: email viewtabatha@gmail.com, or open an issue at https://github.com/Vajrayu/tabatha/issues.

## Store
https://chromewebstore.google.com/detail/edjglhlabdmgacehahfdjjffapbkaekk?utm_source=privacy

## Changes to this policy (newest first)

**14 October 2026 (1.3.5): a walkthrough of what changed, a capture card, and a list in memory**
- Added: how you group the switcher (a layout choice, like the sort). The Tabatha version you updated from, kept on your computer only until the walkthrough of what changed has been shown, then deleted. Whether you have answered the card that offers to capture previews. In memory only: the names you give windows in the switcher (gone when Chrome quits), how many previews the last capture run took (for one "Done" note), and the sites (site address only, never page addresses) where a dark-mode extension or the page itself hid or covered Tabatha's in-page view, kept until Chrome quits, so Tabatha opens there as its own window straight away.
- Changed: new installs open Tabatha when Chrome starts (you can turn it off in Settings). The capture run now takes the tabs you choose, no longer at most 100. It still only shows each tab for a moment; nothing is sent anywhere.
- Unchanged: no new permissions; the extension makes no network requests and has no analytics.

**12 October 2026 (1.3.4): one date**
- Added: if you press "Not now" on the note that says Alt+Q isn't set, Tabatha keeps the date on your computer, so the note stays away for a week.
- Unchanged: no new permissions; the extension makes no network requests and has no analytics.

**12 October 2026 (website forms, wording)**
- Clarified: what the website keeps when you send something. It always kept a scrambled (one-way) form of the sender's IP address to stop spam, and the browser's name and version; this was not written down before. From now on the browser's name and version are kept only with feedback messages, not with the waitlist, survey or uninstall answers.
- Unchanged: the extension itself makes no network requests and has no analytics.

**12 October 2026 (1.3.3, before submission): settings and the contact address**
- Added: **Settings** (language, "open Tabatha when Chrome starts"), saved on your computer.
- Added: small display notes (Y-bit's daily peek, the order of saved groups, pages Chrome refused to screenshot), on your computer or in memory.
- Added: the contact email viewtabatha@gmail.com.
- Changed: "Sleep" now marks tabs and unloads them as Tabatha closes; nothing new is stored for it.
- Still true: the extension itself makes no network requests and has no analytics.

**11 October 2026 (1.3.3): bookmarks panel, quick actions, the "use Alt+Q" note, the Pro waitlist and the uninstall page**
- Added: an optional **`bookmarks`** permission, asked for only when you turn on bookmarks. Tabatha reads and changes Chrome's own bookmarks when you ask, and keeps no copy.
- Added: small counters for the **"use Alt+Q" note** (how often it noticed one-by-one tab flipping, and how often it showed the note), kept on your computer.
- Changed: the review reminder is now the question **"How is Tabatha working for you?"**, asked a little sooner (after 3 days and 15 opens), at most twice; it keeps the day you last opened Tabatha. Your answer is not stored or sent.
- Added: buttons that open the website's **Pro waitlist** and **survey** pages, and Chrome now opens a website page **after you remove Tabatha**. Each address carries only where you clicked, the version and the interface language (and, for the survey, the answer you picked). Nothing is sent unless you press Send on the website.
- Added: the number of open tabs on the toolbar icon, worked out on your computer.
- Changed: layout choices now also remember the side panel and the last bookmark folder used.
- Still true: the extension itself makes no network requests and has no analytics.

**8 October 2026 (1.3.3): stars and layout choices**
- Added: **starred pages**. When you star a tab, Tabatha saves that page's address and title on your computer, and keeps its preview while it is starred. Nothing is added to Chrome's bookmarks.
- Added: **layout choices** (sort order, collapsed sections) are saved on your computer.
- Still true: nothing leaves your computer.

**4 October 2026 (1.3.2, still being submitted): tab groups, welcome tour, review reminder and "Capture all previews"**
- Added: **saved tab groups**. If you switch on tab groups, Tabatha keeps a copy of each tab group's name, colour and tabs (title and address) on your computer until you remove it, so a group survives its window being closed. This uses a new *optional* permission, `tabGroups`, which is only requested when you click "Turn on tab groups".
- Added: a **review reminder** and a **first-run tour**. They use small counters and flags kept on your computer (see the table). The review reminder's buttons open the Chrome Web Store or the website's feedback page only when you click them.
- Added: Help and Feedback links to the Tabatha website (tabatha-vert.vercel.app); they open only when clicked.
- Added: a one-time "Press Alt+Q" notice shown on a web page right after install.
- Added: a **"Capture all previews"** button, and a message in the switcher when Chrome is limiting Tabatha's site access or a screenshot fails. The message uses the outcome of the last preview attempt, kept in memory only (see the table).
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
