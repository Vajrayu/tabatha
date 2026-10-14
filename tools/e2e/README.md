# End-to-end tests

Real Chromium + the unpacked extension + a tiny local site. Not a framework: each `t-*.mjs` is a script that prints PASS/FAIL lines.

```
cd tools/e2e
EXT=/abs/path/to/extension S=/tmp/tabatha-e2e node t-core.mjs     # open, search, arrows, Delete
node t-tour.mjs      # first-run flags and the tour
node t-review.mjs    # review reminder timing
node t-groups.mjs    # tab groups (uses a copy with tabGroups as a normal permission)
node t-popup.mjs     # popup-window mode
node t-multiwin.mjs  # two windows, Alt+W, the sweep
node t-sweep.mjs     # "Capture all previews"
node t-health.mjs    # the "why no previews" bar
node t-view.mjs      # sort, By site, collapsing, stars, one card's Capture preview
node t-acts.mjs      # quick actions, duplicates, the bookmarks panel (also t-nudge, t-fixes, t-tellme, t-groupcap)
node t-ui.mjs        # 12 Oct Windows review: close animation, scroll kept, actions bar on top, menus close on a 2nd click, duplicates icon, cards a row, the Alt+Q note
node t-closehere.mjs # closing the tab Tabatha is on (the first card) reopens Tabatha next door
node t-scope.mjs     # ticking in the duplicates view gives the usual actions; Capture from one window comes back to it
node t-group.mjs     # 1.3.5: Group by (site, last used, none) with the sort, remembered; toolbar split; window navbar; panel tabs; the update walkthrough once; startup on for new installs
node t-walk.mjs      # 1.3.5: the walkthrough built from the current UI: 1.3.3→ and 1.3.4→ show only what changed (New/Moved/Changed) + the fixes card; oldest update kept; skipped steps; once; replay; before the review question
node t-capcard.mjs   # 1.3.5: the capture card on a new install (counts, sleeping/refused lines, Enter = Capture), most-recent-first run at ~0.6 s a tab, "Done: N previews.", then the walkthrough; Later; updaters; the toolbar opens it; cards without a preview
node t-top.mjs       # 1.3.5: Pro + coffee icon in the top row, key hints in the footer; at 1100/1440 px and in the popup window; Pro only after the walkthrough; clicks, Enter/Space; Y-bit peeks down from under Pro
node t-update.mjs    # 1.3.5: Chrome's REAL update event (old version from git, folder swapped, same profile). SKIPS on Chrome 153: it fires no onInstalled for a command-line unpacked extension (no manifest/version kept in the profile); the checks run if a Chrome ever does
node t-captiers.mjs  # 1.3.5: the card's wording for 5, 20 (one window), 30, 80, 180 and 500 real tabs, in en/ru/es; "Your 50 most recent" runs 50; Stop
node t-attack.mjs    # what a hostile page can't do: fake Alt+Q, frame the switcher, spam launch tokens, hide the overlay to trick clicks
node t-audit.mjs     # 12 Oct audit: bookmarklets, open-and-remove, deleting the group under Tabatha, reopen with a refused page, double-click reopen, menu keys, storage access
```

Playwright is imported from `PW` (default: a portfolio checkout next to this repo, `../portfolio/node_modules`). Chromium can't run discard tests (it crashes), so the "Sleeping" tests used a raw-CDP driver that isn't kept here.
Not covered: Chrome's real permission prompts, a real fresh install from the Web Store, Windows.
