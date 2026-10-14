# Tabatha 1.3.5 (in progress, not submitted)

_On top of 1.3.4 (live 13 Oct 2026). No new permissions. New notes kept on the computer: the grouping, the last "What's new" seen; and one list kept in memory only (the sites where Tabatha had to open as a window), cleared when Chrome quits. The Russian and Spanish text is still the first draft._

## Faster and clickable on dark-mode pages
- **On a page a dark-mode extension recolours (Dark Reader, dark themes for Google Docs and others), Tabatha now opens as its own window straight away**, in about a third of a second. 1.3.4 first drew itself inside the page, waited over a second for Chrome to confirm nothing was altering it (clicks did nothing meanwhile), then drew everything again in a window: 1.7 to 3 seconds with 400 tabs, and it felt frozen.
- **Sites where this happened once open as a window from then on** (until Chrome quits), also when the page's own pop-up was covering Tabatha.
- **Big profiles:** the check that moves Tabatha to a window now starts counting only once Tabatha is on screen, so a slow first draw with hundreds of tabs is never mistaken for a covered page.

Measured in Chromium with 400 tabs and 300 saved previews: plain pages 0.2 to 0.9 s in the page (unchanged); dark-mode pages 1.7 to 3.2 s → about 0.3 s. Test: `tools/e2e/t-big.mjs`.

## Layout
- **Sort and Group are separate and work together.** "By site" left the sort: a new **Group** menu offers Tab groups, Site, Last used (last hour, earlier today, this week, older) and No grouping; the sort orders the tabs inside each group. Both are remembered. An old "By site" sort becomes Group: Site.
- **Toolbar split:** what you see (Starred, sort, Group) on the left; things to do (duplicates, capture, the panel) on the right.
- **The window list is a slim side navbar:** one line per window with its tab count, the chosen one marked with an amber bar; icons only on a very narrow window (the name is in the tooltip).
- **The panel's "Saved groups" and "Bookmarks" are tabs, not buttons:** plain text, the chosen one underlined.
- **"What's new":** after an update, the first open shows a short card with what changed, once. New installs get the tour instead.
- **New installs open Tabatha when Chrome starts** (Settings can turn it off). Existing users keep their setting.
