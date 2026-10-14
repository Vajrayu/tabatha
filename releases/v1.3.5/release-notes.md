# Tabatha 1.3.5 (built 14 Oct 2026, not submitted)

_On top of 1.3.4 (live 13 Oct 2026). No new permissions. New notes kept on the computer: the grouping, the version updated from (until the walkthrough has been shown), whether the capture card was answered; in memory only: the sites where Tabatha had to open as a window. The Russian and Spanish text is still the first draft._

## Previews: "that's expected, here's the button"
- **A new install's first open offers to capture previews**, in Tabatha's voice and sized to the tab count ("You have 6 tabs open. Give me about 5 seconds…", up to "512 tabs. I've seen browsers give up for less."). It counts the awake tabs Tabatha can capture and says how many sleeping tabs it leaves alone and how many pages Chrome won't let it photograph. With over 100 tabs the default is "Your 50 most recent", with "All N" and its time as an explicit choice. Later skips it; shown once. After the run Tabatha reopens in the same place, says "Done: N previews.", and the walkthrough follows.
- **The 100-tab cap on a capture run is gone** for explicit choices; the run goes most recently used first, so Stop leaves the useful ones done. A run takes about 0.55 s a tab (was about 0.85).
- The toolbar's "N without preview · Capture" opens the same card. Updaters get it at the start of their walkthrough when most of their open tabs have no preview.
- **Tabs without a preview look intentional:** the site's icon large on a tint made from the site's name, and the page title (no more "No preview yet"). The camera button stays; sleeping tabs keep "Sleeping".

## One walkthrough, always the current interface
- The tour and the old "What's new" card are one list of steps written against today's UI. A new install and "How it works" show all of it. After an update, only the steps newer than the version you came from, marked New / Moved / Changed, then "Also fixed since you last looked". Several updates before you open Tabatha keep the oldest version, so nothing is skipped. Shown once, after Alt is released, before any review question.
- The "Many at once" step now says the actions bar is at the top (it moved there in 1.3.4).

## Layout
- **Sort and Group are separate and work together.** "By site" left the sort: a new **Group** menu offers Tab groups, Site, Last used (last hour, earlier today, this week, older) and No grouping; the sort orders the tabs inside each group. Both are remembered. An old "By site" sort becomes Group: Site.
- **Toolbar split:** what you see (Starred, sort, Group) on the left; things to do (duplicates, capture, the panel) on the right.
- **The window list is a slim side navbar:** one line per window with its tab count, the chosen one marked with an amber bar; icons only on a very narrow window.
- **The panel's "Saved groups" and "Bookmarks" are tabs, not buttons.**
- **Windows have a ⋯ menu:** rename (the name lasts until Chrome quits), select its tabs, bookmark the window, make a tab group of it, delete it (second click).
- **Every section has a ⋯ menu**, not only real tab groups: when you group by Site, Last used or under "Ungrouped": select its tabs, bookmark them, make a tab group (not when they already are one), move to a new window, put to sleep, close them (second click). "No grouping" has no sections, so no menu.
- **Group: Tab groups asks for the tab-groups permission** when it isn't on yet, and only switches if you allow it.
- **One left edge:** the New tab button, the toolbar, the window list and the footer line up.
- **The Pro waitlist and Buy me a coffee buttons moved to the top right; the key hints are in the footer.** Nobody looks at the footer during a quick Alt+Q. The coffee is an icon now, and on narrow windows Pro shortens to "Pro". Y-bit's daily peek comes from under the Pro button.
- **New installs open Tabatha when Chrome starts** (Settings can turn it off). Existing users keep their setting.

## Faster and clickable on dark-mode pages
- **On a page a dark-mode extension recolours (Dark Reader, dark themes for Google Docs and others), Tabatha now opens as its own window straight away**, in about a third of a second. 1.3.4 first drew itself inside the page, waited over a second for Chrome to confirm nothing was altering it (clicks did nothing meanwhile), then drew everything again in a window: 1.7 to 3 seconds with 400 tabs, and it felt frozen.
- **Sites where this happened once open as a window from then on** (until Chrome quits), also when the page's own pop-up was covering Tabatha.
- **Big profiles:** the check that moves Tabatha to a window starts counting only once Tabatha is on screen.

## Smooth with hundreds of tabs
Measured in Chromium with 500 tabs and 300 saved previews (`tools/e2e/t-big.mjs`), 1.3.4 → 1.3.5:
- first open after Chrome starts: ~1.55 s → ~0.9 to 1.1 s (the wait for a fresh screenshot of the current tab is capped at 0.35 s, was 0.9 s; a slow one finishes behind Tabatha);
- warm open: ~0.2 s → ~0.2 s; arrow keys: ~20 ms → ~20 ms; sort or grouping change: ~40 to 65 ms → ~30 to 60 ms;
- search, first key: ~70 ms → 40 to 110 ms (later keys ~25 ms); scrolling: worst frame ~33 ms → 17 to 33 ms.
- Off-screen pictures now decode off the main thread (this removed a 133 ms scroll frame that the new placeholder cards had introduced).
Targets missed, see the build report: first open and the first key in search are within noise of their targets (1 s, 50 ms); the grid is not virtualised.
