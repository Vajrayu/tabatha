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
  PREVIEW_INDEX: 'pidx',      // { [tabId]: capturedAt }
  CLOSED_PREVIEWS: 'closed',  // [{ url, img, t }] previews of recently closed tabs
  OVERLAY: 'overlay',         // { tabId, t } tab currently covered by the overlay
  LAUNCH: 'launch',           // { token, t, ctx } one-time launch for the next switcher
});

export const previewKey = (tabId) => 'p:' + tabId;
export const PREVIEW_PREFIX = 'data:image/jpeg;base64,';

export const WINDOW_STATES = Object.freeze(['normal', 'maximized', 'fullscreen']);
export const MODES = Object.freeze(['overlay', 'window']);
export const CLOSE_REASONS = Object.freeze(['cancel', 'switch', 'restore', 'blur']);

export const LIMITS = Object.freeze({
  THUMB_MAX: 560,               // px, longest side of a stored thumbnail
  MAX_PREVIEWS: 150,            // keeps storage.session (10 MB) comfortably under quota
  MAX_CLOSED_PREVIEWS: 12,
  CLOSED_PREVIEW_TTL_MS: 30 * 60 * 1000, // screenshots of closed tabs are forgotten after 30 min
  MAX_MRU: 500,
  CAPTURE_GAP_MS: 520,          // Chrome allows ~2 captureVisibleTab calls per second
  LAUNCH_TTL_MS: 15000,         // how long a launch token stays valid
  OPENING_LOCK_MS: 1500,        // presses during this window are queued, not re-opened
  OVERLAY_WATCHDOG_MS: 2500,    // no READY by then -> overlay failed, use the popup window
  POINTER_VISIBLE_MS: 300,      // overlay must be fully visible this long before clicks count
  KEYS_GRACE_MS: 800,           // keys work right away (quick Alt+Q flick) until visibility is known
  LAUNCH_WAIT_MS: 5000,         // how long an overlay waits for its launch token
  RECENTLY_CLOSED: 8,
});

export const SWITCHER_PAGE = 'switcher.html';
