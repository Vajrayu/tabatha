# Tabatha 1.3.2

_First update after launch, from early user feedback. Includes everything from 1.3.1 (which was built but never submitted) plus a Buy Me a Coffee button. No new permissions, no change to data handling._

## What changed
- **Tap to open.** Alt+Q now opens Tabatha and it stays open: no need to keep holding Alt. Use the arrow keys, type to search, or the mouse. Enter or a click opens a tab; Esc or clicking outside closes Tabatha.
- **Alt+Tab style still works.** Hold Alt and press Q again to move through tabs; letting go of Alt then switches.
- **Recently closed is shorter and fresher.** Only things closed in the last 4 hours, at most 8, and at most 2 whole windows. (Chrome's own list goes back across restarts, which made old tabs show up.)
- **Every card shows its site.** Open tabs now show the domain next to the title, and cards from other windows show which window they're in.
- **Window names stay put.** "Window 2" is numbered by when the window was opened, not by when you last used it.

- **Buy Me a Coffee.** A small pixel-style button in the corner of the switcher opens buymeacoffee.com/vey9utb in a new tab. Nothing loads from that site until you click.

## Bug fixes
- Alt+W (window filter) followed by letting go of Alt no longer switches to a tab by surprise.
- Option/Alt + a key (e.g. Option+Shift+4 on a Mac) no longer types symbols into the search box.
- Mac: the "delete" key is Backspace, so closing the selected tab is now Cmd+Backspace; the hint bar shows Mac keys (⌘⌫, ⌥W).
- The hint bar only mentions Alt+W when more than one window is open.

## Check before submitting
- On Windows, tap Alt+Q and let go: the switcher must stay open (Chrome must not move focus to its ⋮ menu). Tested on macOS only.
