# Tabatha: context for Claude

Read this first whenever working on Tabatha. Keep it up to date: add a line to the **Log** at the end of each session, and update **Status**.

## What it is
Chrome extension (Manifest V3). Press Alt+Q to get an Alt+Tab-style switcher showing live screenshot previews of all open tabs. It can search, filter by window (Alt+W), close tabs (Del), and reopen recently closed tabs. Owner: Yuvaraj (building it as a personal/portfolio project; tracked as project #2 in `../PROJECTS.md`).

## Status
- **Current version:** 1.3.2 built 2 Oct 2026 (zip, listing, release notes and `UPDATE-CHECKLIST.md` in `releases/v1.3.2/`), waiting to be uploaded. 1.3.1 (tap-to-open, Mac fixes, coffee button; zip + `audit.md` in `releases/v1.3.1/`) was the build Yuvaraj tested. Version numbers: one per upload, see the versioning convention below. GitHub still has stale tags `v1.3.1` (old commit) and `v1.3.2`: fix them when pushing, with Yuvaraj's OK.
- **Before submitting 1.3.2:** replace the store's `storage` permission justification and the Description (see `releases/v1.3.2/UPDATE-CHECKLIST.md`); push PRIVACY.md to GitHub first. Still open from the 1.3.1 audit (`releases/v1.3.1/audit.md`): verify tap-to-open on Windows; M1 (ignore key repeat on the close key), L10.
- **Interaction model (1.3.1):** Alt+Q is only a trigger; the switcher stays open (arrows, typing, mouse, Enter, Esc, click outside). Releasing Alt switches only if Q was pressed *again* while Alt was held (`state.cycled`). Mac: close key is Cmd+Backspace, hint shows Mac keys (`IS_MAC`, `kbd[data-mac]`).
- **Order of work (2 Oct 2026, see `ROADMAP.md`):** submit 1.3.2 with ranking-focused listing updates → new Tabatha website for SEO/AEO (priority only, not started) → then discuss new features (omnibox keyword search, tab groups, cross-machine tabs).
- **Later: tab group names (needs `tabGroups` permission → slower review).
- **Next:** v1.4 "save window" stash. **Read `ROADMAP.md` before planning any new feature.** It has the prioritised ideas, the reasoning and the constraints.
- **GitHub:** https://github.com/Vajrayu/tabatha (public, MIT). Commits use the GitHub no-reply email `54944373+Vajrayu@users.noreply.github.com`, never the personal Gmail.

## Where things live
- Local path on Yuvaraj's Mac: `/Users/yuvathefirst/dev/tabatha` (the parent `dev/` also holds `PROJECTS.md`, `Projects.xlsx`, `movie-vault/`).
```
extension/                 source, loaded unpacked / zipped for the store (manifest.json at its root)
releases/v1.3.0/           tabatha-1.3.0.zip (exact file submitted), store-listing.md, release-notes.md,
                           store-assets/{screenshots/, promo-small-440x280.png, promo-marquee-1400x560.png}
tools/screenshots/         regenerates store screenshots (fictional demo sites + Playwright), see run.sh
PRIVACY.md                 privacy policy; the store links to it on GitHub
ROADMAP.md                 future feature ideas, priorities, constraints (read before planning)
README.md, LICENSE, CLAUDE.md
```
**Versioning convention:** source lives once in `extension/` (git history + tags handle versions). Each release gets its own `releases/v<x.y.z>/` folder with the zip, store text, assets and notes. Git tag `v<x.y.z>` on the commit that was zipped.
- **One version number per store upload, not per fix.** Bump only when starting a new upload after the previous one was submitted; fixes before submission stay on the same number (the store only needs each upload to be higher than the live one). Tag only when submitting.
- **Docs keep their own history, newest first:** README ("Shortcut history", "What's new"), PRIVACY.md ("Changes to this policy"), store listing ("Listing history" quoting the old wording). Never overwrite old wording without recording it there.

## Architecture (extension/)
- `manifest.json`: MV3, permissions `tabs storage scripting favicon sessions`, host `<all_urls>`, content script `hotkey.js` on all URLs/all frames, commands `open-switcher` (Alt+Q) and `open-switcher-reverse` (Alt+Shift+Q), `switcher.html` web-accessible with `use_dynamic_url`, strict CSP (`connect-src 'none'`), `incognito: not_allowed`, min Chrome 116.
- `background.js`: service worker (ES module). Tracks the MRU order, schedules captures, opens the switcher. It injects an iframe overlay via `scripting.executeScript(injectOverlay)` on http/https/file pages. Otherwise it falls back to a popup window. A watchdog (2.5 s) falls back to the popup if the overlay never reports READY. It restores the window after a cancel (the Windows Alt+Esc quirk).
- `lib/store.js`: two areas. **Previews are in `chrome.storage.local` (on disk), keyed by normalized URL** (`normalizeUrl` in `lib/ext.js`; value `{ img, t }`, index `pvidx` = `{ url: { t, n, s } }`, `s` = last time an open tab had that URL). **Retention (decided by Opus, 2 Oct): a preview is kept while ANY open tab has its URL; previews no open tab uses expire 7 days after max(t, s).** Max 300 items / ~6 MB; when over, previews no open tab uses go first (oldest first), open-tab previews last. No expiry on read. `cleanupPreviews` runs at install/update, and otherwise lazily from `savePreview` (`maybeCleanup`: at most every 6 h, never in the first 60 s after browser start via `bootAt`, so it can't race Chrome's tab restore; no alarms permission). **Sleeping**: `tab.discarded` is also true for lazily restored tabs, so the switcher shows Sleeping only if `tab.discarded` AND the id is in `slept` (storage.session; set from `tabs.onUpdated` `discarded:true`, cleared on `false`/close, moved on `onReplaced`). Verified in real Chrome: the event fires and the id is stable. Tab closes don't delete previews (URL-keyed; "Recently closed" reads them by URL). **Closed-tab log** (`closedlog` in storage.local, `logClosedTab` on `tabs.onRemoved`, 7 days / 200 entries, `cleanupClosedLog` at startup): `tabs.onRemoved` can't say what the tab was, so each open tab's url/title/icon is mirrored into `m:<tabId>` in storage.session (`rememberTab`) and moved into the log on close. The switcher (`loadClosed`) merges Chrome's `sessions` list with the log, dedupes by normalized URL, hides log entries that are open again or are inside a closed-window card, shows the last 4 h / 8 items normally and up to 24 matches from the whole log while searching. MRU order, overlay flag and the one-time launch token (`createLaunch` / `consumeLaunch`, 15 s TTL) stay in `chrome.storage.session` (memory only). Serialised read-modify-write queue (per context). Validates on read.
- `lib/capture.js`: `captureVisibleTab` → downscale to 560 px JPEG with OffscreenCanvas (manual base64 decode, because the CSP forbids fetch). Rate-limited to about 2 per second.
- `lib/constants.js`: message names, storage keys, limits. `hotkey.js` duplicates `MSG.HOTKEY` as a string, so keep them in sync.
- `lib/ext.js`: `isOwnUrl` (accepts both the dynamic URL and the real extension-id origin).
- `hotkey.js`: in-page Alt+Q fallback. Trusted events only, idempotent, replaces orphaned copies.
- `switcher.html/css/js`: the UI. It renders nothing until the launch token checks out (postMessage in overlay mode, `?t=` in window mode). The clickjacking guard uses IntersectionObserver v2 (`trackVisibility`). Hold-Alt-and-release commits the selection, like Alt+Tab. All page text goes through `textContent`.

## Release checklist (for the next version)
1. Bump `version` in `extension/manifest.json`.
2. `mkdir releases/v<new>`, then zip the *contents* of `extension/` (manifest at the zip root, no `.DS_Store`): `cd extension && zip -r -X ../releases/v<new>/tabatha-<new>.zip . -x '.DS_Store' '*/.DS_Store'`
3. If the UI changed, regenerate screenshots with `tools/screenshots/run.sh` (uses fictional sites only, never real brands or personal tabs).
4. Copy and adjust `store-listing.md`. Write `release-notes.md`. Update `PROJECTS.md` (version, release log).
5. If permissions or data handling changed, update `PRIVACY.md` **and** the store's Privacy tab.
6. Commit, `git tag v<new>`, push with tags.

## Product principles (from ROADMAP.md, don't break these)
- **Nothing leaves the computer.** No cloud calls with tab or page data. Anything off-device must be opt-in and disclosed.
- **No analytics/tracking.** Feedback comes via store reviews and GitHub issues.
- Features must fit "find / switch / keep your tabs". Other ideas become separate extensions.
- Any change to data handling (e.g. writing to disk, reading page text) → update PRIVACY.md **and** the store's Privacy tab answers in the same release.

## Project tracker
Yuvaraj tracks all builds in `../Projects.xlsx` (main tracker: Projects + Release Log sheets) and `../PROJECTS.md` (markdown mirror). Update **both** when status, version or next step changes, and add a Release Log row per release.

## Git / GitHub
- Remote: https://github.com/Vajrayu/tabatha (public, MIT). Author email is the GitHub no-reply address. **Never commit with the personal Gmail.**
- Pushing from Claude's cloud session: add the repo with push access, bundle the local repo (`git bundle create`), stage the bundle, clone it in the container and push. Branch pushes work. **Tag pushes were rejected by the session's git proxy**, so tags get created on GitHub (Releases → new release) or pushed from Yuvaraj's Mac.
- The v1.3.0 tag exists locally. On GitHub it still needs to be created via Releases.

## Gotchas
- Chrome does not allow **Ctrl+Alt** shortcuts for extension commands (AltGr clash). Max 4 suggested shortcuts per extension.
- `<all_urls>` + content scripts on all URLs means the Web Store does an in-depth review (slow). Don't add permissions casually.
- Chrome may leave Alt+Q unassigned if another extension has it. That's why `hotkey.js` exists. Users can rebind at `chrome://extensions/shortcuts`.
- Tabs never shown since the browser started have no preview (labelled "No preview yet", not asleep). This is a Chrome limit: only the visible tab can be captured. "Sleeping" is only for tabs we saw Chrome discard in this browser session (`tab.discarded` alone is also true for tabs restored lazily after a restart).
- The Web Store requires disclosure of locally-handled data too. We tick *Web history* + *Website content*.
- Screenshot tooling: headless Chromium needs `--screen-info` for window bounds, and the overlay is shot at a 1280×800 viewport. Store images must be 24-bit (no alpha).

## Log
- **2026-10-02 (1.3.2)**: Yuvaraj reported previews vanishing / everything turning inactive after a browser restart. Cause (found with Opus): previews were already on disk in HEAD, but (1) a 7-day expiry applied even to open tabs and on read, (2) cleanup ran at `onStartup`, possibly before tab restore, (3) every lazily restored tab is `discarded` and was styled Sleeping. Fixed per the retention + sleeping design above; version bumped 1.3.1 → 1.3.2, `releases/v1.3.1/` kept as the record of 1.3.1. Test scripts (Playwright + a raw-CDP Chrome driver for discard tests, since Playwright dies when a tab is discarded) lived in the session scratchpad, not the repo.
- **2026-10-02 (later)**: 7-day closed-tab log + merged, searchable "Recently closed"; `timeAgo` guard (no more "20000 d ago"). Known: one long scripted Playwright sequence fails to open the coffee link via a simulated mouse click (works in 6 short scenarios and via DOM click) — see commit notes; do a quick manual check.
- **2026-10-02**: Previews moved to `storage.local`, keyed by URL, 7 days / 300 / 6 MB (real previews average ~18 KB, so ~5 MB at 300). PRIVACY.md, README and the store listing now say previews are on disk; **the store's `storage` permission justification must be replaced before submitting** (see `releases/v1.3.1/UPDATE-CHECKLIST.md`). "Sleeping" label for unloaded tabs.
- **2026-09-30**: Option+W fix (Mac text input slipped past keydown; search now refuses text while Option is held), "Inactive" = `tab.discarded` only, "No preview yet" otherwise. Production audit written (`releases/v1.3.1/audit.md`: 1 blocker = Windows verification, 1 medium = held Delete closes several tabs). Versions folded back to a single 1.3.1; docs updated with in-doc version history.
- **2026-09-29 (later)**: 1.3.2 adds the Buy Me a Coffee chip (bottom-right, Yuvsualy pixel button with amber shadow so it reads on the dark overlay). Opens in a new tab, closes the switcher.
- **2026-09-29**: 1.3.1 from launch-day feedback: tap-to-open, recently closed limited (4 h / 8 items / 2 windows), domain + window tag on cards, stable window numbers, Alt+W and Option+key fixes, Mac Cmd+Backspace. Tested in Playwright Chromium on macOS (tap, arrows+Enter, hold-cycle, search, Esc, click outside, Cmd+Backspace, closed-window cap). Windows tap behaviour still to check by hand.
- **2026-09-27**: Restructured the folder (`tabatha-1.3.0/` → `extension/`, zip → `releases/v1.3.0/`). Generated store screenshots (raw + captioned) and promo tiles. Wrote store-listing.md, PRIVACY.md, README, MIT LICENSE. Git init, tagged v1.3.0, pushed to GitHub. Next: submit to the Chrome Web Store and then add the store link to README + PROJECTS.md.
- **2026-09-27 (later)**: 1.3.0 submitted to the Chrome Web Store and in review. Pushed to GitHub (Vajrayu/tabatha, no-reply email). Discussed the next features (stash, content search, smarter find) and wrote ROADMAP.md with priorities and constraints. Updated Projects.xlsx + PROJECTS.md.
