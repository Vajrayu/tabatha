// Shared names and limits used by the background worker and the switcher UI.
import { uiLang } from './i18n.js';
// (hotkey.js is a classic content script and can't import this, so it
// repeats MSG.HOTKEY as a string literal. Keep them in sync.)

export const MSG = Object.freeze({
  HOTKEY: 'tabatha:hotkey', // content script -> background: user pressed Alt+Q in a page
  CYCLE: 'tabatha:cycle',   // background -> open switcher: move selection
  READY: 'tabatha:ready',   // switcher -> background: UI loaded, send queued moves
  CLOSED: 'tabatha:closed', // switcher -> background: UI closed (with reason)
  GROUPS: 'tabatha:groups', // switcher -> background: sync saved tab groups now
  SWEEP: 'tabatha:sweep',   // switcher -> background: capture previews of every tab now
  SWEEP_CANCEL: 'tabatha:sweep-cancel', // sweep window -> background
  CAPTURE_ONE: 'tabatha:capture-one', // switcher -> background: show one tab for a moment and capture it
  FLYOUT_DONE: 'tabatha:flyout-done', // first-run flyout dismissed (content script -> background)
  NUDGE: 'tabatha:nudge',   // "use Alt+Q" toast answered (content script -> background): { act: 'try'|'ok'|'never' }
  SLEEP: 'tabatha:sleep',   // switcher -> background, as it closes: unload these tabs ({ tabIds })
  TO_WINDOW: 'tabatha:to-window', // switcher -> background: the page hides or covers the overlay, open Tabatha as a window instead
  CLOSE_HERE: 'tabatha:close-here', // switcher -> background: close the tab the overlay sits on, then open Tabatha over `next`
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
  GROUPS: 'groups',           // storage.local: saved tab groups [{ id, title, color, tabs:[{u,ti}], t, cid, open }]
  ONBOARD: 'onb',             // storage.local: { at, flyout, tour } first-run flags
  REVIEW: 'rv',               // storage.local: { since, opens, soft, lastSoft, asks, lastAsk, done } review-prompt counters (never sent anywhere)
  CAPDIAG: 'capdiag',         // storage.session: { t, stage, msg, host } outcome of the last preview attempt
  SWEEP: 'sweep',             // storage.session: { running, done, total } progress of "Capture all previews"
  STARS: 'stars',             // storage.local: { [normalizedUrl]: { u, ti, t } } pages the user starred
  VIEW: 'view',               // storage.local: { sort, collapsed: string[], panel, ptab, folder } how the switcher lays tabs out
  NUDGE: 'nudge',             // storage.local: { day, runs, shown, last, never } the "use Alt+Q" nudge (never sent anywhere)
  LAST_OPEN: 'lastOpen',      // storage.session: when the switcher last opened
  PREFS: 'prefs',             // storage.local: { lang: 'auto'|'en'|'ru'|'es', startup: boolean } Settings
  PEEK: 'peek',               // storage.local: the day Y-bit last peeked from behind the corner buttons
  SHORTCUT_LATER: 'scLater',  // storage.local: when the user said "Not now" to the Alt+Q-isn't-set note
  WN_FROM: 'wnFrom',          // storage.local: the version Tabatha was updated from, until its walkthrough has been shown (the oldest, if several updates came first)
  SWEPT: 'swept',             // storage.session: { n, t } how many previews the last capture run took, for the "Done" note when Tabatha reopens
  NOCAP: 'nocap',             // storage.session: normalized URLs Chrome refused to screenshot (the Web Store, some built-in pages)
  COVERED: 'covered',         // storage.session: origins where a page filtered or covered the overlay; Tabatha opens as a window there
  RESUME: 'resume',           // storage.session: { t, query, scope, sort, starred, key } reopen the switcher where it was (after a one-tab capture)
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
  VISIBLE_CONFIRM_MS: 1200,     // ...and if Chrome hasn't confirmed it visible by then, Tabatha moves into its own window
  KEYS_GRACE_MS: 800,           // keys work right away (quick Alt+Q flick) until visibility is known
  LAUNCH_WAIT_MS: 5000,         // how long an overlay waits for its launch token
  RECENTLY_CLOSED: 8,           // most "Recently closed" entries shown
  RECENTLY_CLOSED_SEARCH: 24,   // ...or this many while searching (search reaches the whole 7-day log)
  RECENTLY_CLOSED_WINDOWS: 2,   // of which at most this many whole windows
  RECENTLY_CLOSED_MAX_AGE_S: 4 * 3600, // only things closed in the last 4 hours
  MAX_SAVED_GROUPS: 100,        // saved tab groups kept (closed ones are only ever removed by the user, or beyond this cap, oldest first)
  MAX_GROUP_TABS: 100,          // tabs remembered per group
  MAX_GROUPS_BYTES: 2 * 1024 * 1024, // saved groups stay well inside storage.local's 10 MB (previews have 6 MB): over this, the oldest closed groups go
  GROUP_SYNC_MS: 600,           // tab/group events are batched; a burst (closing a window) becomes one sync
  GROUP_TITLE_MAX: 120,
  MAX_STARS: 300,               // most starred pages kept (their previews are kept like an open tab's)
  MAX_COLLAPSED: 200,           // most collapsed sections remembered
  RESUME_TTL_MS: 15000,         // a resume note older than this is ignored
  SWEEP_MAX_IDS: 5000,          // sanity limit on the tab ids one capture run is sent (the user chooses how many; no cap below that)
  SWEEP_STALE_MS: 6 * 60 * 60 * 1000, // tabs whose preview is newer than this are skipped
  SWEEP_PAINT_MS: 300,         // wait after a tab finishes loading, so the screenshot isn't blank
  SWEEP_LOAD_MS: 2500,         // ...and give up waiting for a slow page after this long
  FLYOUT_WINDOW_MS: 30 * 60 * 1000, // the first-run flyout is offered for this long after install
  FLYOUT_SHOW_MS: 20000,        // ...and stays on a page this long unless dismissed
  STARTUP_OPEN_MS: 3500,        // "Open Tabatha when Chrome starts" waits this long for Chrome to restore the tabs
  MAX_BOOKMARKS_SHOWN: 400,     // bookmarks drawn in the panel at once (search narrows the rest)
});

// The "use Alt+Q" nudge: Chrome never tells extensions about Ctrl+Tab, so a run of quick
// next/previous-tab switches is what it looks for. Counted on this device only.
export const NUDGE = Object.freeze({
  STEP_MS: 1500,                // a step is a switch to the tab right next to the last one, this soon after it
  RUN_STEPS: 3,                 // ...and this many steps in a row make a "run"
  SETTLE_MS: 900,               // the note waits until the switching has stopped this long
  QUIET_AFTER_EVENT_MS: 400,    // switches right after a tab was opened or closed don't count (Chrome picks the neighbour)
  RUNS_BEFORE: 2,               // shown on the second run of a day, not the first
  GAP_MS: 24 * 3600 * 1000,     // at most once a day
  MAX: 3,                       // and three times ever
  AFTER_USE_MS: 10 * 60 * 1000, // never within 10 minutes of opening Tabatha
  HABIT_OPENS: 30,              // after this many opens the habit is there: stop for good
  SHOW_MS: 12000,
});

// "How is Tabatha working for you?" timing. Counted on this device only (storage.local), same rules for everyone.
export const REVIEW = Object.freeze({
  ASK_AFTER_OPENS: 15,          // not before this many switcher opens...
  ASK_AFTER_MS: 3 * 24 * 3600 * 1000,  // ...and this long after install
  ASK_GAP_MS: 14 * 24 * 3600 * 1000,   // at most one ask per this long
  ASK_MAX: 2,                   // then never again
});

export const REVIEW_URL = 'https://chromewebstore.google.com/detail/edjglhlabdmgacehahfdjjffapbkaekk/reviews?utm_source=extension';
// The website (tabatha-vert.vercel.app). Links only: the extension never sends anything there itself.
export const SITE_URL = 'https://tabatha-vert.vercel.app';
export const HELP_URL = SITE_URL + '/manual';
const VERSION = chrome.runtime.getManifest().version;
// Pages on the site that Tabatha opens. Only where the click came from, the version and the
// language go in the URL; whatever people write is typed on the page itself, never put in a link.
// The language is the one Tabatha is shown in (its own setting, see lib/i18n.js), read at the moment of the click.
export const siteUrl = (path, from, extra = '') => `${SITE_URL}${path}?from=${from}&v=${VERSION}&lang=${uiLang()}${extra}`;
// "Send feedback" opens the site's feedback form; `from` and the version are prefilled from the URL.
export const feedbackUrl = () => siteUrl('/feedback', 'extension');
// Chrome opens this after someone removes Tabatha (chrome.runtime.setUninstallURL). Nothing is sent by the removal itself.
export const uninstallUrl = () => siteUrl('/uninstall', 'uninstall');
// One switch for the Buy Me a Coffee button, one for the Pro waitlist button.
export const SHOW_COFFEE = true;
export const SHOW_PRO = true;

export const SWITCHER_PAGE = 'switcher.html';
export const SWEEP_PAGE = 'sweep.html';
export const COFFEE_URL = 'https://buymeacoffee.com/vey9utb';
