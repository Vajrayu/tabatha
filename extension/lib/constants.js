// Shared names and limits used by the background worker and the switcher UI.
// (hotkey.js is a classic content script and can't import this, so it
// repeats MSG.HOTKEY as a string literal. Keep them in sync.)

export const MSG = Object.freeze({
  HOTKEY: 'tabatha:hotkey', // content script -> background: user pressed Alt+Q in a page
  CYCLE: 'tabatha:cycle',   // background -> open switcher: move selection
  READY: 'tabatha:ready',   // switcher -> background: UI loaded, send queued moves
  CLOSED: 'tabatha:closed', // switcher -> background: UI closed (with reason)
});

// Messages between the overlay iframe and the content-script code that hosts it.
export const FRAME_MSG = Object.freeze({ LAUNCH: 'launch', READY: 'ready', CLOSE: 'close' });

export const KEY = Object.freeze({
  MRU: 'mru',                 // number[] tab ids, most recent first
  BOOT_AT: 'bootAt',          // storage.session: when this browser session started (set on onStartup)
  PREVIEW_CLEAN: 'pvclean',   // storage.local: when preview cleanup last ran
  SLEPT: 'slept',             // storage.session: number[] ids of tabs we saw Chrome discard in this browser session
  CLOSED_LOG: 'closedlog',    // storage.local: [{ url, title, favIconUrl, closedAt }] tabs closed in the last 7 days
  PREVIEW_INDEX: 'pvidx',     // storage.local: { [normalizedUrl]: { t, n, s } } captured-at, size, and when an open tab last had this URL
  OVERLAY: 'overlay',         // { tabId, t } tab currently covered by the overlay
  LAUNCH: 'launch',           // { token, t, ctx } one-time launch for the next switcher
});

export const previewKey = (url) => 'pv:' + url; // storage.local, `url` already normalized
export const tabMetaKey = (tabId) => 'm:' + tabId; // storage.session: { u, ti, f } last known url/title/icon of an open tab
export const PREVIEW_PREFIX = 'data:image/jpeg;base64,';

export const WINDOW_STATES = Object.freeze(['normal', 'maximized', 'fullscreen']);
export const MODES = Object.freeze(['overlay', 'window']);
export const CLOSE_REASONS = Object.freeze(['cancel', 'switch', 'restore', 'blur']);

export const LIMITS = Object.freeze({
  THUMB_MAX: 560,               // px, longest side of a stored thumbnail
  MAX_PREVIEWS: 300,            // most previews kept on disk (storage.local)
  MAX_PREVIEW_BYTES: 6 * 1024 * 1024, // ...and in total, well under storage.local's 10 MB quota
  PREVIEW_TTL_MS: 7 * 24 * 60 * 60 * 1000, // a preview no open tab uses is deleted 7 days after it was last captured or used
  CLEANUP_EVERY_MS: 6 * 60 * 60 * 1000,    // preview cleanup runs at most this often (from the save path, no alarms permission)
  CLEANUP_BOOT_DELAY_MS: 60 * 1000,        // ...and not in the first minute after browser start, while Chrome is still restoring tabs
  MAX_SLEPT: 2000,              // most discarded-tab ids remembered
  MAX_URL_KEY: 2048,            // longer URLs are not used as preview keys
  CLOSED_LOG_TTL_MS: 7 * 24 * 60 * 60 * 1000, // our own closed-tab log keeps 7 days
  MAX_CLOSED_LOG: 200,          // ...and at most this many entries
  CLOSED_PREVIEW_LOOKUP: 60,    // previews are looked up for the newest this-many closed entries
  MAX_MRU: 500,
  CAPTURE_GAP_MS: 520,          // Chrome allows ~2 captureVisibleTab calls per second
  LAUNCH_TTL_MS: 15000,         // how long a launch token stays valid
  OPENING_LOCK_MS: 1500,        // presses during this window are queued, not re-opened
  OVERLAY_WATCHDOG_MS: 2500,    // no READY by then -> overlay failed, use the popup window
  POINTER_VISIBLE_MS: 300,      // overlay must be fully visible this long before clicks count
  KEYS_GRACE_MS: 800,           // keys work right away (quick Alt+Q flick) until visibility is known
  LAUNCH_WAIT_MS: 5000,         // how long an overlay waits for its launch token
  RECENTLY_CLOSED: 8,           // most "Recently closed" entries shown
  RECENTLY_CLOSED_SEARCH: 24,   // ...or this many while searching (search reaches the whole 7-day log)
  RECENTLY_CLOSED_WINDOWS: 2,   // of which at most this many whole windows
  RECENTLY_CLOSED_MAX_AGE_S: 4 * 3600, // only things closed in the last 4 hours
});

export const SWITCHER_PAGE = 'switcher.html';
export const COFFEE_URL = 'https://buymeacoffee.com/vey9utb';
