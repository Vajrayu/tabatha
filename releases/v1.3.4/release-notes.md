# Tabatha 1.3.4

_Fixes on top of 1.3.3 (live 12 Oct 2026): from a hand test on Windows and an engineering audit. No new permissions, nothing new stored on the computer except one date (when you said "Not now" to the shortcut note). The Russian and Spanish text is still the first draft (a native check is planned after release)._

## From the Windows test (12 Oct)
- **Closing a tab is visible:** its card shrinks and fades before it goes (no animation if the system asks for less motion).
- **Closing a tab no longer jumps the view to the top**, wherever you had scrolled.
- **Closing the tab you're on no longer makes Tabatha vanish.** That tab is always the first card, and Tabatha lives inside it; now Tabatha moves to the tab next to it and opens again there, with your search kept (also for "Close" in the actions bar).
- **The quick-actions bar sits at the top**, right under the toolbar, and the cards move down while it shows, so it covers nothing.
- **"More", the ⋯ menus and Settings close on a second click** of their button.
- **In the duplicates view you choose what closes:** tick copies and the usual actions bar acts on just those (Close, Copy links, Bookmark…); "Close N copies" is still there while nothing is ticked.
- **"Capture" from one window comes back to that window**, with its search and filter, instead of "All windows".
- **The pressed "N duplicates" button shows its icon** (it was amber on amber and looked like empty space).
- **More cards a row:** three or more beside the side panel, also on a laptop screen; the window list and the panel get narrower on small windows, and the popup window (pages where the overlay can't draw) is larger. On narrow cards the "Window 2" label moves into the tooltip.
- **The "Alt+Q isn't set" note** says what still works (web pages), offers "Set it in Chrome", and "Not now" keeps it away for a week.
- **Clicks work on every page.** Tabatha only takes clicks when Chrome confirms nothing is hiding or covering it (a guard against click tricks). On some pages Chrome can't confirm that, e.g. with a dark-mode extension's colour filter or the page's own pop-up on top, and clicks did nothing. Now Tabatha moves into its own small window there, where clicks work.
- **Alt+Q no longer goes dead on a frozen page.** If the page Tabatha would draw on has stopped responding, Tabatha opens as a window after a moment instead of waiting for that page (it used to need a Chrome restart).

## From the audit (12 Oct)
- Bookmarks: a bookmarklet is no longer deleted by "Open and remove"; any bookmark is removed only once its tab has opened; bookmarklets can be renamed.
- Tab groups: "Delete the group and its tabs" also forgets the saved copy when the group holds the tab Tabatha is open over; a saved group reopens even if Chrome refuses one of its pages; a double click reopens it once.
- ⋯ menus work with the keyboard (arrows, Home, End; Esc and Tab close them).
- A failed open no longer swallows the next presses for a moment.
- Hardening: web pages' content scripts can't read Tabatha's stored data (where Chrome supports it).
- Faster with hundreds of tabs (cards off screen are not laid out until scrolled to).
