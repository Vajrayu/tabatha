# Windows check for 1.3.3 (by hand, about 20 minutes)

76% of installs are on Windows and nothing has been tried there by hand. Do this on a Windows PC with Chrome, before submitting. Write the result next to each line (OK / what happened).

## Setup
1. Copy `extension/` (or unzip `tabatha-1.3.3.zip`) to the PC. Chrome → `chrome://extensions` → Developer mode on → **Load unpacked** → pick the folder. If the store version is installed, turn it off first (two copies fight over Alt+Q).
2. Open 6 to 8 real sites in two windows (a news site, YouTube, GitHub, Gmail, a PDF, the New Tab page). Look at each once.

## Tap-to-open and shortcuts (the 1.3.1 audit's open blocker)
- [ ] Tap Alt+Q and let go: the switcher **stays open**. Arrows move, Enter opens, Esc closes.
- [ ] Hold Alt, tap Q twice, let go: it **switches** to the selected tab (Alt+Tab style).
- [ ] Alt+Shift+Q goes backwards.
- [ ] Esc while still holding Alt: the Chrome window **stays in front** (it is not sent behind other windows).
- [ ] On the New Tab page: the switcher opens as a small window. Note whether it appears on the taskbar (expected) and closes cleanly.
- [ ] Delete closes the selected tab; holding Delete closes **one** tab only.
- [ ] Alt+W cycles the window filter. Alt+S stars. Alt+P captures the selected tab's preview.

## Window sidebar and settings (12 Oct)
- [ ] With two Chrome windows: the list on the left shows each window with a small picture; clicking one shows only its tabs; Alt+W cycles.
- [ ] ⚙ Settings → Language → Русский: everything switches at once; back to English works. "Open Tabatha when Chrome starts": quit Chrome, start it, Tabatha appears after a few seconds.
- [ ] "How it works" and "Settings" in the footer open without closing Tabatha (the test browser can't check clicks at the very bottom; please confirm by hand).

## 1.3.3 toolbar
- [ ] Sort buttons (Recent, Newest, Oldest, A–Z, By site) all work; Alt+Q still cycles by recent use.
- [ ] Collapse a section; close and reopen Tabatha: still collapsed.
- [ ] "N duplicates": shows only the copies (Stays / Closes), then "Close N copies" asks once more and closes only the extra copies.

## Quick actions
- [ ] Type a word several tabs share: the bar appears. **Copy links** → paste into Notepad: one address per line. **Copy as Markdown** → `- [title](url)` lines.
- [ ] Try copying on a strict site (GitHub, Gmail): if it says the page won't let Tabatha use the clipboard, note which site.
- [ ] Nothing in the pill works until a tab is ticked. Ctrl+click two cards: both ticked. Shift+click a third: the range is ticked. **Group** asks for a name and colour; **Pin**, **Mute**, **Sleep** (marks, unloads when you leave), **Move to new window** each do what they say.
- [ ] Close several: the first click asks "Close N? Click again".

## Side panel
- [ ] The panel opens by itself on a wide window; × hides it, and it stays hidden next time.
- [ ] Turn on tab groups → close a group → it shows in **Saved groups**; clicking its name brings it back.
- [ ] **Bookmarks** tab → Turn on bookmarks → Chrome's prompt appears → after allowing, folders show **without reopening Tabatha**. (If you have to reopen Tabatha first, tell me: that's a bug.)
- [ ] Drag a tab card onto a folder: it is bookmarked there. Drag a bookmark onto another folder, and above another bookmark (reorder). Folder ⋯ → Delete says how many bookmarks are inside.
- [ ] Group ⋯ menu: Rename or recolour, Ungroup, Close (it stays under Saved), Delete. Drag an open group above another: it moves in Chrome's tab strip too.

## Language
- [ ] Chrome in Russian (Settings → Languages → move Russian to the top → Display Google Chrome in this language → Relaunch): the switcher, the tour, the notes and the toolbar tooltip are all in Russian, with no cut-off words. Then switch back.

## The "use Alt+Q" note
- [ ] Press Ctrl+Tab quickly 4 times, wait, do it again: a lime note in the bottom-right says "Looking for a tab?". "Try it" opens Tabatha. (It only shows once a day; to see it again, remove and re-add the extension.)
