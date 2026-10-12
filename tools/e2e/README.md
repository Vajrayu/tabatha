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
node t-attack.mjs    # what a hostile page can't do: fake Alt+Q, frame the switcher, spam launch tokens, hide the overlay to trick clicks
node t-audit.mjs     # 12 Oct audit: bookmarklets, open-and-remove, deleting the group under Tabatha, reopen with a refused page, double-click reopen, menu keys, storage access
```

Playwright is imported from `PW` (default: a portfolio checkout next to this repo, `../portfolio/node_modules`). Chromium can't run discard tests (it crashes), so the "Sleeping" tests used a raw-CDP driver that isn't kept here.
Not covered: Chrome's real permission prompts, a real fresh install from the Web Store, Windows.
