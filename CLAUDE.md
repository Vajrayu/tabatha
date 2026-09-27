# Tabatha: context for Claude

Read this first whenever working on Tabatha. Keep it up to date: add a line to the **Log** at the end of each session, and update **Status**.

## What it is
Chrome extension (Manifest V3). Press Alt+Q to get an Alt+Tab-style switcher showing live screenshot previews of all open tabs. It can search, filter by window (Alt+W), close tabs (Del), and reopen recently closed tabs. Owner: Yuvaraj (building it as a personal/portfolio project; tracked as project #2 in `../PROJECTS.md`).

## Status
- **Current version:** 1.3.0 (first public release)
- **Chrome Web Store:** 1.3.0 submitted 27 Sep 2026, **in review** (expect a slow, in-depth review because of `<all_urls>`). Listing text is in `releases/v1.3.0/store-listing.md`. When it goes live: add the store link to README.md and PROJECTS.md, and set its status to Live.
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

## Architecture (extension/)
- `manifest.json`: MV3, permissions `tabs storage scripting favicon sessions`, host `<all_urls>`, content script `hotkey.js` on all URLs/all frames, commands `open-switcher` (Alt+Q) and `open-switcher-reverse` (Alt+Shift+Q), `switcher.html` web-accessible with `use_dynamic_url`, strict CSP (`connect-src 'none'`), `incognito: not_allowed`, min Chrome 116.
- `background.js`: service worker (ES module). Tracks the MRU order, schedules captures, opens the switcher. It injects an iframe overlay via `scripting.executeScript(injectOverlay)` on http/https/file pages. Otherwise it falls back to a popup window. A watchdog (2.5 s) falls back to the popup if the overlay never reports READY. It restores the window after a cancel (the Windows Alt+Esc quirk).
- `lib/store.js`: all state is in `chrome.storage.session` (memory only). Serialised read-modify-write queue. Validates on read. Previews are capped at 150, closed-tab previews are kept 30 min (max 12). One-time launch token (`createLaunch` / `consumeLaunch`, 15 s TTL).
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
- Tabs never shown since the browser started have no preview ("Inactive"). This is a Chrome limit: only the visible tab can be captured.
- The Web Store requires disclosure of locally-handled data too. We tick *Web history* + *Website content*.
- Screenshot tooling: headless Chromium needs `--screen-info` for window bounds, and the overlay is shot at a 1280×800 viewport. Store images must be 24-bit (no alpha).

## Log
- **2026-09-27**: Restructured the folder (`tabatha-1.3.0/` → `extension/`, zip → `releases/v1.3.0/`). Generated store screenshots (raw + captioned) and promo tiles. Wrote store-listing.md, PRIVACY.md, README, MIT LICENSE. Git init, tagged v1.3.0, pushed to GitHub. Next: submit to the Chrome Web Store and then add the store link to README + PROJECTS.md.
- **2026-09-27 (later)**: 1.3.0 submitted to the Chrome Web Store and in review. Pushed to GitHub (Vajrayu/tabatha, no-reply email). Discussed the next features (stash, content search, smarter find) and wrote ROADMAP.md with priorities and constraints. Updated Projects.xlsx + PROJECTS.md.
