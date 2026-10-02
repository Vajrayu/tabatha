# Tabatha 1.3.1 — production-readiness audit

_30 Sep 2026. Audited: `extension/` at 1.3.2 + uncommitted Alt+W and "Inactive" changes (numbered 1.3.3 at audit time, released as 1.3.1: same code). Compared against the published 1.3.0 (`git diff v1.3.0 -- extension/`). No code was changed during the audit; the only edit for packaging is the manifest version._

Method: read every file in `extension/` in full, traced every message and storage key, and ran Playwright (Chromium 153, macOS) against the real extension for the claims marked **verified**. Anything that needs another OS or a real store install is marked **NOT VERIFIED**.

---

## 1. Architecture

No build step, no bundler, no npm dependencies in the shipped code. The zip is the contents of `extension/` (16 files, checked).

| Component | File | Runs in | Trust | Job |
|---|---|---|---|---|
| Manifest | `manifest.json` | — | — | MV3; perms `tabs storage scripting favicon sessions`, host `<all_urls>`; `incognito: not_allowed`; strict `extension_pages` CSP (`connect-src 'none'`); `switcher.html` web-accessible with `use_dynamic_url`; no `externally_connectable` |
| Service worker | `background.js` (+ `lib/*`) | extension origin | trusted | MRU tracking, screenshot scheduling, opening the switcher (overlay or popup), watchdog, focus restore |
| Store | `lib/store.js` | imported by worker **and** switcher (two separate module instances) | trusted | all state in `chrome.storage.session`; validates on read; per-context serial queue |
| Capture | `lib/capture.js` | worker | trusted | `captureVisibleTab` → 560 px JPEG via OffscreenCanvas; per-window debounce; ~2/s rate limit |
| Hotkey content script | `hotkey.js` | every frame of every http/https/file page (isolated world) | **untrusted page next door** | only sends `{type:'tabatha:hotkey', dir}` on a trusted Alt+Q keydown |
| Injected overlay host | `injectOverlay()` in `background.js` | top frame of the current page (isolated world, via `scripting.executeScript`) | page can see/restyle its DOM nodes | adds a blur `div` + `<iframe src=switcher.html>`, hands the one-time token to the frame via `postMessage` to the extension origin, removes itself on CLOSE / tab hidden |
| Switcher UI | `switcher.html/js/css` | extension origin, in an iframe on a hostile page **or** in a popup window | trusted code, embedded in an untrusted page | renders tabs/previews/closed; all actions (switch, close, restore, new tab, coffee link) |

**Trust boundaries (traced):**
- Page → content script: only real key presses (`isTrusted`). Nothing is read from the page.
- Content script → worker: one message type; worker checks `sender.id`, that `sender.tab` exists and the URL isn't ours; the only effect is "open the switcher on the sender's tab" (rate-limited 120 ms).
- Page → switcher iframe: the page shares `window` with the content script, so it **can** postMessage to the frame. The frame only accepts `launch` with a token that matches `storage.session`; 5 wrong guesses = the frame gives up (page can force popup mode; nothing more).
- Switcher → worker: `READY`, `CLOSED` accepted only if `sender.url` is our `switcher.html`.
- Worker → switcher: `CYCLE` accepted only from a sender without `sender.tab` (the worker).
- Other extensions: no `onMessageExternal` listener → ignored.

**Where state lives** (§9) — memory in the worker (`opening`, `watchdog`, `lastTrigger`, capture `timers`, `lastCaptureAt`), `storage.session` (MRU, previews, closed previews, overlay flag, launch token), and the switcher's in-memory `state` (a snapshot taken when it opens).

**Stale-state hotspots:** the switcher's snapshot (only `tabs.onRemoved` is live) — now open for longer because of tap-to-open; the per-window capture timers (lost on worker restart, harmless).

**Coupling:** `hotkey.js` repeats the `MSG.HOTKEY` string (documented). `store.js` is imported by two contexts, so its "serial queue" only serialises within one context (see L5). Nothing else stands out; module split is proportionate for ~1,500 lines.

---

## 2. Threat model

**Malicious web page (the realistic attacker).**
- *Can influence:* its own DOM, the overlay's iframe element (style, position, removal), postMessage into the iframe, timing.
- *Cannot:* read the switcher's DOM/storage (cross-origin), forge trusted key events, send runtime messages as the extension, choose which tab/URL/ID the extension acts on (tab IDs come from Chrome; the only page-originated message has no parameters besides a clamped `dir`).
- *Confused deputy:* none found. The single page-reachable privileged action is "open Tabatha on this tab", which the user could do anyway.
- *Clickjacking:* guarded with IntersectionObserver v2 (`trackVisibility`); clicks need 300 ms of full visibility; if hidden after being seen, action keys cancel. Residual: the 800 ms key grace (L10).
- *Fingerprinting:* while the overlay is open the page can see it in the DOM and read the per-session dynamic URL (I3). No detection is possible while Tabatha is closed except by noticing Alt+Q is swallowed.
- *DoS:* page can spam fake `launch` messages → switcher falls back to the popup window. Harmless.

**Compromised renderer / malformed messages.** Could send `HOTKEY` at will → opens the switcher, rate-limited. Malformed messages are type-checked before use; no handler dereferences unchecked fields.

**Manipulated storage.** Only extension contexts can write `storage.session` (default access level). Reads are still validated (`isPreview`, `isId`, `cleanIndex`); image data must start with `data:image/jpeg;base64,`.

**Supply chain.** No runtime dependencies, no remote code, no dynamic `import()`, no `eval`/`new Function`. Dev-only tooling (`tools/screenshots`, Playwright) is not in the zip.

**Privacy.** See §12.

---

## 3. Chrome extension security

| Permission | Why it's needed (traced to code) | Verdict |
|---|---|---|
| `tabs` | `tabs.query/get/update/remove/create`, tab URL + title, `captureVisibleTab` | needed |
| `storage` | `storage.session` for previews, MRU, token | needed |
| `scripting` | inject overlay; re-inject `hotkey.js` into open tabs on install/update | needed |
| `favicon` | `/_favicon/` icons without network | needed |
| `sessions` | "Recently closed" list and restore | needed |
| `<all_urls>` | background screenshots on every tab switch (activeTab only covers the tab the user invoked on, so previews of other tabs would be impossible); overlay injection | needed for the product as designed; it's also why reviews are slow |
| content script `<all_urls>`, `all_frames` | Alt+Q fallback when focus is inside an iframe | justified; 30 lines, no page reads |

- **CSP:** `script-src 'self'`, `connect-src 'none'`, `object-src 'none'`. The only data URIs are thumbnails and one CSS mask.
- **DOM sinks:** `innerHTML`/`insertAdjacentHTML` are used only with the constant `ICON` SVG strings. All titles/URLs from tabs and sessions go through `textContent` or attributes. `img.src` is either a validated JPEG data URL or our own `_favicon` URL. **No attacker-controlled HTML sink found.**
- **URLs opened:** `COFFEE_URL` constant, `tabs.create()` with no URL, `sessions.restore()` by Chrome-issued `sessionId`. No `javascript:` path.
- **Web-accessible resource:** `switcher.html` only; renders nothing without the token (UUID, 15 s TTL, single use, wrong guesses don't invalidate).
- **Unused APIs:** none. No `downloads`, `alarms`, `notifications`, `webNavigation`, `activeTab`.

Result: **no exploitable vulnerability found.** That's what I established from the code, not a proof of absence.

---

## 4. Message passing

| Channel | Sender → receiver | Data | Sender check | Validation | Privileged effect | Page can influence? | Replay |
|---|---|---|---|---|---|---|---|
| `tabatha:hotkey` (runtime) | hotkey.js → worker | `dir` | `sender.id`, has `sender.tab`, not own URL | `dir === -1 ? -1 : 1` | open switcher on sender tab | only by a real key press | rate-limited; second open → CYCLE |
| `tabatha:cycle` (runtime) | worker → switcher | `dir` | no `sender.tab` | clamped | move selection | no | moves again (intended) |
| `tabatha:ready` | switcher → worker | — | own `switcher.html` URL | — | disarm watchdog, return queued presses (clamped ±20) | no | second READY returns 0 (opening cleared) |
| `tabatha:closed` | switcher → worker | reason, win, state | own `switcher.html` URL | `Number.isInteger(win)`, state allow-list | focus/un-minimise `win` | no | idempotent (focus twice) |
| postMessage `launch` | content script → iframe | token | `e.source === parent` (page shares it) | token must match storage | switcher boots | page can post guesses; capped at 5 | token is single-use |
| postMessage `ready`/`close` | iframe → content script | — | `e.source === frame.contentWindow` | string compare | show / remove overlay | page can't forge `e.source` | `cleanup()` is idempotent |
| `chrome.commands` | Chrome → worker | command name | Chrome | string compare | open/cycle | no | rate-limited |
| `tabs.onRemoved` in switcher | Chrome → switcher | tabId | Chrome | — | forget tab | no | idempotent (verified via code: no-op if not found) |

No custom DOM events, no ports, no `storage.onChanged` listeners.

---

## 5. Idempotency

| Operation | Twice → result | OK? |
|---|---|---|
| `hotkey.js` load (manifest + onInstalled inject) | live copy makes later copies no-ops; orphaned copy replaced | ✅ |
| `injectOverlay` on same tab | previous overlay cleaned up first | ✅ |
| `setup()` (onStartup + onInstalled) | `seedMru` only writes if empty | ✅ |
| Command + in-page fallback for one press | 120 ms dedupe | ✅ |
| `finish()` | `state.done` guard | ✅ |
| `closeTab` same entry twice | second `tabs.remove` throws → ignored | ✅ |
| Double-click a "Recently closed" window | **verified:** restored once, restored window focused | ✅ |
| `forgetTab` from both `closeTab` and `onRemoved` | second is a no-op | ✅ (see L6 for selection) |
| **Held Delete / ⌘⌫ (key repeat)** | **verified:** each repeat closes the next selected tab; ~0.4 s closed 2 tabs incl. the page Tabatha was opened from | ❌ **M1** |
| Held Enter (repeat) | `choose()` twice before `done`: same `tabs.update` twice; harmless | ✅ |
| Cancel → `restoreWindow` ×2 (0 ms, 250 ms) | intentional; see L8 | ⚠️ |

---

## 6. Concurrency

- **Serial queue is per context** (L5). Worker `createLaunch` and switcher `consumeLaunch` both touch `KEY.LAUNCH` without shared serialisation. Scenario: press #2 arrives after the 1.5 s opening lock while overlay #1 is still booting → #2 overwrites the token → #1 never boots (invisible, click-through orphan iframe until the page hides); or #1's `remove` deletes #2's token → #2 falls back to the popup via the watchdog. Needs a >1.5 s open; recovers on its own.
- **Capture vs overlay** (L3, plausible, NOT VERIFIED): `openSwitcher` waits at most 900 ms for the forced capture, then injects the overlay. If the capture is still in flight it can photograph the overlay and save it as that tab's preview ("switcher inside a thumbnail"). The post-capture check compares only tab id + URL.
- **Capture vs tab close** (L4): `savePreview` can land after `dropPreview` for a tab closed mid-capture → orphan preview until the 150-cap evicts it.
- **Close + onRemoved ordering** (L6, NOT VERIFIED): if `onRemoved` reaches the switcher before `closeTab` resumes, selection resets to the first card instead of the neighbour.
- `closeTab`'s delayed `loadClosed()` calls can resolve out of order (last-resolved wins); cosmetic.
- MRU/preview writes within the worker are serialised correctly.

---

## 7. Service worker lifecycle

- All listeners are registered synchronously at top level. ✅
- In-memory only: `opening`, `watchdog`, `lastTrigger`, capture `timers`, `lastCaptureAt`. Loss on restart means: queued presses lost; a pending watchdog lost (overlay that never boots stays invisible/click-through until the tab hides); a scheduled capture lost (tab shows "No preview yet"); the rate limit resets (Chrome's own limit throws → caught). None corrupts state.
- Authoritative state (MRU, previews, overlay flag, token) is in `storage.session` and survives worker restarts. ✅
- Browser restart: `storage.session` is empty; `onStartup` seeds MRU. ✅
- Extension update: `storage.session` is cleared on update/reload (Chrome documentation; **NOT VERIFIED** on a real store update). `onInstalled` seeds MRU and re-injects `hotkey.js`; orphaned copies detach themselves. An overlay open during an update would be orphaned; its content-script `visibilitychange` listener still cleans it up when the tab is hidden (NOT VERIFIED).

---

## 8. Tabs and windows

- Tab/window IDs are always re-used as given by Chrome and every privileged call is wrapped (`try/catch`, `.catch`, `allSettled`). A tab disappearing between read and act → the call throws → caught → `finish('cancel')` or ignored. ✅
- Special pages: `chrome://`, New Tab, Web Store, `file://` without access, PDF viewer, CSP `sandbox` pages → injection throws or never says READY → popup window (watchdog 2.5 s). ✅
- Incognito: extension not allowed there; capture also checks `win.incognito`. ✅
- Discarded tabs: shown as "Inactive" from `tab.discarded` (new). `executeScript` into discarded tabs on install fails → `allSettled`. ✅
- Frames: hotkey in all frames; overlay only in the top frame. ✅
- **Stale snapshot (L1):** the switcher reads tabs once. With tap-to-open it can stay open longer; titles, URLs, discarded state, window membership and new tabs aren't refreshed. If a tab moves to another window meanwhile, `choose()` activates it and then focuses its **old** `windowId` (wrong window, or throws → `finish('cancel')` → source window refocused). In practice, leaving the switcher (blur) closes it, so only background changes happen while it's open.

---

## 9. State and storage

| Key (`storage.session`) | Owner / writer | Readers | Cleanup | Bound |
|---|---|---|---|---|
| `mru` | worker (`touchMru`, `removeFromMru`, `replaceInMru`, `seedMru`) | worker, switcher | onRemoved | 500 ids |
| `p:<tabId>` + `pidx` | worker (`savePreview`, `movePreview`, `dropPreview`) | worker, switcher | onRemoved, age eviction | 150 previews, quota fallback drops half |
| `closed` | worker (`dropPreview keepAsClosed`) | switcher | 30 min TTL on read | 12 |
| `overlay` | worker | worker (capture) | onActivated, CLOSED, 10 min stale | 1 |
| `launch` | worker (`createLaunch`) | switcher (`consumeLaunch`) | consumed / 15 s TTL | 1 |

- No `storage.local`/`sync`. Nothing on disk.
- **Upgrade from 1.3.0:** no schema changes (only constants added); session storage is cleared on update anyway, so **no migration needed.**
- Quota (L9): 150 × ~30–60 KB thumbnails can approach the 10 MB session quota. `savePreview` handles quota errors; `touchMru`/`dropPreview` don't — their rejections go unhandled (logged "Uncaught (in promise)"), and the MRU order can lag until the next capture frees space.

---

## 10. Error handling

- Every Chrome call on an ephemeral ID is guarded. Most failures are silent (`catch {}`) by design; only `openSwitcher` and `choose` log (`e.message`, no URLs). ✅ for privacy, ⚠️ for debuggability (no way to tell from a user report what failed).
- Half-done operations: `choose()` → `tabs.update` succeeds, `windows.update` fails → `finish('cancel')` → source window refocused (the tab is active in its window but that window isn't focused). Rare.
- `dropPreview` does `remove` then `set`: if `set` fails, the index still lists the dropped tab until the next save cleans it (cleanIndex keeps it; eviction removes it). Self-heals.
- `setup()` rejections are unhandled (would only log).

---

## 11. Dependencies / supply chain

- Shipped code: **zero dependencies**, no bundler, no install scripts, no remote resources, no dynamic code. The zip was listed: only the 16 extension files.
- Dev tooling: `tools/screenshots` uses a globally installed Playwright and Python; not shipped; no lockfile in the repo. Not part of the security boundary.

---

## 12. Privacy

| | Capability | Actual behaviour (traced) |
|---|---|---|
| Page content | could read any page (`<all_urls>`) | reads none; the content script only looks at key events |
| Screenshots | any visible tab | 560 px JPEGs of the visible tab in normal windows, kept in `storage.session` (memory only), ≤150, deleted on tab close (closed-tab copies 30 min) |
| URLs/titles | all tabs | read when the switcher opens; not stored (except as a key for closed-tab previews) |
| Network | blocked for extension pages by CSP | none. The new **Buy Me a Coffee** button opens an external site in a new tab when clicked (a user navigation, not an extension request) |
| Logs | — | two `console.warn`s with Chrome error messages only |
| Telemetry | — | none |

Sensitive pages (banking, email) are screenshotted like any other page and shown in the switcher; they never leave the device. Anyone looking at (or screen-sharing) the screen while Tabatha is open sees them. This is inherent to the product and disclosed.

**Doc mismatch (L7):** PRIVACY.md and the store listing say the extension "is blocked from making any network requests at all" / "makes no network requests". Still true for the extension, but add one line about the optional coffee link so a reviewer doesn't read the external URL as a contradiction.

---

## 13. Performance

- Worker: listeners on activate/update/focus do a small query + one storage write + a debounced capture. Capture ≤ ~2/s. Fine.
- Switcher open: reads **all** previews for open tabs in one `storage.session.get` (up to ~6–9 MB with 150 thumbnails). On slow machines that plus render must beat the 2.5 s watchdog, or the overlay is replaced by the popup. NOT VERIFIED on low-end hardware.
- Every search keystroke rebuilds all cards (`replaceChildren`), fine for tens of tabs, heavier for hundreds.
- No intervals, no MutationObservers; one IntersectionObserver per switcher, which is destroyed with the page. Bounded collections everywhere.

---

## 14. Testing

There are **no automated tests in the repo.** The checks below were run ad hoc in this session (scripts in the session scratchpad, not committed):

Verified passing: tap opens and stays open · Option/Alt+key doesn't type · Mac-style Option+W with system text insertion doesn't type and cycles windows (old code reproduced the bug) · arrows+Enter switch · hold Alt + Q Q + release switches · typing searches · Esc exits · click outside exits · ⌘⌫ closes tab · closed windows capped at 2 · coffee opens BMC + closes · double-click closed window restores once.
Verified failing: held Delete closes several tabs (M1).

Concrete tests to add (`tests/` with Playwright + the unpacked extension):
1. Held Delete/⌘⌫ closes exactly one tab (M1 regression).
2. Page posts 6 fake `launch` messages → switcher falls back to popup, no crash.
3. Page loads `switcher.html` in its own iframe with no token → no DOM rendered, no listeners.
4. Page sets the overlay iframe to `opacity:0` → clicks ignored, Enter cancels.
5. Malformed runtime messages (`{}`, `{type:5}`, `{type:'tabatha:closed', win:'x'}`) → no throw, no action.
6. Corrupt `storage.session` values (wrong types, huge strings, non-JPEG data URL) → switcher renders, entries skipped.
7. Close a tab while the switcher is open → card disappears, selection goes to neighbour.
8. Move a tab to another window while open, then choose it → the right window gets focus (L1).
9. Kill the service worker (`chrome://serviceworker-internals` / CDP) mid-open → next Alt+Q works.
10. Quick double Alt+Q before READY → one switcher, selection moved once.
11. Recently closed older than 4 h is hidden (stub `lastModified`).
12. Page with `Content-Security-Policy: sandbox` → popup fallback.

---

## 15. Code quality

Real issues: the per-context queue in a shared module (L5); duplicated `MSG.HOTKEY` string (documented, low risk). The rest is clean: small modules, commented intent, validated boundaries. `switcher.js` (~660 lines) is the largest file and still readable; no refactor recommended.

---

## 16. Regression surface since the published 1.3.0

| Change | What it could break | Status |
|---|---|---|
| **Tap-to-open** (release commits only after a second Q while holding) | **Windows**: if releasing Alt moves focus to Chrome's ⋮ menu, the blur handler closes the switcher instantly → Alt+Q does nothing at all | **NOT VERIFIED on Windows → H1 / blocker** |
| Tap-to-open | Muscle memory: a quick Alt+Q flick no longer jumps to the previous tab | intended; say it in release notes (I1) |
| Tap-to-open | Switcher stays open longer → stale snapshot (L1), longer clickjacking window (guarded) | L1 |
| Option/Alt text block | Users who type characters with Option (e.g. `@` on German Mac layouts) or Windows Alt-codes can't type those into search | L2 |
| `isComposing` handling | IME users: Enter during composition still commits the composition (Alt shortcuts only are exempt) | verified by reading |
| ⌘⌫ close on Mac | With text in search, ⌘⌫ edits text (guarded by `typing`) | verified by reading |
| Recently-closed filter | Older entries hidden (intended); Chrome's own History menu still has them | OK |
| Window labels by window id | Numbering differs depending on which window you open from ("This window" changes) | OK / cosmetic |
| "Inactive" = `tab.discarded` | none; purely presentational | OK |
| Coffee button | Fixed position could cover the last row on small screens; bottom padding added | OK |
| Manifest | Version only; **no permission changes** → no re-consent prompt for users | OK |

---

## 17. Findings

| ID | Severity | Area | Finding | Exploit / failure scenario | Fix |
|---|---|---|---|---|---|
| H1 | HIGH (blocker until verified) | Regression / Windows | Tap-to-open has only been tested on macOS | Windows user taps Alt+Q → if Chrome focuses its menu on Alt release, `blur` → switcher closes immediately; Alt+Q becomes useless on the main platform | Test on Windows Chrome (overlay page, New Tab popup mode, hold-cycle, Esc, Alt+W). If it fails: ignore `blur` for ~300 ms after an Alt keyup, or keep focus via `preventDefault` on Alt keydown too |
| M1 | MEDIUM | Idempotency | Close key ignores key repeat | **Verified:** holding Delete/⌘⌫ for ~0.4 s closed 2 tabs incl. the page Tabatha was opened from (unsaved form data lost; tabs reopenable). Pre-existing since 1.3.0 | In `onKeyDown`: `if (closeKey && e.repeat) { e.preventDefault(); return; }` |
| L1 | LOW | Tab state | Switcher snapshot isn't refreshed while open; `choose()` uses a stale `windowId` | Tab moved/navigated while open → wrong window focused or stale title | In `choose()`, `const t = await chrome.tabs.get(id)` before acting; optionally refresh on `onUpdated`/`onAttached` |
| L2 | LOW | Regression / input | Search refuses all text while Option/Alt (without Ctrl) is held | Can't type Option-layer characters (e.g. `@` on German Mac) or Windows Alt-codes into search | Accept for now; or only block when `e.code` is `KeyQ`/`KeyW`/digit, or only while `state.holding` |
| L3 | LOW | Concurrency | Forced capture can outlive the 900 ms wait and photograph the overlay | Tab preview shows the Tabatha switcher (plausible, NOT VERIFIED) | Set the overlay flag before starting the forced capture, or re-check `isOverlayTab` right after `captureVisibleTab` |
| L4 | LOW | Concurrency | Preview saved after its tab was closed | Orphan preview until evicted by the 150 cap | In `savePreview`, skip if `chrome.tabs.get(tabId)` fails |
| L5 | LOW | Concurrency | `store.js` queue is per context; worker writes the launch token while the switcher consumes it | Second open >1.5 s after the first: first overlay never boots (invisible orphan) or second falls back to popup | Make `consumeLaunch` compare-and-remove by token (re-read and only remove if unchanged), or move token consumption into the worker via a message |
| L6 | LOW | Concurrency | Selection after close depends on event ordering | Selection jumps to the first card instead of the neighbour (NOT VERIFIED) | Remember `keepKey` in `closeTab` before awaiting, and pass it through `onRemoved` handling |
| L7 | LOW | Privacy docs | "No network requests" wording vs. new external link | Reviewer or user reads the BMC URL as a contradiction | Add to PRIVACY.md + listing: "An optional Buy Me a Coffee button opens buymeacoffee.com in a new tab when you click it; nothing is sent." |
| L8 | LOW | Focus | Cancel refocuses the source window twice (0 ms and 250 ms) on every platform | User clicks outside, then quickly clicks another window/app → pulled back | Do the 250 ms retry only on Windows, or only when the window is minimised |
| L9 | LOW | Storage | MRU/closed-preview writes don't handle quota errors | Near 10 MB: unhandled rejection, MRU order lags until the next capture frees space | Evict by total bytes (e.g. 7 MB budget) instead of count, or catch + evict in `touchMru` |
| L10 | LOW | Clickjacking | 800 ms key grace before visibility is known | Hostile page hides the overlay from the start; user presses Delete within 0.8 s → preselected tab closes. Contrived; pre-existing | Exclude the close key from the grace (`acts` for Delete should require `visibleSince > 0`) |
| I1 | INFO | UX | Quick Alt+Q flick no longer returns to the previous tab | Existing users notice a behaviour change | Say it in the release notes |
| I2 | INFO | Testing | No automated tests in the repo | Regressions like M1 go unnoticed | Commit the Playwright checks + §14 list |
| I3 | INFO | Privacy | Page can see the overlay while open (DOM + per-session dynamic URL) | Page learns the user has Tabatha and when it's open | Inherent to an in-page overlay; accept |
| I4 | INFO | Accessibility | Coffee button isn't reachable by keyboard (Tab cycles cards) | Keyboard-only users can't reach it | Optional |
| I5 | INFO | Maintainability | `hotkey.js` duplicates `MSG.HOTKEY` | Rename drift | Keep the comment; add a test |

---

## 18. Release blockers

**Release blockers**
1. **H1: verify tap-to-open on Windows.**
   - *Why:* Windows is where the Alt+Tab-style design came from and where most users are. If the switcher closes on Alt release there, the main shortcut does nothing, which is worse than 1.3.0.
   - *Component:* `switcher.js` `onKeyUp` + `blur` handler, on Windows Chrome.
   - *Required:* run the checks; code fix only if it fails.
   - *Verify:* on Windows 10/11 + Chrome stable: tap Alt+Q on an https page → stays open; on the New Tab page (popup window) → stays open; hold Alt, Q, Q, release → switches; Esc → closes, window not minimised; Alt+W with 2 windows.

**Non-blocking fixes (recommended for this release: small and safe)**
- M1 key-repeat guard (one line).
- L7 privacy/listing wording.
- L10 exclude Delete from the key grace.

**Next release**
- L1, L3, L4, L5, L6, L8, L9, L2 (decide), I2 tests.

**Technical debt**
- Shared-module queue across contexts (L5); byte-based preview budget (L9); lazy preview loading on open.

---

## 19. CTO audit summary

| Area | Result | Evidence |
|---|---|---|
| Architecture | PASS | Clear components, validated boundaries, state in session storage |
| Security | PASS | No attacker-controlled sink; only page-reachable action is "open switcher" |
| Chrome extension security | PASS | Minimal, justified permissions; strict CSP; token-gated WAR; no remote code |
| Idempotency | NEEDS WORK | M1 verified |
| Concurrency | PASS | Only low-impact races (L3–L6), all self-healing |
| State management | PASS | Bounded, validated, no migration needed |
| Error recovery | PASS | Every ephemeral call guarded; minor unhandled rejections (L9) |
| Privacy | PASS | Nothing leaves the device; doc wording update (L7) |
| Performance | PASS | Bounded; heavy open with many previews (not verified on low-end) |
| Maintainability | NEEDS WORK | No automated tests (I2) |
| Regression risk | NEEDS WORK | H1 unverified on Windows |

**Release blockers:** 1 (H1, verification) · **High:** 1 · **Medium:** 1 · **Low:** 10 · **Info:** 5

**Recommended release status: RELEASE AFTER FIXES.** Security is sound; nothing exploitable was found. What stands between this build and the store is one unverified platform (Windows tap-to-open), plus a one-line fix for held Delete closing several tabs, which is recommended rather than required.
