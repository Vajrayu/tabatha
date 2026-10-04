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
```

Playwright is imported from `PW` (default: the portfolio checkout's `node_modules`). Chromium can't run discard tests (it crashes), so the "Sleeping" tests used a raw-CDP driver that isn't kept here.
Not covered: Chrome's real permission prompts, a real fresh install from the Web Store, Windows.
