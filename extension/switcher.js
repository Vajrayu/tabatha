// Tabatha switcher UI. Runs as an extension page, either in an iframe on
// top of the current web page (mode "overlay") or in a small popup window on
// pages extensions can't touch (mode "window").
//
// Data flow: load() reads tabs/windows/sessions + stored previews once ->
// derive() builds the visible, selectable `entries` from state + filters ->
// render() draws them. Every user action updates state and calls refresh().
//
// Security: in overlay mode this page is embedded in an untrusted web page.
// The page can't read our DOM or storage, but it CAN see and restyle the
// <iframe> element (e.g. make it invisible and trick you into clicking). So:
//   - nothing runs until the one-time launch token checks out. In a popup
//     window it's in our URL; in an overlay it arrives by postMessage from
//     the content script, so the page never sees it;
//   - mouse clicks only count while the overlay is fully visible and
//     unobstructed (IntersectionObserver v2); if the page hides or covers it,
//     action keys close it instead of acting on something you can't see;
//   - all page-provided text (titles, URLs) is rendered with textContent.

import { MSG, KEY, FRAME_MSG, LIMITS, COFFEE_URL, REVIEW_URL, feedbackUrl, HELP_URL, SHOW_COFFEE, SHOW_PRO, siteUrl } from './lib/constants.js';
import { ybit } from './lib/ybit.js';
import { getNoCapture, getMru, getPreviews, getClosedLog, getSlept, consumeLaunch, updateReview, getOnboard, updateOnboard, getCaptureNote, getStars, toggleStar, getView, updateView, setResume, takeResume, getPrefs, updatePrefs, getWnFrom, clearWnFrom, takeSwept, getWinNames, setWinName } from './lib/store.js';
import { reviewPrompt, dayOf } from './lib/review.js';
import { t, tn, timeAgo, localizePage, loadLang, setLang } from './lib/i18n.js';
import * as marks from './lib/bookmarks.js';
import { hasGroupsApi, syncGroups, getSavedGroups, removeSavedGroup, reopenGroup, updateSavedGroup, recordFor, GROUP_COLORS } from './lib/groups.js';
import { isOwnUrl, normalizeUrl, isWorthReopening, isCapturableUrl, cmpVersion } from './lib/ext.js';

let CTX = null; // set once the launch token has been verified (see boot)

const $ = (id) => document.getElementById(id);
const el = {
  app: $('app'), bar: document.querySelector('.bar'), search: $('search'), count: $('count'),
  wins: $('wins'), tools: $('tools'), scroller: $('scroller'), newtab: $('newtab'),
  starFilter: $('star-filter'), starN: $('star-n'), sort: $('sort'), sweepText: $('sweep-text'), closedH: $('closed-h'),
  openGrid: $('open-grid'), openEmpty: $('open-empty'),
  closedSection: $('closed-section'), closedGrid: $('closed-grid'),
  winHint: $('hint-win'), coffee: $('coffee'), pro: $('pro'),
  feedbackBtn: $('feedback-btn'), helpBtn: $('help-btn'), tourBtn: $('tour-btn'), groupsBtn: $('groups-btn'), sweepBtn: $('sweep-btn'),
  dupesBtn: $('dupes-btn'), dupesText: $('dupes-text'),
  alert: $('alert'), alertText: $('alert-text'), alertBtn: $('alert-btn'), alertLater: $('alert-later'),
  acts: $('acts'), actsN: $('acts-n'), actsBtns: $('acts-btns'), selAll: $('sel-all'), selNone: $('sel-none'),
  body: $('body'), panel: $('panel'), panelBtn: $('panel-btn'), panelClose: $('panel-close'),
  paneGroups: $('pane-groups'), paneMarks: $('pane-marks'), ptabGroupsN: $('ptab-groups-n'),
  toast: $('toast'), clip: $('clip'), peek: $('peek'), modal: $('modal'), dialog: $('dialog'),
};
const GROUP_HEX = { grey: '#9aa0a6', blue: '#8ab4f8', red: '#f28b82', yellow: '#fdd663', green: '#81c995', pink: '#ff8bcb', purple: '#c58af9', cyan: '#78d9ec', orange: '#fcad70' };

// Mac keyboards: Option instead of Alt, and the "delete" key is Backspace.
const IS_MAC = /mac/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '');

// -------------------------------------------------------------------- state
const state = {
  capLater: () => {}, // what Esc does while the capture card is open (the same as its "Later")
  tabs: [],        // chrome.tabs.Tab[], most recently used first
  previews: {},    // tabId -> { img, url, t }
  closed: [],      // every closed tab/window we know of, newest first: [{ id, kind: 'tab'|'window', url, title, ts, count, session, fields, preview }]
  windows: [],     // [{ id, label, count, activeTitle }]
  scope: 'all',    // 'all' or a windowId
  query: '',
  entries: [],     // derived: [{ kind: 'tab'|'closed', key, tab?, item?, preview }]
  openCount: 0,
  sel: 0,
  holding: true,   // Alt still held since the shortcut that opened us?
  cycled: false,   // Q pressed again while holding: releasing Alt then switches
  done: false,
  mouseReady: false,
  cardW: 320,      // current open-card width (px), set by render()
  slept: new Set(), // ids of tabs we saw Chrome discard in this browser session
  groupsOn: false, // is the optional tabGroups permission granted?
  groupInfo: new Map(), // live Chrome tab groups: id -> { title, color }
  saved: [],       // saved tab groups that are closed right now, newest first
  sections: [],    // derived: [{ key, group: {title,color}|null, entries }] for the open tabs
  mruOrder: [],    // derived: open entries in most-recently-used order (what Alt+Q cycles through)
  savedCount: 0,
  hostOk: true,   // does Tabatha have access to all sites (not withheld by Chrome's Site access setting)?
  armed: null,     // key of a saved group waiting for a second Delete / click on x
  modal: null,     // 'tour' | 'ask' while a dialog is open
  sort: 'recent',  // 'recent' | 'newest' | 'oldest' | 'name' (Alt+Q always cycles by recent use)
  group: 'groups', // sections: 'groups' (Chrome tab groups) | 'site' | 'recent' (last used) | 'none'
  starOnly: false, // the Starred filter is on
  stars: {},       // normalized URL -> { u, ti, t } starred pages
  collapsed: new Set(), // section keys the user collapsed (kept between opens)
  peek: new Set(),      // collapsed sections opened for this visit only (Alt+Q landed on a tab inside)
  capturing: null,      // tab id whose preview is being captured from its card
  starPreviews: {},     // normalized URL -> preview, for starred pages that aren't open
  matchCount: 0,        // open tabs that match the filters, collapsed or not
  picked: new Set(),    // tab ids ticked for a quick action (close, copy, bookmark, move...)
  lastPick: null,       // the last card ticked, for Shift+click ranges
  panel: false,         // the right panel (saved groups, bookmarks) is open
  ptab: 'groups',       // 'groups' | 'marks'
  folder: '',           // last bookmark folder used (id)
  marksOn: false,       // is the optional bookmarks permission granted?
  tree: null,           // bookmark folders and bookmarks (lib/bookmarks.js), when marksOn
  editing: null,        // bookmark id being edited in the panel
  openFolders: new Set(['1']), // bookmark folder ids expanded in the panel (the bookmarks bar starts open)
  newFolder: null,      // id of a folder just made with "New folder": Cancel removes it again
  nocap: new Set(),     // pages Chrome refused to screenshot: no "Capture preview" there
  toSleep: new Set(),   // tab ids to unload when the switcher closes
  dupesView: false,     // showing only the duplicate copies, before closing them
  gorder: [],           // order of saved groups in the panel (ids), as the user dragged them
  matches: [],          // derived: the open tabs the filters let through
};

// ---------------------------------------------------------------- icons
const ICON = {
  moon: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M13.5 10.2A5.8 5.8 0 0 1 5.8 2.5a5.8 5.8 0 1 0 7.7 7.7Z" fill="currentColor"/></svg>',
  history: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v2.8h2.8M8 5v3.2l2.2 1.4" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  speaker: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 6h2.5L8 3v10L4.5 10H2z" fill="currentColor"/><path d="M10.5 5.5a3.5 3.5 0 0 1 0 5M12.3 3.8a6 6 0 0 1 0 8.4" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  camera: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M2.5 5.5h2.2l1.2-1.8h4.2l1.2 1.8h2.2v7h-11z" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/><circle cx="8" cy="8.8" r="2" stroke="currentColor" stroke-width="1.3" fill="none"/></svg>',
  window: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M2 6h12" stroke="currentColor" stroke-width="1.3"/></svg>',
  star: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" fill="var(--star-fill, none)"/></svg>',
  chevron: '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  windows: '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><rect x="1.5" y="4" width="9" height="8" rx="1.3" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M5.5 4V2.8a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v6.4a1 1 0 0 1-1 1h-3" stroke="currentColor" stroke-width="1.3" fill="none"/></svg>',
  more: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="3.5" cy="8" r="1.4" fill="currentColor"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/><circle cx="12.5" cy="8" r="1.4" fill="currentColor"/></svg>',
  grip: '<svg viewBox="0 0 16 16" width="10" height="14" aria-hidden="true"><g fill="currentColor"><circle cx="5" cy="4" r="1.2"/><circle cx="11" cy="4" r="1.2"/><circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/><circle cx="5" cy="12" r="1.2"/><circle cx="11" cy="12" r="1.2"/></g></svg>',
  check: '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  link: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M6.8 9.2a2.8 2.8 0 0 0 4 0l2-2a2.8 2.8 0 0 0-4-4l-.8.8M9.2 6.8a2.8 2.8 0 0 0-4 0l-2 2a2.8 2.8 0 0 0 4 4l.8-.8" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>',
  md: '<svg viewBox="0 0 16 16" width="15" height="13" aria-hidden="true"><rect x="1" y="3.5" width="14" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M3.5 10V6l1.8 2 1.8-2v4M10.5 6v4M9 8.5l1.5 1.5L12 8.5" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linejoin="round"/></svg>',
  bookmark: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M4 2.5h8v11l-4-3-4 3z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/></svg>',
  group: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><rect x="1.5" y="3" width="13" height="10" rx="2" stroke="currentColor" stroke-width="1.3" fill="none" stroke-dasharray="2.5 1.6"/><rect x="4" y="6" width="8" height="4" rx="1" fill="currentColor"/></svg>',
  pin: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M6 2.5h4l-.6 4 2.6 2.5H4l2.6-2.5zM8 9v4.5" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  muted: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 6h2.5L8 3v10L4.5 10H2z" fill="currentColor"/><path d="M10.5 6l4 4M14.5 6l-4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  folder: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M1.5 4.5a1 1 0 0 1 1-1h3.3l1.5 1.5h6.2a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/></svg>',
  plus: '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  edit: '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M10.5 2.5l3 3-8 8H2.5v-3z" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/></svg>',
  out: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M9 2.5h4.5V7M13.5 2.5L7.5 8.5M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trash: '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  crown: '<svg viewBox="0 0 12 12" width="16" height="16" shape-rendering="crispEdges" aria-hidden="true"><g fill="#1B2A4A"><rect x="5" y="0" width="2" height="2"/><rect x="4" y="2" width="4" height="2"/><rect x="0" y="4" width="12" height="2"/><rect x="2" y="6" width="8" height="2"/><rect x="2" y="8" width="3" height="2"/><rect x="7" y="8" width="3" height="2"/><rect x="1" y="10" width="2" height="2"/><rect x="9" y="10" width="2" height="2"/></g></svg>',
};

// ---------------------------------------------------------------- helpers
const urlOf = (tab) => (tab && (tab.url || tab.pendingUrl)) || '';
const favicon = (url) => chrome.runtime.getURL('/_favicon/') + '?pageUrl=' + encodeURIComponent(url) + '&size=32';
function hostOf(url) {
  try { const u = new URL(url); return u.host || u.protocol.replace(':', ''); } catch { return ''; }
}
function h(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}

// ------------------------------------------------------------------- data
async function load() {
  const [allTabs, mru, slept] = await Promise.all([
    chrome.tabs.query({ windowType: 'normal' }),
    getMru(),
    getSlept().catch(() => []),
  ]);
  state.slept = new Set(slept);
  state.nocap = await getNoCapture().catch(() => new Set());
  const [stars, view] = await Promise.all([getStars().catch(() => ({})), getView().catch(() => null)]);
  state.stars = stars;
  if (view) {
    state.sort = view.sort;
    state.group = view.group;
    state.collapsed = new Set(view.collapsed);
    state.folder = view.folder;
    state.gorder = view.gorder;
    state.ptab = view.ptab;
    // The panel opens by itself on wide screens until the user has chosen (closing it is remembered).
    state.panel = view.panel === null ? window.innerWidth >= 1280 : view.panel;
  }
  const tabs = allTabs.filter((t) => !isOwnUrl(urlOf(t)));

  const rank = new Map(mru.map((id, i) => [id, i]));
  const r = (t) => (t.id === CTX.srcTab ? -1 : rank.has(t.id) ? rank.get(t.id) : Infinity);
  const inSrc = (t) => (t.windowId === CTX.srcWin ? 0 : 1);
  tabs.sort((a, b) => r(a) - r(b) || inSrc(a) - inSrc(b) || a.windowId - b.windowId || a.index - b.index);
  state.tabs = tabs;

  // Previews are stored by URL; hand each tab the one for its current URL.
  const byUrl = await getPreviews(tabs.map(urlOf));
  state.previews = {};
  for (const t of tabs) {
    const p = byUrl[normalizeUrl(urlOf(t))];
    if (p) state.previews[t.id] = p;
  }

  // Windows in "most recently used" order, the current one first. Numbers
  // follow the order the windows were opened in, so "Window 2" stays
  // "Window 2" however you move between them.
  const names = await getWinNames().catch(() => ({})); // names you gave windows (until Chrome quits)
  const order = [CTX.srcWin];
  for (const t of tabs) if (!order.includes(t.windowId)) order.push(t.windowId);
  const byAge = order.filter((id) => id !== CTX.srcWin).sort((a, b) => a - b);
  state.windows = order
    .map((id) => {
      const wt = tabs.filter((t) => t.windowId === id);
      const active = wt.find((t) => t.active) || wt[0];
      return {
        id,
        label: names[id] || (id === CTX.srcWin ? t('thisWindow') : t('windowN', byAge.indexOf(id) + 2)),
        named: !!names[id],
        count: wt.length,
        activeTitle: active ? active.title || '' : '',
        activeId: active ? active.id : null,
        activeUrl: active ? urlOf(active) : '',
      };
    })
    .filter((w) => w.count > 0);

  await loadGroups();
  await loadClosed();
  await loadStarPreviews();
  await loadMarks();
}

// Previews of starred pages that no tab has open (shown under the Starred filter).
async function loadStarPreviews() {
  const open = new Set(state.tabs.map((t) => normalizeUrl(urlOf(t))));
  const urls = Object.entries(state.stars).filter(([k]) => !open.has(k)).map(([, st]) => st.u).slice(0, LIMITS.CLOSED_PREVIEW_LOOKUP);
  state.starPreviews = await getPreviews(urls).catch(() => ({}));
}

// Tab groups need the optional tabGroups permission (granted from the footer link or the tour).
async function loadGroups() {
  state.groupsOn = hasGroupsApi();
  state.groupInfo = new Map();
  state.saved = [];
  if (!state.groupsOn) return;
  try {
    await Promise.race([syncGroups(), new Promise((r) => setTimeout(r, 400))]); // make the saved copies current
    const [live, saved] = await Promise.all([chrome.tabGroups.query({}), getSavedGroups()]);
    live.forEach((g) => state.groupInfo.set(g.id, { id: g.id, title: g.title || '', color: g.color, windowId: g.windowId, collapsed: g.collapsed }));
    state.saved = saved.filter((g) => !g.open).sort((a, b) => b.t - a.t);
  } catch {}
}

// "Recently closed" merges Chrome's list (only the last 25, restores a tab with
// its history) with our own 7-day log (survives Chrome's cap and restarts).
const hashOf = (str) => { let x = 5381; for (let i = 0; i < str.length; i++) x = ((x << 5) + x + str.charCodeAt(i)) | 0; return (x >>> 0).toString(36); };

async function loadClosed() {
  let sessions = [];
  try { sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 25 }); } catch {}
  const log = await getClosedLog().catch(() => []);
  const now = Date.now();
  const stamp = (s) => (s.lastModified > 0 ? s.lastModified * 1000 : 0); // 0 = Chrome gave no time (e.g. some closed windows)
  const rank = (c) => c.ts || now;                                         // ...which we treat as "just now" for sorting

  const inSaved = new Set(); // pages of a closed tab group: they are shown (as one card) under "Saved tab groups"
  state.saved.forEach((g) => g.tabs.forEach((t) => inSaved.add(normalizeUrl(t.u))));
  const items = [];
  const covered = new Set(); // pages inside a closed window that Chrome still lists as one "Window" card
  for (const s of sessions) {
    if (s.tab) {
      const url = urlOf(s.tab);
      if (!isWorthReopening(url) || inSaved.has(normalizeUrl(url))) continue;
      items.push({ id: 's' + s.tab.sessionId, kind: 'tab', url, title: s.tab.title || '', ts: stamp(s), count: 1, session: s, fields: [[s.tab.title, url]] });
    } else if (s.window && s.window.tabs && s.window.tabs.length) {
      const tabs = s.window.tabs;
      tabs.forEach((t) => covered.add(normalizeUrl(urlOf(t))));
      items.push({
        id: 's' + s.window.sessionId, kind: 'window', url: urlOf(tabs[0]), title: t('closedWindow', tn('tabs', tabs.length)),
        ts: stamp(s), count: tabs.length, session: s, fields: tabs.map((t) => [t.title, urlOf(t)]),
      });
    }
  }
  const open = new Set(state.tabs.map((t) => normalizeUrl(urlOf(t))));
  for (const e of log) {
    const key = normalizeUrl(e.url);
    // Already open again, or part of a closed window shown as one card: skip.
    if (!isWorthReopening(e.url) || covered.has(key) || open.has(key) || inSaved.has(key)) continue;
    items.push({ id: 'l' + e.closedAt + hashOf(e.url), kind: 'tab', url: e.url, title: e.title, ts: e.closedAt, count: 1, session: null, fields: [[e.title, e.url]] });
  }

  // One entry per page: the most recent wins; within 5 s it's the same closing, so keep Chrome's (restores history).
  const best = new Map();
  for (const it of items) {
    if (it.kind === 'window') continue;
    const k = normalizeUrl(it.url) || it.url;
    const cur = best.get(k);
    const d = cur ? rank(it) - rank(cur) : 1;
    if (!cur || d > 5000 || (d >= -5000 && it.session)) best.set(k, it);
  }
  const merged = [...items.filter((it) => it.kind === 'window'), ...best.values()].sort((a, b) => rank(b) - rank(a));

  const previews = await getPreviews(merged.slice(0, LIMITS.CLOSED_PREVIEW_LOOKUP).map((it) => it.url));
  for (const it of merged) it.preview = previews[normalizeUrl(it.url)] || null;
  state.closed = merged;
}

// What the "Recently closed" section shows. Normally the last few hours, a few
// entries, few whole windows; while searching, anything from the last 7 days.
function closedFor(q) {
  if (q) return state.closed.filter((c) => c.fields.some(([title, url]) => matches(q, title, url))).slice(0, LIMITS.RECENTLY_CLOSED_SEARCH);
  const cutoff = Date.now() - LIMITS.RECENTLY_CLOSED_MAX_AGE_S * 1000;
  let windows = 0;
  return state.closed
    .filter((c) => !c.ts || c.ts >= cutoff)
    .filter((c) => c.kind !== 'window' || ++windows <= LIMITS.RECENTLY_CLOSED_WINDOWS)
    .slice(0, LIMITS.RECENTLY_CLOSED);
}

// ------------------------------------------------------------ derive/filter
function matches(q, ...fields) {
  return fields.some((f) => (f || '').toLowerCase().includes(q));
}

const isStarred = (url) => !!state.stars[normalizeUrl(url)];
const siteOf = (url) => hostOf(url).replace(/^www\./, '');
const byTitle = (a, b) => (a.tab.title || siteOf(urlOf(a.tab))).localeCompare(b.tab.title || siteOf(urlOf(b.tab)), undefined, { sensitivity: 'base', numeric: true });
// Tab ids grow as tabs are opened, so they stand in for "when was this opened" (Chrome gives no
// creation time). Tabs restored after a restart count as opened in the order Chrome restored them.
const SORTERS = {
  newest: (a, b) => b.tab.id - a.tab.id,
  oldest: (a, b) => a.tab.id - b.tab.id,
  name: byTitle,
};
// "Last used" sections, from Chrome's lastAccessed time (newest first). Tabs Chrome gives no time for go under "Older".
const RECENT = [['h', 3600e3, 'recentHour'], ['d', null, 'recentToday'], ['w', 7 * 86400e3, 'recentWeek'], ['o', Infinity, 'recentOlder']];
function recentBucket(tab, now = Date.now()) {
  const at = Number.isFinite(tab.lastAccessed) ? tab.lastAccessed : 0;
  if (!at) return RECENT[3];
  const midnight = new Date(now).setHours(0, 0, 0, 0);
  if (now - at < RECENT[0][1]) return RECENT[0];
  if (at >= midnight) return RECENT[1];
  if (now - at < RECENT[2][1]) return RECENT[2];
  return RECENT[3];
}

// The sections the open tabs are shown in. Each has a stable `key` (what collapsing remembers).
function sectionsFor(open) {
  const secs = new Map();
  const add = (key, info, e) => {
    if (!secs.has(key)) secs.set(key, { key, ...info, entries: [] });
    e.sec = key;
    secs.get(key).entries.push(e);
  };
  if (state.dupesView) { // one section per page that is open more than once, the copy that stays first
    const close = new Set(duplicates().map((x) => x.id));
    for (const e of open) add('d:' + normalizeUrl(urlOf(e.tab)), { title: e.tab.title || siteOf(urlOf(e.tab)), site: urlOf(e.tab) }, e);
    const out = [...secs.values()];
    out.forEach((x) => x.entries.sort((a, b) => close.has(a.tab.id) - close.has(b.tab.id)));
    return out;
  }
  if (state.group === 'none') { for (const e of open) add('u', { title: t('ungrouped') }, e); return [...secs.values()]; }
  if (state.group === 'recent') { // "Last used": last hour, earlier today, this week, older (in that order, only the ones with tabs)
    const now = Date.now();
    for (const e of open) { const [k, , label] = recentBucket(e.tab, now); add('r:' + k, { title: t(label) }, e); }
    return RECENT.map(([k]) => secs.get('r:' + k)).filter(Boolean);
  }
  if (state.group === 'site') {
    // "Site": one section per site with two or more tabs (biggest first), the rest under "Other sites".
    const n = new Map();
    for (const e of open) { const s = siteOf(urlOf(e.tab)) || 'other'; n.set(s, (n.get(s) || 0) + 1); }
    for (const e of open) {
      const s = siteOf(urlOf(e.tab)) || 'other';
      if (n.get(s) > 1) add('s:' + s, { title: s, site: urlOf(e.tab) }, e);
      else add('s:', { title: t('otherSites') }, e);
    }
    const out = [...secs.values()];
    const rest = out.filter((x) => x.key === 's:');
    return [...out.filter((x) => x.key !== 's:').sort((x, y) => y.entries.length - x.entries.length || x.title.localeCompare(y.title)), ...rest];
  }
  // Otherwise: each Chrome tab group (in the order its first tab sorts), then the ungrouped tabs.
  for (const e of open) {
    const g = e.tab.groupId >= 0 && state.groupInfo.get(e.tab.groupId);
    if (g) add('g:' + (g.title || '') + '|' + g.color, { title: g.title || t('unnamedGroup'), group: g, gid: e.tab.groupId }, e);
    else add('u', { title: t('ungrouped') }, e);
  }
  const out = [...secs.values()];
  return [...out.filter((x) => x.group), ...out.filter((x) => !x.group)];
}

function derive() {
  const q = state.query.trim().toLowerCase();
  if (state.scope !== 'all' && !state.windows.some((w) => w.id === state.scope)) state.scope = 'all';

  const dupeKeys = state.dupesView ? dupeUrls() : null;
  const open = state.tabs
    .filter((x) => !dupeKeys || dupeKeys.has(normalizeUrl(urlOf(x))))
    .filter((t) => state.scope === 'all' || t.windowId === state.scope)
    .filter((t) => !state.starOnly || isStarred(urlOf(t)))
    .filter((t) => !q || matches(q, t.title, urlOf(t)))
    .map((tab) => ({ kind: 'tab', key: 't' + tab.id, tab, preview: state.previews[tab.id] || null }));
  state.mruOrder = open.slice(); // what Alt+Q cycles through: always recent use, whatever the sort
  if (SORTERS[state.sort]) open.sort(SORTERS[state.sort]);

  const all = sectionsFor(open);
  // A collapsed section keeps its header and hides its cards, except while searching.
  for (const sec of all) sec.collapsed = !q && state.collapsed.has(sec.key) && !state.peek.has(sec.key);
  // One plain list (no headers) when there's nothing to group by.
  // Tab groups or no grouping with a single ungrouped section: one plain list, no header. Site and Last used keep their headers.
  const headed = state.group === 'site' || state.group === 'recent';
  state.sections = all.length === 1 && !all[0].group && !headed ? [{ ...all[0], plain: true, collapsed: false }] : all;
  const shown = state.sections.flatMap((x) => (x.collapsed ? [] : x.entries));

  let closed = [];
  if (state.starOnly) {
    // Starred pages no tab has open right now: reopen them from here.
    const openUrls = new Set(state.tabs.map((t) => normalizeUrl(urlOf(t))));
    closed = Object.entries(state.stars)
      .filter(([k, st]) => !openUrls.has(k) && (!q || matches(q, st.ti, st.u)))
      .sort((a, b) => b[1].t - a[1].t)
      .map(([k, st]) => ({ kind: 'star', key: 'st' + k, item: { id: k, url: st.u, title: st.ti, ts: st.t }, preview: state.starPreviews[k] || null }));
  } else {
    closed = closedFor(q).map((item) => ({ kind: 'closed', key: 'c' + item.id, item, preview: item.preview }));
  }

  state.entries = [...shown, ...closed];
  state.openCount = shown.length;
  state.matchCount = open.length;
  state.matches = open; // every open tab the filters let through (collapsed sections too): "Select all" takes these
  // Ticked tabs that closed, or that the filters now hide, stay ticked only if they still exist.
  const ids = new Set(state.tabs.map((x) => x.id));
  for (const id of state.picked) if (!ids.has(id)) state.picked.delete(id);
}

// ------------------------------------------------------------------ render
// Cards are sized for the space the card area really has (measured, once the window list and the side
// panel are placed), and shrink to fit several to a row before they ever fall to one per row.
const CARD_MIN = 176; // px: small enough for three a row beside the panel on a laptop screen
function cardWidth(n) {
  const main = el.scroller;
  const cs = getComputedStyle(main);
  const indent = state.sections.some((x) => !x.plain) ? 24 : 0; // .gsec.grouped: border + padding
  const avail = Math.min(main.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - indent - 4, 1640);
  const [cols, cap] = n <= 2 ? [2, 420] : n <= 6 ? [3, 340] : [5, 320];
  for (let c = cols; c > 1; c--) { const w = (avail - 20 * (c - 1)) / c; if (w >= CARD_MIN) return Math.min(cap, w); }
  return Math.max(180, Math.min(cap, avail));
}

// The window list on the left: "All windows", then each window with a small picture of the tab it shows.
function renderWindows() {
  const multi = state.windows.length > 1;
  el.wins.hidden = !multi;
  el.winHint.hidden = !multi;
  el.body.classList.toggle('with-wins', multi);
  if (!multi) return el.wins.replaceChildren();
  const rows = [{ id: 'all', label: t('allWindows'), count: state.tabs.length, activeTitle: '' }, ...state.windows];
  el.wins.replaceChildren(...rows.map((w) => {
    const row = h('div', 'winrow');
    const b = h('button', 'win');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(state.scope === w.id));
    b.title = w.label + (w.activeTitle ? '\n' + t('activeTab', w.activeTitle) : ''); // also the name when the list is icons only
    // A side navbar: the window's name and its tab count (the icon of the tab it shows, for a quick look).
    const ico = h('span', 'wico');
    if (w.id === 'all') ico.innerHTML = ICON.windows;
    else { const img = h('img'); img.src = favicon(w.activeUrl || ''); img.alt = ''; ico.append(img); }
    b.setAttribute('aria-label', w.label + ', ' + tn('tabs', w.count));
    b.append(ico, h('span', 'wlabel', w.label), h('span', 'wn', String(w.count)));
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!pointerAllowed()) return;
      setScope(w.id);
      el.search.focus();
    });
    row.append(b);
    if (w.id !== 'all') row.append(panelBtn('more wmore', 'more', t('winMenu'), (ev) => windowMenu(w, ev.currentTarget)));
    return row;
  }));
}

// What you can do with a window: name it, tick its tabs, bookmark it, make a tab group of it, close it.
function windowMenu(w, anchor) {
  const tabs = state.tabs.filter((x) => x.windowId === w.id);
  menu(anchor, [
    { label: t('wmRename'), fn: () => renameWindow(w, anchor) },
    { label: t('gmSelect'), fn: () => { tabs.forEach((x) => state.picked.add(x.id)); refresh(); } },
    { label: t('wmBookmark'), fn: () => bookmarkTabs(tabs, w.label) },
    { label: t('wmGroup'), fn: () => groupPopover(tabs, anchor, w.named ? w.label : '') },
    null,
    { label: t('wmDelete'), danger: true, sure: tn('wmDeleteSure', tabs.length), fn: async () => { await chrome.windows.remove(w.id); if (!state.done) setTimeout(() => reload(), 600); } },
  ]);
}
// A small card with just a name. Empty = back to "Window N". The name lasts until Chrome quits.
function renameWindow(w, anchor) {
  document.querySelectorAll('.pop, .menu').forEach((x) => x.remove());
  const pop = h('form', 'pop');
  const name = h('input');
  name.value = w.named ? w.label : '';
  name.placeholder = t('winNamePh');
  name.maxLength = 40;
  name.setAttribute('aria-label', t('winName'));
  const row = h('div', 'row');
  const ok = h('button', 'btn primary small', t('save'));
  ok.type = 'submit';
  row.append(h('span', 'grow'), button(t('cancel'), 'quiet small', () => pop.remove()), ok);
  pop.append(h('label', '', t('winName')), name, row);
  pop.addEventListener('click', (e) => e.stopPropagation());
  pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); pop.remove(); el.search.focus(); } });
  pop.addEventListener('submit', async (e) => {
    e.preventDefault(); pop.remove();
    try { await setWinName(w.id, name.value); await reload(); } catch (err) { toast(t('actFailed'), err); }
    el.search.focus({ preventScroll: true });
  });
  el.app.append(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.left = Math.max(12, Math.min(window.innerWidth - 302, r.left)) + 'px';
  const ph = pop.offsetHeight;
  pop.style.top = (r.bottom + 6 + ph > window.innerHeight - 8 ? Math.max(8, r.top - ph - 8) : r.bottom + 6) + 'px';
  setTimeout(() => { name.focus(); name.select(); }, 0);
}

// "Window 2" on a card from another window. Narrow cards leave it out (the title needs the room; the window
// list on the left and the card's tooltip still say which window it is in).
function windowTag(tab) {
  if (state.scope !== 'all' || state.windows.length < 2 || tab.windowId === CTX.srcWin || state.cardW < 240) return null;
  const w = state.windows.find((x) => x.id === tab.windowId);
  return w ? h('span', 'tag', w.label) : null;
}

// A soft colour made from the site's name: the same site always gets the same tint.
function siteHue(host) {
  let x = 0;
  for (const c of String(host || '').replace(/^www\./, '')) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  return x % 360;
}
const bigFavicon = (url) => chrome.runtime.getURL('/_favicon/') + '?pageUrl=' + encodeURIComponent(url) + '&size=64';

// `soft`: an awake tab with no preview yet (expected: Chrome only screenshots the tab on screen). Instead of an
// empty box, the site's icon large on its own tint, and the page title; the camera button stays.
function thumbFor(entry, { label, sub, icon, action, soft }) {
  const thumb = h('div', 'thumb');
  if (soft && !(entry.preview && entry.preview.img)) {
    const box = h('div', 'nopreview soft');
    box.style.setProperty('--hue', String(siteHue(hostOf(entry.url))));
    const img = h('img', 'big');
    img.decoding = 'async';
    img.src = bigFavicon(entry.url);
    img.alt = '';
    box.append(img, h('div', 'ptitle', soft));
    if (action) box.append(action);
    thumb.append(box);
  } else if (entry.preview && entry.preview.img) {
    const img = h('img', 'shot');
    img.decoding = 'async'; // off-screen cards' pictures decode off the main thread, not in the first draw
    img.src = entry.preview.img;
    img.alt = '';
    thumb.append(img);
    if (label) {
      const pill = h('span', 'pill');
      pill.innerHTML = icon;
      pill.append(label);
      thumb.append(pill);
    }
  } else {
    const box = h('div', 'nopreview');
    const tile = h('div', 'tile');
    const img = h('img');
    img.src = favicon(entry.url);
    img.alt = '';
    const badge = h('span', 'icon');
    badge.innerHTML = icon;
    tile.append(img, badge);
    box.append(tile, h('div', 'label', label || t('noPreview')), h('div', 'sub', sub || ''));
    if (action) box.append(action);
    thumb.append(box);
  }
  return thumb;
}

// Star / unstar the page a card shows. Stars live only in Tabatha (not Chrome's bookmarks).
function starButton(entry) {
  const on = isStarred(entry.url);
  const b = h('button', 'star' + (on ? ' on' : ''));
  b.type = 'button';
  b.title = t(on ? 'unstar' : 'star') + (IS_MAC ? ' (⌥S)' : ' (Alt+S)');
  b.setAttribute('aria-label', t(on ? 'unstarAria' : 'starAria'));
  b.setAttribute('aria-pressed', String(on));
  b.innerHTML = ICON.star;
  b.addEventListener('click', (e) => { e.stopPropagation(); if (pointerAllowed()) star(entry); });
  return b;
}

// "Capture preview" on a card that has none: shows that tab for a moment, then comes back.
const canCapture = (tab) => !tab.discarded && isCapturableUrl(urlOf(tab)) && !state.nocap.has(normalizeUrl(urlOf(tab))) && state.hostOk;
function captureButton(entry) {
  const busy = state.capturing === entry.tab.id;
  const b = h('button', 'snap', t(busy ? 'capturing' : 'capturePreview'));
  b.type = 'button';
  b.disabled = busy;
  b.title = t('captureTitle') + (IS_MAC ? ' (⌥P)' : ' (Alt+P)');
  b.addEventListener('click', (e) => { e.stopPropagation(); if (pointerAllowed()) captureOne(entry); });
  return b;
}

function renderCard(entry, index) {
  // "Sleeping" is only for tabs Chrome unloaded while we were watching (Memory Saver
  // etc.): discarded now AND seen being discarded in this browser session. A tab that
  // is merely discarded because Chrome restored it lazily after a restart is not
  // sleeping: it shows its stored preview normally. Neither is a tab with no preview.
  const asleep = entry.kind === 'tab' && !!entry.tab.discarded && state.slept.has(entry.tab.id);
  const picked = entry.kind === 'tab' && state.picked.has(entry.tab.id);
  const willSleep = entry.kind === 'tab' && state.toSleep.has(entry.tab.id);
  const card = h('div', 'card' + (entry.kind === 'closed' || entry.kind === 'star' ? ' closed' : '') + (asleep || willSleep ? ' asleep' : '') + (picked ? ' picked' : ''));
  card.id = 'opt-' + entry.key;
  card.setAttribute('role', 'option');
  card.setAttribute('aria-selected', String(index === state.sel));

  const head = h('div', 'head');
  const fav = h('img', 'fav');
  fav.alt = '';

  if (entry.kind === 'tab') {
    const tab = entry.tab;
    entry.url = urlOf(tab);
    fav.src = favicon(entry.url);
    const host = hostOf(entry.url);
    head.append(pickBox(entry, picked), fav, h('span', 'title', tab.title || host || t('untitled')));
    // The site name only fits next to the title on wider cards; narrow ones
    // keep the title readable (the full URL is in the tooltip).
    if (tab.title && host && state.cardW >= 300) head.append(h('span', 'host', host.replace(/^www\./, '')));
    const tag = windowTag(tab);
    if (tag) head.append(tag);
    if (state.dupesView) { const goes = duplicates().some((x) => x.id === tab.id); head.append(h('span', 'tag ' + (goes ? 'goes' : 'stays'), t(goes ? 'dupeCloses' : 'dupeStays'))); }
    if (tab.pinned) { const b = h('span', 'badge'); b.innerHTML = ICON.pin; b.title = t('pinned'); head.append(b); }
    if (tab.audible || (tab.mutedInfo && tab.mutedInfo.muted)) { const b = h('span', 'badge'); b.innerHTML = tab.mutedInfo && tab.mutedInfo.muted ? ICON.muted : ICON.speaker; head.append(b); }
    head.append(starButton(entry));
    const x = h('button', 'x');
    x.type = 'button';
    x.title = t('closeTabTitle');
    x.setAttribute('aria-label', t('closeTab'));
    x.innerHTML = ICON.close;
    x.addEventListener('click', (e) => { e.stopPropagation(); if (pointerAllowed()) closeTab(entry, { mouse: true }); });
    head.append(x);
    const win = tab.windowId !== CTX.srcWin && state.windows.length > 1 ? state.windows.find((x) => x.id === tab.windowId) : null;
    card.title = (tab.title || '') + '\n' + entry.url + (win ? '\n' + win.label : '') + (asleep ? '\n' + t('sleepingTip') : '');
    // No preview just means Chrome only lets us screenshot the visible tab and
    // we haven't seen this one yet; it's an awake background tab, not asleep.
    // The placeholder shows the domain, since narrow cards hide it in the header.
    const sub = host;
    const thumb = thumbFor(entry, asleep || willSleep
      ? { label: t(willSleep ? 'willSleep' : 'sleeping'), sub, icon: ICON.moon }
      : { label: '', sub, icon: ICON.camera, soft: tab.title || host || t('untitled'), action: !entry.preview && canCapture(tab) ? captureButton(entry) : null });
    thumb.append(quickActions(entry));
    card.append(head, thumb);
  } else {
    const c = entry.item;
    entry.url = c.url;
    fav.src = favicon(entry.url);
    const title = c.title || hostOf(c.url);
    // Some entries (e.g. closed windows) come without a time: no time tag then.
    const ago = timeAgo(c.ts / 1000);
    head.append(fav, h('span', 'title', title));
    if (ago && entry.kind === 'closed') head.append(h('span', 'tag', ago));
    if (c.kind !== 'window') head.append(starButton(entry));
    card.title = t('reopenTip', title) + (c.kind !== 'window' ? '\n' + c.url : '');
    card.append(head, entry.kind === 'star'
      ? thumbFor(entry, { label: t('starred'), sub: hostOf(entry.url), icon: ICON.star })
      : thumbFor(entry, { label: t('closedLabel'), sub: hostOf(entry.url), icon: ICON.history }));
  }

  card.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!pointerAllowed()) return;
    // Ctrl/Cmd+click ticks a tab, Shift+click ticks a range, like a file list.
    if (entry.kind === 'tab' && (e.ctrlKey || e.metaKey || e.shiftKey || state.picked.size)) return pick(entry, { range: e.shiftKey });
    choose(state.entries.indexOf(entry));
  });
  if (entry.kind === 'tab') { // drag a tab onto a bookmark folder in the panel
    card.draggable = true;
    card.addEventListener('dragstart', (e) => {
      const ids = state.picked.has(entry.tab.id) ? [...state.picked] : [entry.tab.id];
      e.dataTransfer.setData('application/x-tabatha-tabs', JSON.stringify(ids));
      e.dataTransfer.effectAllowed = 'copy';
    });
  }
  card.addEventListener('auxclick', (e) => {
    if (e.button === 1 && entry.kind === 'tab') { e.preventDefault(); if (pointerAllowed()) closeTab(entry, { mouse: true }); }
  });
  card.addEventListener('mousemove', () => {
    const i = state.entries.indexOf(entry);
    if (state.mouseReady && i !== state.sel) select(i, { scroll: false });
  });
  return card;
}

// A section: a header you can click to collapse it (remembered between opens), then its cards.
function renderSection(sec, startIndex) {
  const box = h('div', 'gsec' + (sec.group ? ' grouped' : '') + (sec.collapsed ? ' collapsed' : ''));
  box.setAttribute('role', 'group');
  if (!sec.plain) {
    box.setAttribute('aria-label', sec.title);
    const head = h('button', 'ghead');
    head.type = 'button';
    head.setAttribute('aria-expanded', String(!sec.collapsed));
    head.title = t(sec.collapsed ? 'sectionShow' : 'sectionCollapse');
    const chev = h('span', 'chev');
    chev.innerHTML = ICON.chevron;
    head.append(chev);
    if (sec.group) {
      const dot = h('span', 'dot');
      dot.style.setProperty('--gc', GROUP_HEX[sec.group.color] || GROUP_HEX.grey);
      box.style.setProperty('--gc', GROUP_HEX[sec.group.color] || GROUP_HEX.grey);
      head.append(dot);
    } else if (sec.site) {
      const fav = h('img', 'sfav');
      fav.src = favicon(sec.site);
      fav.alt = '';
      head.append(fav);
    }
    head.append(h('span', 'gname', sec.title), h('span', 'n', String(sec.entries.length)));
    if (sec.collapsed) { // a peek at what's inside
      const peek = h('span', 'peek');
      for (const e of sec.entries.slice(0, 8)) { const i = h('img'); i.src = favicon(urlOf(e.tab)); i.alt = ''; peek.append(i); }
      head.append(peek);
    }
    head.addEventListener('click', (e) => { e.stopPropagation(); if (pointerAllowed()) toggleSection(sec.key); });
    const hrow = h('div', 'hrow');
    hrow.append(head);
    if (sec.gid !== undefined && state.groupInfo.has(sec.gid)) hrow.append(panelBtn('more', 'more', t('groupMenu'), (ev) => liveGroupMenu(sec.gid, ev.currentTarget)));
    else if (sec.gid === undefined && sec.entries.length) hrow.append(panelBtn('more', 'more', t('sectionMenu'), (ev) => sectionMenu(sec, ev.currentTarget))); // site, last used, ungrouped
    box.append(hrow);
  }
  if (!sec.collapsed) {
    const grid = h('div', 'grid');
    grid.style.setProperty('--w', state.cardW + 'px');
    grid.append(...sec.entries.map((e, i) => renderCard(e, startIndex + i)));
    box.append(grid);
  }
  return box;
}

function renderTools() {
  el.starFilter.setAttribute('aria-pressed', String(state.starOnly));
  el.starN.textContent = String(Object.keys(state.stars).length);
  el.sort.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.sort === state.sort)));
  $('group-by-v').textContent = t(GROUP_LABEL[state.group]);
  // Offer tab groups to people who use them, until they turn them on.
  el.groupsBtn.hidden = state.groupsOn || !state.tabs.some((x) => x.groupId >= 0);
  const d = duplicates().length;
  el.dupesBtn.hidden = d === 0;
  el.dupesText.textContent = tn('dupesBtn', d);
  el.dupesBtn.setAttribute('aria-pressed', String(state.dupesView));
  el.dupesBtn.title = t('dupesTitle');
  el.panelBtn.setAttribute('aria-expanded', String(state.panel));
  el.panelBtn.classList.toggle('on', state.panel);
  updateSweepButton();
}

// `follow`: scroll the selected card into view. Off for redraws after a mouse action (closing a tab with
// its x, the quick actions), so the view stays where the user scrolled it.
function render({ follow = true } = {}) {
  const closed = state.entries.slice(state.openCount);
  const scrolled = el.scroller.scrollTop; // a redraw (closing a tab, ticking one) stays where the user is
  renderWindows(); // placed first: the card size depends on the room they leave
  renderPanel();
  state.cardW = Math.floor(cardWidth(state.matchCount));
  el.openGrid.classList.toggle('has-groups', state.sections.some((x) => !x.plain));
  let at = 0;
  el.openGrid.replaceChildren(...state.sections.map((sec) => { const box = renderSection(sec, at); if (!sec.collapsed) at += sec.entries.length; return box; }));
  el.closedGrid.replaceChildren(...closed.map((e, i) => renderCard(e, i + state.openCount)));
  // While searching, "Recently closed" reaches back 7 days: say so, so nobody expects more.
  el.closedH.textContent = state.starOnly ? t('starredNotOpen') : state.query ? t('closedSearchH') : t('recentlyClosed');
  el.openEmpty.textContent = state.starOnly && !state.query ? t('noStarredOpen') : t('noMatch');
  el.openEmpty.hidden = state.matchCount > 0;
  el.closedSection.hidden = closed.length === 0;

  const n = state.matchCount;
  el.count.textContent = state.query ? t(state.starOnly ? 'countSearchStarred' : 'countSearch', n, closed.length) : tn('tabs', n);
  renderTools();
  renderActs();
  setTop();
  el.scroller.scrollTop = scrolled;
  select(state.sel, { scroll: follow });
  requestAnimationFrame(tipTruncated);
}

// Text cut short with "…" gets its full wording as a tooltip.
function tipTruncated() {
  for (const n of document.querySelectorAll('.ltitle, .gname, .host, .lname .n, .mname .n, .litem span, .chip .label, .wlabel')) {
    if (n.scrollWidth > n.clientWidth + 1) n.title = n.textContent; else if (n.title === n.textContent) n.removeAttribute('title');
  }
}

// The card area starts below the header, the toolbar, the alert bar and the quick-actions bar (if shown).
function setTop() {
  let top = el.bar.offsetHeight + el.tools.offsetHeight + (el.alert.hidden ? 0 : el.alert.offsetHeight + 4);
  if (!el.acts.hidden) { el.acts.style.top = (top + 2) + 'px'; top += el.acts.offsetHeight + 10; } // the actions bar sits right under the toolbar
  el.body.style.setProperty('--top', top + 'px');
}

function toTop() { el.scroller.scrollTop = 0; }
function refresh({ keepKey, follow = true } = {}) {
  const prevKey = keepKey || (state.entries[state.sel] || {}).key;
  derive();
  const i = state.entries.findIndex((e) => e.key === prevKey);
  state.sel = i >= 0 ? i : 0;
  render({ follow });
}

// -------------------------------------------------------------- selection
function select(i, { scroll = true } = {}) {
  const n = state.entries.length;
  if (!n) { state.sel = 0; return; }
  state.sel = ((i % n) + n) % n;
  const cards = document.querySelectorAll('.card');
  cards.forEach((c, k) => c.setAttribute('aria-selected', String(k === state.sel)));
  const cur = cards[state.sel];
  if (!cur) return;
  document.querySelectorAll('[role=listbox]').forEach((l) => l.removeAttribute('aria-activedescendant'));
  cur.closest('[role=listbox]').setAttribute('aria-activedescendant', cur.id);
  if (scroll) cur.scrollIntoView({ block: 'nearest' });
}

// Alt+Q / Tab cycle through open tabs only; arrows can reach "Recently closed".
// Groups regroup the cards on screen, so this follows recent use (like Alt+Tab), not screen order.
function cycle(d) {
  const mru = state.mruOrder.map((e) => e.key);
  const n = mru.length;
  if (!n) return;
  const cur = state.entries[state.sel];
  const here = cur && cur.kind === 'tab' ? mru.indexOf(cur.key) : d > 0 ? -1 : n;
  selectKey(mru[(((here + d) % n) + n) % n]);
}

// Select an open tab by key; if it sits in a collapsed section, open that section for this visit.
function selectKey(key) {
  let i = state.entries.findIndex((e) => e.key === key);
  if (i < 0) {
    const e = state.mruOrder.find((x) => x.key === key);
    if (!e || !e.sec) return;
    state.peek.add(e.sec);
    refresh({ keepKey: key });
    return;
  }
  select(i);
}

function moveSpatial(dx, dy) {
  const cards = [...document.querySelectorAll('.card')];
  const cur = cards[state.sel];
  if (!cur) return;
  if (dx) return select(state.sel + dx);
  const c = cur.getBoundingClientRect();
  const cx = c.left + c.width / 2;
  let best = -1, bestScore = Infinity;
  cards.forEach((card, k) => {
    if (k === state.sel) return;
    const r = card.getBoundingClientRect();
    const gap = dy > 0 ? r.top - c.bottom : c.top - r.bottom;
    if (gap < -4) return; // not in that direction
    const score = gap * 4 + Math.abs(r.left + r.width / 2 - cx);
    if (score < bestScore) { bestScore = score; best = k; }
  });
  if (best >= 0) select(best);
}

function toggleSection(key) {
  if (state.collapsed.has(key) && !state.peek.has(key)) state.collapsed.delete(key);
  else { state.collapsed.add(key); state.peek.delete(key); }
  updateView({ collapsed: [...state.collapsed] }).catch(() => {});
  refresh();
}

function setSort(sort) {
  if (sort === state.sort) return;
  state.sort = sort;
  updateView({ sort }).catch(() => {});
  refresh();
  toTop();
}

const GROUP_LABEL = { groups: 'groupTabGroups', site: 'groupSite', recent: 'groupRecent', none: 'groupNone' };
function setGroup(group) {
  if (group === state.group) return;
  state.group = group;
  updateView({ group }).catch(() => {});
  refresh();
  toTop();
}
// "Tab groups" needs the optional tab-groups permission: choosing it asks (Chrome's own prompt) if it isn't on yet,
// and the view only changes if it is allowed.
function groupMenu(anchor) {
  menu(anchor, ['groups', 'site', 'recent', 'none'].map((g) => ({ label: (state.group === g ? '✓ ' : '\u2003') + t(GROUP_LABEL[g]), fn: async () => {
    if (g === 'groups' && !state.groupsOn && !(await enableGroups())) return;
    setGroup(g);
  } })));
}

function toggleStarFilter() {
  state.starOnly = !state.starOnly;
  state.sel = 0;
  refresh({ keepKey: '-' });
  toTop();
}

async function star(entry) {
  if (!entry || !entry.url || (entry.item && entry.item.kind === 'window')) return;
  const on = await toggleStar(entry.url, entry.tab ? entry.tab.title : entry.item.title).catch(() => null);
  if (on === null || state.done) return;
  state.stars = await getStars().catch(() => state.stars);
  if (on) await loadStarPreviews();
  // Unstarring a starred-not-open card removes it from the list: keep the selection near it.
  const i = state.entries.indexOf(entry);
  const next = !on && entry.kind === 'star' ? [state.entries[i + 1], state.entries[i - 1]].find((e) => e && e !== entry) : entry;
  refresh({ keepKey: next && next.key });
}

// Take one tab's preview now. Showing a tab in the window the overlay sits in hides the page the
// overlay lives on (which closes it), so then the background opens the switcher again afterwards.
async function captureOne(entry) {
  if (!entry || entry.kind !== 'tab' || state.capturing || state.done || !canCapture(entry.tab)) return;
  const tab = entry.tab;
  const leaves = CTX.mode === 'overlay' && tab.windowId === CTX.srcWin;
  if (leaves) {
    await setResume({ query: state.query, scope: state.scope, starred: state.starOnly, key: entry.key }).catch(() => {});
    chrome.runtime.sendMessage({ type: MSG.CAPTURE_ONE, tabId: tab.id, reopen: CTX.srcTab }).catch(() => {});
    return finish('switch');
  }
  state.capturing = tab.id;
  asking = true; // the tab switch may move focus for a moment: don't close
  refresh({ keepKey: entry.key });
  try { await chrome.runtime.sendMessage({ type: MSG.CAPTURE_ONE, tabId: tab.id }); } catch {}
  asking = false;
  state.capturing = null;
  if (state.done) return;
  window.focus();
  const got = await getPreviews([urlOf(tab)]).catch(() => ({}));
  const p = got[normalizeUrl(urlOf(tab))];
  if (p) state.previews[tab.id] = p;
  else { // Chrome refused (or the page never finished loading): say so instead of doing nothing
    state.nocap = await getNoCapture().catch(() => state.nocap);
    toast(t(state.nocap.has(normalizeUrl(urlOf(tab))) ? 'captureBlocked' : 'captureFailed'));
  }
  refresh({ keepKey: entry.key });
}

function setScope(scope) {
  state.scope = scope;
  state.sel = 0;
  refresh({ keepKey: '-' });
  toTop();
}
function cycleScope(d) {
  if (state.windows.length < 2) return;
  const ids = ['all', ...state.windows.map((w) => w.id)];
  const i = ids.indexOf(state.scope);
  setScope(ids[(((i + d) % ids.length) + ids.length) % ids.length]);
}

// ---------------------------------------------------------------- actions
// Single exit path, runs at most once. `reason` tells the background what
// to do with focus: 'cancel' puts the original window back in front.
async function finish(reason) {
  if (state.done) return;
  state.done = true;
  if (state.toSleep.size) chrome.runtime.sendMessage({ type: MSG.SLEEP, tabIds: [...state.toSleep] }).catch(() => {});
  chrome.runtime.sendMessage({
    type: MSG.CLOSED, reason, src: CTX.srcTab, win: CTX.srcWin, state: CTX.srcState,
  }).catch(() => {});
  if (CTX.mode === 'overlay') {
    // Target '*': the host page's origin isn't known here, and the message
    // carries nothing but "close".
    parent.postMessage({ tabatha: FRAME_MSG.CLOSE }, '*');
  } else {
    if (reason === 'cancel') {
      try { await chrome.windows.update(CTX.srcWin, { focused: true }); } catch {}
    }
    window.close();
  }
}

async function choose(i) {
  const entry = state.entries[i];
  if (state.done || !entry) return;
  try {
    if (entry.kind === 'star') { // a starred page that isn't open: open it
      if (CTX.mode === 'window') await chrome.windows.update(CTX.srcWin, { focused: true }).catch(() => {});
      await chrome.tabs.create({ url: entry.item.url, windowId: CTX.srcWin, active: true });
      return finish('switch');
    }
    if (entry.kind === 'tab') {
      const tab = entry.tab;
      if (tab.id === CTX.srcTab && CTX.mode === 'overlay') return finish('cancel');
      await chrome.tabs.update(tab.id, { active: true });
      if (CTX.mode === 'window' || tab.windowId !== CTX.srcWin) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
      return finish('switch');
    }
    // Recently closed: restore into the window the user came from.
    if (CTX.mode === 'window') await chrome.windows.update(CTX.srcWin, { focused: true }).catch(() => {});
    const c = entry.item;
    if (c.session) await chrome.sessions.restore((c.session.tab || c.session.window).sessionId);
    else await chrome.tabs.create({ url: c.url, windowId: CTX.srcWin, active: true }); // from our own log: reopen the page
    return finish('restore');
  } catch (e) {
    console.warn('[Tabatha] could not open entry:', e && e.message);
    finish('cancel');
  }
}

// Anything destructive takes two presses: the first arms it (the button asks "sure?"), the second acts.
// `key` names what is armed: a saved group, a bookmark, or a quick action.
function armed(key) {
  if (state.armed === key) { state.armed = null; return true; }
  state.armed = key;
  refresh();
  setTimeout(() => { if (state.armed === key) { state.armed = null; if (!state.done) refresh(); } }, 3500);
  return false;
}


// With the keyboard (Del) the selection moves to the next card; with the mouse (x, middle click) the
// view and the selection stay where they are, so nothing jumps.
async function closeTab(entry, { mouse = false } = {}) {
  if (entry && entry.kind === 'star') return star(entry); // Del on a starred, not-open page unstars it
  if (!entry || entry.kind !== 'tab' || state.done) return;
  const id = entry.tab.id;
  const i = state.entries.indexOf(entry);
  const selected = state.entries[state.sel];
  const neighbour = mouse && selected && selected !== entry ? selected
    : [state.entries[i + 1], state.entries[i - 1]].find((e) => e && e.kind === 'tab');
  await animateOut([id]);
  if (id === CTX.srcTab && CTX.mode === 'overlay') return closeHere([id], neighbour);
  try { await chrome.tabs.remove(id); } catch { const c = document.getElementById('opt-t' + id); if (c) c.classList.remove('closing'); return; }
  forgetTab(id, neighbour && neighbour.key, { follow: !mouse });
  // Give Chrome a moment to add it to "Recently closed", then show it there.
  setTimeout(async () => { await loadClosed(); if (!state.done) refresh({ follow: false }); }, 200);
}

// Closing the tab the overlay is drawn on would end Tabatha with it. Instead the background closes it,
// switches to a tab next to it in the same window and opens Tabatha there again, where it was
// (search, window, filter, the selection). `ids` are all the tabs to close, the overlay's tab among them.
async function closeHere(ids, prefer) {
  const gone = new Set(ids);
  const same = (x) => x && x.kind === 'tab' && x.tab.windowId === CTX.srcWin && !gone.has(x.tab.id);
  const next = (same(prefer) ? prefer : null) || state.entries.find(same) || null;
  const nextTab = next ? next.tab : state.tabs.find((x) => x.windowId === CTX.srcWin && !gone.has(x.id));
  if (nextTab) await setResume({ query: state.query, scope: state.scope, starred: state.starOnly, key: 't' + nextTab.id }).catch(() => {});
  chrome.runtime.sendMessage({ type: MSG.CLOSE_HERE, tabIds: ids, next: nextTab ? nextTab.id : null }).catch(() => {});
  state.done = true; // the background closes this page with its tab
}

// The cards of tabs about to close shrink and fade out (skipped when the system asks for less motion).
const CLOSE_MS = 180;
function animateOut(ids) {
  const cards = ids.map((id) => document.getElementById('opt-t' + id)).filter(Boolean);
  if (!cards.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  cards.forEach((c) => c.classList.add('closing'));
  return new Promise((r) => setTimeout(r, CLOSE_MS));
}

function forgetTab(id, keepKey, { follow = true } = {}) {
  const tab = state.tabs.find((x) => x.id === id);
  if (!tab) return;
  state.tabs = state.tabs.filter((x) => x.id !== id);
  state.picked.delete(id);
  state.windows = state.windows
    .map((w) => (w.id === tab.windowId ? { ...w, count: w.count - 1 } : w))
    .filter((w) => w.count > 0);
  refresh({ keepKey, follow });
}

// ------------------------------------------------------------ quick actions
// Tick tabs (the box on a card, Ctrl/Cmd+click, Shift+click for a range, or "Select all" while
// searching), then act on all of them at once. Nothing acts until something is ticked.
// Everything here only calls Chrome's own tab and bookmark APIs.
function pickBox(entry, on) {
  const b = h('button', 'pick' + (on ? ' on' : ''));
  b.type = 'button';
  b.setAttribute('role', 'checkbox');
  b.setAttribute('aria-checked', String(on));
  b.setAttribute('aria-label', t('pickAria'));
  b.title = t('pickTitle');
  b.innerHTML = ICON.check;
  b.addEventListener('click', (e) => { e.stopPropagation(); if (pointerAllowed()) pick(entry, { range: e.shiftKey }); });
  return b;
}
function pick(entry, { range = false } = {}) {
  const id = entry.tab.id;
  const onScreen = state.entries.filter((e) => e.kind === 'tab').map((e) => e.tab.id);
  const a = range && state.lastPick !== null ? onScreen.indexOf(state.lastPick) : -1;
  const b = onScreen.indexOf(id);
  if (a >= 0 && b >= 0) onScreen.slice(Math.min(a, b), Math.max(a, b) + 1).forEach((x) => state.picked.add(x));
  else if (state.picked.has(id)) state.picked.delete(id);
  else state.picked.add(id);
  state.lastPick = id;
  refresh({ keepKey: entry.key });
}
function selectAll() { state.matches.forEach((e) => state.picked.add(e.tab.id)); refresh(); }
function clearPicks() { state.picked.clear(); state.lastPick = null; refresh(); }

// Quick actions act only on ticked tabs. While searching, "Select all N matching tabs" ticks the matches.
function targets() { return state.tabs.filter((x) => state.picked.has(x.id)); }

const ACTIONS = [
  { id: 'close', icon: 'close', label: () => t('actClose'), title: () => t('actCloseTitle'), run: closeMany, confirm: (n) => n > 1 },
  { id: 'copy', icon: 'link', label: () => t('actCopy'), title: () => t('actCopyTitle'), run: (tabs) => copyLinks(tabs, 'plain') },
  { id: 'mark', icon: 'bookmark', label: () => t('actBookmark'), title: () => t('actBookmarkTitle'), run: (tabs) => bookmarkTabs(tabs) },
  { id: 'group', icon: 'group', label: () => t('actGroup'), title: () => t('actGroupTitle'), run: (tabs, btn) => groupPopover(tabs, btn) },
  // In "More" (⋯): used less often.
  { id: 'md', more: true, label: () => t('actCopyMd'), title: () => t('actCopyMdTitle'), run: (tabs) => copyLinks(tabs, 'md') },
  { id: 'win', more: true, label: () => t('actNewWindow'), run: moveToWindow },
  { id: 'sleep', more: true, label: () => t('actSleep'), run: sleepTabs },
  { id: 'pin', more: true, label: (tabs) => t(tabs.length && tabs.every((x) => x.pinned) ? 'actUnpin' : 'actPin'), run: pinTabs },
  { id: 'mute', more: true, label: (tabs) => t(tabs.length && tabs.every((x) => x.mutedInfo && x.mutedInfo.muted) ? 'actUnmute' : 'actMute'), run: muteTabs },
];

// The floating pill at the bottom: shows while searching (to tick every match), once tabs are ticked,
// and in the duplicates view (to confirm). It floats over the cards, so nothing below it moves.
function renderActs() {
  document.documentElement.classList.toggle('picking', state.picked.size > 0);
  // The duplicates view offers "Close N copies" until you tick some: then the usual bar acts on just those.
  if (state.dupesView && !state.picked.size) return renderDupesBar();
  const tabs = targets();
  const n = tabs.length;
  const show = n > 0 || (!!state.query && state.matchCount > 1);
  el.acts.hidden = !show;
  el.acts.classList.remove('dupes');
  if (!show) return;
  const allPicked = state.matches.length > 0 && state.matches.every((e) => state.picked.has(e.tab.id));
  el.actsN.textContent = n ? tn('pickedN', n) : '';
  el.actsN.hidden = !n;
  el.selAll.hidden = allPicked || !state.matches.length;
  el.selAll.className = n ? 'lnk' : 'qa primary';
  el.selAll.textContent = state.query ? tn('selAllMatches', state.matches.length) : tn('selAllTabs', state.matches.length);
  el.selNone.hidden = n === 0;
  el.actsBtns.hidden = n === 0; // nothing to act on yet: only the "Select all" button shows
  const more = h('button', 'qa more');
  more.type = 'button';
  more.title = t('actMore');
  more.setAttribute('aria-label', t('actMore'));
  more.innerHTML = ICON.more;
  more.append(h('span', '', t('actMore')));
  more.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!pointerAllowed() || !n) return;
    menu(more, ACTIONS.filter((a) => a.more).map((a) => ({ label: a.label(tabs), fn: () => a.run(targets(), more) })));
  });
  el.actsBtns.replaceChildren(...ACTIONS.filter((a) => !a.more).map((a) => {
    const key = 'act:' + a.id;
    const sure = state.armed === key;
    const b = h('button', 'qa' + (sure ? ' armed' : '') + (a.id === 'close' ? ' danger' : ''));
    b.type = 'button';
    b.insertAdjacentHTML('beforeend', ICON[a.icon]);
    b.append(h('span', '', sure ? t('sureN', n) : a.label(tabs)));
    if (a.title) b.title = a.title();
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!pointerAllowed() || !n) return;
      if (a.confirm && a.confirm(n) && !armed(key)) return;
      Promise.resolve(a.run(targets(), b)).catch((err) => toast(t('actFailed'), err));
    });
    return b;
  }), more);
}

// Duplicates: first a view of just the copies (each card says whether it stays or closes), then confirm.
function renderDupesBar() {
  const d = duplicates();
  el.acts.hidden = false;
  el.acts.classList.add('dupes');
  el.actsN.hidden = false;
  el.actsN.textContent = d.length ? tn('dupesSummary', d.length) : t('dupesNone');
  el.selAll.hidden = true;
  el.selNone.hidden = true;
  el.actsBtns.hidden = false;
  const close = h('button', 'qa danger' + (state.armed === 'act:dupes' ? ' armed' : ''));
  close.type = 'button';
  close.insertAdjacentHTML('beforeend', ICON.close);
  close.append(h('span', '', state.armed === 'act:dupes' ? t('sureN', d.length) : tn('dupesClose', d.length)));
  close.disabled = !d.length;
  close.addEventListener('click', (e) => { e.stopPropagation(); if (pointerAllowed()) closeDupes(); });
  const back = h('button', 'qa');
  back.type = 'button';
  back.append(h('span', '', t('dupesBack')));
  back.addEventListener('click', (e) => { e.stopPropagation(); if (pointerAllowed()) dupesView(false); });
  el.actsBtns.replaceChildren(close, back);
}
function dupesView(on) {
  state.dupesView = on;
  state.armed = null;
  state.picked.clear();
  refresh({ keepKey: '-' });
  toTop();
}

// Small note at the bottom of the switcher ("Copied 5 links").
let toastTimer = null;
function toast(text, err) {
  if (err) console.warn('[Tabatha]', err && err.message);
  el.toast.textContent = text;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2600);
}

// Reload the tab list after Chrome has acted (pin, mute, move...), keeping the selection.
async function reload() {
  if (state.done) return;
  const key = (state.entries[state.sel] || {}).key;
  await load();
  if (!state.done) refresh({ keepKey: key, follow: false }); // after a click: the view stays put
}

async function closeMany(tabs) {
  const ids = tabs.map((x) => x.id);
  await animateOut(ids);
  const own = CTX.mode === 'overlay' && ids.includes(CTX.srcTab); // closing the tab we sit on: Tabatha reopens next door
  state.picked.clear();
  if (own) return closeHere(ids);
  await chrome.tabs.remove(ids);
  ids.forEach((id) => { state.tabs = state.tabs.filter((x) => x.id !== id); });
  toast(tn('closedN', ids.length));
  setTimeout(async () => { await loadClosed(); await reload(); }, 200);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  // Inside a web page's frame the page may not allow the clipboard API: the old way still works.
  el.clip.value = text;
  el.clip.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  el.clip.value = '';
  el.search.focus({ preventScroll: true });
  return ok;
}
async function copyLinks(tabs, fmt) {
  const md = (s) => String(s || '').replace(/([\[\]])/g, '\\$1');
  const text = tabs.map((x) => (fmt === 'md' ? `- [${md(x.title || hostOf(urlOf(x)))}](${urlOf(x)})` : urlOf(x))).join('\n');
  toast((await copyText(text)) ? tn('copiedN', tabs.length) : t('copyFailed'));
}

async function moveToWindow(tabs) {
  const [first, ...rest] = tabs;
  const w = await chrome.windows.create({ tabId: first.id, focused: true });
  if (rest.length) await chrome.tabs.move(rest.map((x) => x.id), { windowId: w.id, index: -1 });
  state.picked.clear();
  finish('switch');
}

// Group: a small card asks for a name (the search word to start with) and one of Chrome's colours.
function groupPopover(tabs, anchor, suggest = '') {
  const ids = tabs.filter((x) => !x.pinned).map((x) => x.id); // Chrome can't group pinned tabs
  if (!ids.length) return toast(t('groupPinned'));
  const win = tabs.find((x) => !x.pinned).windowId;
  nameColorPopover(anchor, { title: (suggest || state.query.trim()).slice(0, 40), color: 'blue', okLabel: tn('groupCreate', ids.length), note: state.groupsOn ? '' : t('groupNeedsPerm') }, async (title, color) => {
    // Naming and colouring a group needs the optional tab-groups permission: ask once, here.
    if (!state.groupsOn) await enableGroups();
    const gid = await chrome.tabs.group({ tabIds: ids, createProperties: { windowId: win } });
    if (state.groupsOn) await chrome.tabGroups.update(gid, { title, color }).catch(() => {});
    state.picked.clear();
    toast(tn('groupedN', ids.length));
    await reload();
  });
}

// Unloading a tab makes Chrome swap it out for a moment, which would jolt the switcher. So a tab put to
// sleep here is only marked (a moon on its card); it is unloaded as Tabatha closes. Clicking again unmarks.
async function sleepTabs(tabs) {
  const can = tabs.filter((x) => !x.active && !x.discarded); // Chrome won't unload the tab you're looking at
  if (!can.length) return toast(t('sleptNone'));
  const undo = can.every((x) => state.toSleep.has(x.id));
  can.forEach((x) => (undo ? state.toSleep.delete(x.id) : state.toSleep.add(x.id)));
  state.picked.clear();
  toast(undo ? t('sleepUndone') : tn('sleepLaterN', can.length));
  refresh();
}

async function pinTabs(tabs) {
  const pin = !tabs.every((x) => x.pinned);
  for (const x of tabs) await chrome.tabs.update(x.id, { pinned: pin }).catch(() => {});
  toast(tn(pin ? 'pinnedN' : 'unpinnedN', tabs.length));
  await reload();
}

async function muteTabs(tabs) {
  const mute = !tabs.every((x) => x.mutedInfo && x.mutedInfo.muted);
  for (const x of tabs) await chrome.tabs.update(x.id, { muted: mute }).catch(() => {});
  toast(tn(mute ? 'mutedN' : 'unmutedN', tabs.length));
  await reload();
}

// Pages open more than once (same address, ignoring the #part and a trailing slash).
function dupeUrls() {
  const n = new Map();
  for (const x of state.tabs) { const k = normalizeUrl(urlOf(x)); if (k && /^https?:|^file:/.test(urlOf(x))) n.set(k, (n.get(k) || 0) + 1); }
  return new Set([...n].filter(([, c]) => c > 1).map(([k]) => k));
}
// The same page open more than once: keep one (pinned first, then the most recently used), close the rest.
function duplicates() {
  const seen = new Map();
  const dupes = [];
  const order = [...state.tabs].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)); // state.tabs is most recent first
  for (const x of order) {
    const k = normalizeUrl(urlOf(x));
    if (!k || !/^https?:|^file:/.test(urlOf(x))) continue;
    if (seen.has(k)) dupes.push(x); else seen.set(k, x);
  }
  return dupes;
}
async function closeDupes() {
  if (!state.dupesView) return dupesView(true); // first show which tabs are copies
  const d = duplicates();
  if (!d.length || !armed('act:dupes')) return;
  state.dupesView = false;
  await closeMany(d);
}

// Bookmark tabs into the folder used last (the bookmarks bar at first). Several tabs at once go
// into a new folder named after the search, so they stay together.
async function bookmarkTabs(tabs, folderName = '') {
  if (!state.marksOn && !(await enableMarks())) return;
  const tree = await marks.getTree();
  const folder = marks.defaultFolder(tree, state.folder);
  if (!folder) return toast(t('actFailed'));
  let parent = folder;
  if (tabs.length > 1) parent = await marks.create(folder.id, folderName || state.query.trim() || t('marksFolderName', new Date().toLocaleDateString()));
  const n = await addMarks(parent.id, tabs);
  if (!n && parent !== folder) await marks.remove(parent.id).catch(() => {}); // nothing went in: no empty folder left behind
  state.picked.clear();
  state.openFolders.add(folder.id).add(parent.id);
  toast(n ? tn('bookmarkedN', n, folder.title || t('paneMarks')) : t('actFailed'));
  await loadMarks();
  openPanel('marks');
}

// Bookmark tabs into a folder, in order. A page Chrome won't bookmark is skipped. Resolves to how many were added.
async function addMarks(folderId, tabs) {
  let n = 0;
  for (const x of tabs) { try { await marks.create(folderId, x.title || hostOf(urlOf(x)), urlOf(x)); n++; } catch {} }
  return n;
}

function quickActions(entry) {
  const box = h('div', 'quick');
  const mk = (icon, title, fn) => {
    const b = h('button', 'qbtn');
    b.type = 'button';
    b.title = title;
    b.setAttribute('aria-label', title);
    b.innerHTML = ICON[icon];
    b.addEventListener('click', (e) => { e.stopPropagation(); if (pointerAllowed()) fn().catch((err) => toast(t('actFailed'), err)); });
    return b;
  };
  box.append(
    mk('link', t('copyLink'), () => copyLinks([entry.tab], 'plain')),
    mk('bookmark', t('bookmarkThis'), () => bookmarkTabs([entry.tab])),
  );
  if (!entry.tab.active && !entry.tab.discarded) box.append(mk('moon', t(state.toSleep.has(entry.tab.id) ? 'sleepUndo' : 'sleepThis'), () => sleepTabs([entry.tab])));
  return box;
}

// ------------------------------------------------------------ right panel
// Like a layers panel: closed tab groups Tabatha saved, and Chrome's bookmarks. Opens by itself on
// wide screens until the user closes it (remembered), and from "Groups & bookmarks" in the toolbar.
function openPanel(tab) {
  state.panel = true;
  if (tab) state.ptab = tab;
  updateView({ panel: true, ptab: state.ptab }).catch(() => {});
  render();
}
function closePanel() {
  state.panel = false;
  updateView({ panel: false }).catch(() => {});
  render();
}

async function loadMarks() {
  state.marksOn = marks.hasApi();
  state.tree = null;
  if (!state.marksOn) return;
  try { state.tree = await marks.getTree(); } catch { state.tree = null; }
}
async function enableMarks() {
  asking = true;
  const ok = await marks.enable();
  asking = false;
  window.focus();
  if (!ok || state.done) return false;
  await loadMarks();
  state.ptab = 'marks';
  render();
  return true;
}

const panelBtn = (cls, icon, title, fn) => {
  const b = h('button', 'pb ' + (cls || ''));
  b.type = 'button';
  b.title = title;
  b.setAttribute('aria-label', title);
  b.innerHTML = ICON[icon];
  b.addEventListener('click', (e) => { e.stopPropagation(); if (pointerAllowed()) fn(e); });
  return b;
};
const note = (text, ...extra) => { const d = h('div', 'pnote'); d.append(h('p', '', text), ...extra); return d; };

function renderPanel() {
  el.panel.hidden = !state.panel;
  el.body.classList.toggle('with-panel', state.panel);
  if (!state.panel) return;
  for (const b of el.panel.querySelectorAll('.ptab')) b.setAttribute('aria-selected', String(b.dataset.ptab === state.ptab));
  el.ptabGroupsN.textContent = state.saved.length ? String(state.saved.length) : '';
  el.paneGroups.hidden = state.ptab !== 'groups';
  el.paneMarks.hidden = state.ptab !== 'marks';
  if (state.ptab === 'groups') renderGroupsPane(); else renderMarksPane();
}

// Every tab group: the open ones (Chrome's order, drag to move them in the tab strip too), then the
// saved ones (closed groups Tabatha kept; drag to order them here). All folded until opened.
function liveGroups() {
  const order = new Map(); // first tab position of each group, window by window
  for (const x of [...state.tabs].sort((a, b) => a.windowId - b.windowId || a.index - b.index)) if (x.groupId >= 0 && !order.has(x.groupId)) order.set(x.groupId, order.size);
  return [...state.groupInfo.values()]
    .map((g) => ({ ...g, tabs: state.tabs.filter((x) => x.groupId === g.id).sort((a, b) => a.index - b.index) }))
    .filter((g) => g.tabs.length)
    .sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9));
}
function savedGroups() {
  const pos = new Map(state.gorder.map((id, i) => [id, i]));
  return [...state.saved].sort((a, b) => (pos.has(a.id) ? pos.get(a.id) : -1) - (pos.has(b.id) ? pos.get(b.id) : -1) || b.t - a.t);
}

function renderGroupsPane() {
  const q = state.query.trim().toLowerCase();
  if (!state.groupsOn) {
    return el.paneGroups.replaceChildren(note(t('groupsPaneOff'), button(t('groupsOn'), 'primary', enableGroups)));
  }
  const live = liveGroups().filter((g) => !q || matches(q, g.title, ...g.tabs.flatMap((x) => [x.title, urlOf(x)])));
  const saved = savedGroups().filter((g) => !q || matches(q, g.title, ...g.tabs.flatMap((x) => [x.ti, x.u])));
  if (!live.length && !saved.length) return el.paneGroups.replaceChildren(note(q ? t('groupsPaneNoMatch') : t('groupsPaneEmpty')));
  const out = [];
  if (live.length) out.push(h('h4', 'phead', t('groupsOpenH')), ...live.map((g) => groupRow(g, 'live')));
  if (saved.length) out.push(h('h4', 'phead', t('groupsSavedH')), ...saved.map((g) => groupRow(g, 'saved')));
  el.paneGroups.replaceChildren(...out);
}

let dragGroup = null; // { kind, id } while a group row is being dragged
function groupRow(g, kind) {
  const key = (kind === 'live' ? 'lg' : 'sg') + g.id;
  const open = state.openFolders.has(key) || !!state.query.trim();
  const row = h('div', 'layer ' + kind + (open ? ' open' : ''));
  const head = h('div', 'lhead');
  head.draggable = true;
  const grip = h('span', 'grip'); grip.innerHTML = ICON.grip;
  head.append(grip, panelBtn('chev', 'chevron', t(open ? 'collapse' : 'expand'), () => { state.openFolders.has(key) ? state.openFolders.delete(key) : state.openFolders.add(key); renderPanel(); }));
  const dot = h('span', 'dot');
  dot.style.setProperty('--gc', GROUP_HEX[g.color] || GROUP_HEX.grey);
  const name = h('button', 'lname');
  name.type = 'button';
  const title = g.title || t('unnamedGroup');
  name.title = kind === 'live' ? title : t('reopenGroup', tn('tabs', g.tabs.length));
  name.append(dot, h('span', 'ltitle', title), h('span', 'n', String(g.tabs.length)));
  name.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!pointerAllowed()) return;
    if (kind === 'live') { state.openFolders.has(key) ? state.openFolders.delete(key) : state.openFolders.add(key); return renderPanel(); }
    reopenSaved(g).catch(() => {});
  });
  head.append(name, panelBtn('more', 'more', t('groupMenu'), (ev) => (kind === 'live' ? liveGroupMenu(g.id, ev.currentTarget) : savedGroupMenu(g, ev.currentTarget))));
  // Drag to reorder (within open groups, or within saved groups).
  head.addEventListener('dragstart', (e) => { dragGroup = { kind, id: g.id }; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', title); row.classList.add('dragging'); });
  head.addEventListener('dragend', () => { dragGroup = null; row.classList.remove('dragging'); });
  row.addEventListener('dragover', (e) => { if (dragGroup && dragGroup.kind === kind && dragGroup.id !== g.id) { e.preventDefault(); row.classList.add('drop'); } });
  row.addEventListener('dragleave', () => row.classList.remove('drop'));
  row.addEventListener('drop', (e) => { e.preventDefault(); row.classList.remove('drop'); if (dragGroup && dragGroup.kind === kind && pointerAllowed()) moveGroup(dragGroup.id, g, kind).catch((err) => toast(t('actFailed'), err)); });
  row.append(head);
  if (open) {
    const ul = h('ul', 'litems');
    for (const tb of g.tabs) {
      const u = kind === 'live' ? urlOf(tb) : tb.u, ti = kind === 'live' ? tb.title : tb.ti;
      const li = h('li');
      const b = h('button', 'litem');
      b.type = 'button';
      b.title = (ti || '') + '\n' + u;
      const img = h('img'); img.src = favicon(u); img.alt = '';
      b.append(img, h('span', '', ti || hostOf(u)));
      b.addEventListener('click', (e) => { e.stopPropagation(); if (pointerAllowed()) openUrlHere(u); });
      li.append(b);
      ul.append(li);
    }
    row.append(ul);
  }
  return row;
}

// Open a saved group again and close Tabatha. Runs once: a double click must not open the group twice.
let reopening = false;
async function reopenSaved(g) {
  if (reopening || state.done) return;
  reopening = true;
  try {
    if (CTX.mode === 'window') await chrome.windows.update(CTX.srcWin, { focused: true }).catch(() => {});
    await reopenGroup(g, CTX.srcWin);
  } finally { finish('restore'); }
}

// Dropped group `id` onto group `target`: open groups move in Chrome's tab strip; saved ones only in the panel.
async function moveGroup(id, target, kind) {
  if (kind === 'saved') {
    const ids = savedGroups().map((g) => g.id).filter((x) => x !== id);
    ids.splice(ids.indexOf(target.id), 0, id);
    state.gorder = ids;
    updateView({ gorder: ids }).catch(() => {});
    return renderPanel();
  }
  const groups = liveGroups();
  const from = groups.findIndex((g) => g.id === id), to = groups.findIndex((g) => g.id === target.id);
  const tt = target.tabs;
  const index = from < to && target.windowId === groups[from].windowId ? tt[tt.length - 1].index : tt[0].index;
  await chrome.tabGroups.move(id, { windowId: target.windowId, index });
  await reload();
}

// A small menu next to a button: [{ label, fn, danger, sure }]; `sure` items ask again before acting.
function menu(anchor, items) {
  if (closeIfOpen(anchor)) return; // a second click on the same button closes its menu
  document.querySelectorAll('.pop, .menu').forEach((x) => x.remove());
  const m = h('div', 'menu');
  m.setAttribute('role', 'menu');
  for (const it of items) {
    if (!it) { m.append(h('hr')); continue; }
    const b = h('button', 'mi' + (it.danger ? ' danger' : ''), it.label);
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    let armedOnce = false;
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!pointerAllowed()) return;
      if (it.sure && !armedOnce) { armedOnce = true; b.textContent = it.sure; b.classList.add('armed'); return; }
      m.remove();
      try { await it.fn(); } catch (err) { toast(t('actFailed'), err); }
    });
    m.append(b);
  }
  m.addEventListener('click', (e) => e.stopPropagation());
  m._anchor = anchor;
  el.app.append(m);
  const r = anchor.getBoundingClientRect();
  const w = 230;
  m.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px';
  const below = r.bottom + 6, h0 = m.offsetHeight;
  m.style.top = (below + h0 > window.innerHeight - 8 ? Math.max(8, r.top - h0 - 6) : below) + 'px';
  // A press anywhere else closes it; a press on its own button is left to that button's click (which closes it).
  const close = (e) => { if (!m.contains(e.target) && !anchor.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', close, true); } };
  setTimeout(() => document.addEventListener('mousedown', close, true), 0);
  m.querySelector('button').focus({ preventScroll: true });
}
// Is a menu or card already open from this button? Then close it and say so.
function closeIfOpen(anchor) {
  const open = [...document.querySelectorAll('.pop, .menu')].find((x) => x._anchor === anchor);
  if (!open) return false;
  open.remove();
  el.search.focus({ preventScroll: true });
  return true;
}

// Rename / recolour: the name + colour card, used for open and saved groups.
function nameColorPopover(anchor, { title, color, okLabel, note: fine }, save) {
  document.querySelectorAll('.pop, .menu').forEach((x) => x.remove());
  const pop = h('form', 'pop');
  const name = h('input');
  name.value = title || '';
  name.placeholder = t('groupNamePh');
  name.setAttribute('aria-label', t('groupName'));
  let col = color || 'blue';
  const sw = h('div', 'swatches');
  for (const c of GROUP_COLORS) {
    const b = h('button', 'sw' + (c === col ? ' on' : ''));
    b.type = 'button';
    b.style.setProperty('--gc', GROUP_HEX[c]);
    b.setAttribute('aria-label', c);
    b.addEventListener('click', (e) => { e.stopPropagation(); col = c; sw.querySelectorAll('.sw').forEach((x) => x.classList.toggle('on', x === b)); });
    sw.append(b);
  }
  const row = h('div', 'row');
  const ok = h('button', 'btn primary small', okLabel || t('save'));
  ok.type = 'submit';
  row.append(h('span', 'grow'), button(t('cancel'), 'quiet small', () => pop.remove()), ok);
  pop.append(h('label', '', t('groupName')), name, sw, ...(fine ? [h('p', 'pfine', fine)] : []), row);
  pop.addEventListener('click', (e) => e.stopPropagation());
  pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); pop.remove(); el.search.focus(); } });
  pop.addEventListener('submit', async (e) => { e.preventDefault(); pop.remove(); try { await save(name.value.trim().slice(0, 60), col); } catch (err) { toast(t('actFailed'), err); } });
  el.app.append(pop);
  // Next to the button: below it if there is room, else above (the actions pill sits at the bottom).
  const r = anchor.getBoundingClientRect();
  pop.style.left = Math.max(12, Math.min(window.innerWidth - 302, r.right - 290)) + 'px';
  const ph = pop.offsetHeight;
  pop.style.top = (r.bottom + 6 + ph > window.innerHeight - 8 ? Math.max(8, r.top - ph - 8) : r.bottom + 6) + 'px';
  setTimeout(() => { name.focus(); name.select(); }, 0);
}

// What you can do with a section that is not a Chrome tab group (a site, a time span, "Ungrouped"): the group menu's
// actions minus rename/recolour and ungroup. "Make a tab group" is left out when its tabs already are one group.
function sectionMenu(sec, anchor) {
  const tabs = sec.entries.filter((e) => e.kind === 'tab').map((e) => e.tab);
  if (!tabs.length) return;
  const one = tabs[0].groupId >= 0 && tabs.every((x) => x.groupId === tabs[0].groupId);
  menu(anchor, [
    { label: t('gmSelect'), fn: () => { tabs.forEach((x) => state.picked.add(x.id)); refresh(); } },
    { label: t('smBookmark'), fn: () => bookmarkTabs(tabs, sec.title) },
    ...(one ? [] : [{ label: t('wmGroup'), fn: () => groupPopover(tabs, anchor, sec.site ? sec.title : '') }]),
    { label: t('gmWindow'), fn: () => moveToWindow(tabs) },
    { label: t('gmSleep'), fn: () => sleepTabs(tabs) },
    null,
    { label: t('smClose'), danger: true, sure: tn('smCloseSure', tabs.length), fn: () => closeMany(tabs) },
  ]);
}

// What you can do with an open Chrome tab group.
function liveGroupMenu(gid, anchor) {
  const g = liveGroups().find((x) => x.id === gid);
  if (!g) return;
  const ids = g.tabs.map((x) => x.id);
  const name = g.title || t('unnamedGroup');
  const closeTabs = async () => {
    const own = CTX.mode === 'overlay' && ids.includes(CTX.srcTab);
    await chrome.tabs.remove(ids.filter((id) => !own || id !== CTX.srcTab));
    if (own) await chrome.tabs.remove(CTX.srcTab);
  };
  menu(anchor, [
    { label: t('gmRename'), fn: () => nameColorPopover(anchor, { title: g.title, color: g.color }, async (title, color) => { await chrome.tabGroups.update(gid, { title, color }); await reload(); }) },
    { label: t('gmSelect'), fn: () => { ids.forEach((id) => state.picked.add(id)); refresh(); } },
    { label: t('gmBookmark'), fn: () => bookmarkTabs(g.tabs, name) },
    { label: t('gmWindow'), fn: async () => {
      const w = await chrome.windows.create({ focused: true });
      await chrome.tabGroups.move(gid, { windowId: w.id, index: -1 });
      const blank = (await chrome.tabs.query({ windowId: w.id })).find((x) => x.groupId !== gid);
      if (blank) await chrome.tabs.remove(blank.id).catch(() => {});
      finish('switch');
    } },
    { label: t('gmSleep'), fn: () => sleepTabs(g.tabs) },
    null,
    { label: t('gmUngroup'), fn: async () => { const rec = await recordFor(gid); await chrome.tabs.ungroup(ids); if (rec) setTimeout(() => removeSavedGroup(rec.id).catch(() => {}), 1200); await reload(); } },
    { label: t('gmClose'), danger: true, sure: t('gmCloseSure', ids.length), fn: async () => { await closeTabs(); setTimeout(() => reload(), 900); } },
    { label: t('gmDelete'), danger: true, sure: t('gmDeleteSure', ids.length), fn: async () => {
      const rec = await recordFor(gid);
      const own = CTX.mode === 'overlay' && ids.includes(CTX.srcTab);
      if (!own) {
        await closeTabs();
        if (rec) setTimeout(() => removeSavedGroup(rec.id).then(() => reload()).catch(() => {}), 1200);
        return;
      }
      // Closing the tab Tabatha sits on ends this page, so nothing can run after it: close the other tabs,
      // let the group sync settle (the group is still open), forget the saved copy, then close that tab.
      const others = ids.filter((id) => id !== CTX.srcTab);
      if (others.length) await chrome.tabs.remove(others).catch(() => {}); // one may have closed meanwhile
      await new Promise((r) => setTimeout(r, LIMITS.GROUP_SYNC_MS + 400));
      if (rec) await removeSavedGroup(rec.id).catch(() => {});
      await chrome.tabs.remove(CTX.srcTab);
    } },
  ]);
}

// What you can do with a saved (closed) group.
function savedGroupMenu(g, anchor) {
  const name = g.title || t('unnamedGroup');
  menu(anchor, [
    { label: t('gmReopen'), fn: () => reopenSaved(g) },
    { label: t('gmRename'), fn: () => nameColorPopover(anchor, { title: g.title, color: g.color }, async (title, color) => { await updateSavedGroup(g.id, { title, color }); await loadGroups(); refresh(); }) },
    { label: t('gmBookmark'), fn: () => bookmarkTabs(g.tabs.map((x) => ({ title: x.ti, url: x.u })), name) },
    null,
    { label: t('gmForget'), danger: true, sure: t('gmForgetSure'), fn: async () => { await removeSavedGroup(g.id); state.saved = state.saved.filter((x) => x.id !== g.id); refresh(); } },
  ]);
}

// Open a page in the window Tabatha was opened from, or switch to it if a tab already has it.
async function openUrlHere(url) {
  const k = normalizeUrl(url);
  const tab = state.tabs.find((x) => normalizeUrl(urlOf(x)) === k);
  try {
    if (tab) {
      await chrome.tabs.update(tab.id, { active: true });
      if (CTX.mode === 'window' || tab.windowId !== CTX.srcWin) await chrome.windows.update(tab.windowId, { focused: true });
    } else {
      if (CTX.mode === 'window') await chrome.windows.update(CTX.srcWin, { focused: true }).catch(() => {});
      await chrome.tabs.create({ url, windowId: CTX.srcWin, active: true });
    }
  } catch {}
  finish('switch');
}

// "Move it out of bookmarks": the tab is opened first (in the background), and the bookmark is only
// removed once it exists, so an address Chrome refuses never costs the bookmark.
async function openAndRemove(n) {
  const k = normalizeUrl(n.url);
  let tab = state.tabs.find((x) => normalizeUrl(urlOf(x)) === k);
  try { if (!tab) tab = await chrome.tabs.create({ url: n.url, windowId: CTX.srcWin, active: false }); }
  catch (err) { return toast(t('actFailed'), err); }
  await marks.remove(n.id).catch(() => {});
  try {
    await chrome.tabs.update(tab.id, { active: true });
    if (CTX.mode === 'window' || tab.windowId !== CTX.srcWin) await chrome.windows.update(tab.windowId, { focused: true });
  } catch {}
  finish('switch');
}

function renderMarksPane() {
  if (!state.marksOn) {
    return el.paneMarks.replaceChildren(note(t('marksPaneOff'), button(t('marksOn'), 'primary', enableMarks), h('p', 'pfine', t('marksPaneOffNote'))));
  }
  if (!state.tree) return el.paneMarks.replaceChildren(note(t('marksLoadFailed')));
  const q = state.query.trim().toLowerCase();
  const top = h('div', 'ptools');
  if (state.picked.size) top.append(button(tn('marksAddPicked', state.picked.size), 'primary small', () => bookmarkTabs(targets())));
  if (q) {
    const found = marks.search(state.tree, q);
    const list = found.length ? found.map((n) => markRow(n, true)) : [note(t('marksNoMatch'))];
    return el.paneMarks.replaceChildren(top, ...list);
  }
  let shown = 0;
  const walk = (n) => {
    if (shown > LIMITS.MAX_BOOKMARKS_SHOWN) return [];
    if (!n.children) { shown++; return [markRow(n, false)]; }
    const open = state.openFolders.has(n.id);
    const rows = [folderRow(n, open)];
    if (open) n.children.forEach((c) => rows.push(...walk(c)));
    return rows;
  };
  el.paneMarks.replaceChildren(top, ...state.tree.roots.flatMap(walk));
}

function folderRow(n, open) {
  const row = h('div', 'mrow folder' + (state.folder === n.id ? ' last' : ''));
  row.style.setProperty('--d', String(n.depth));
  row.append(panelBtn('chev' + (open ? ' open' : ''), 'chevron', t(open ? 'collapse' : 'expand'), () => toggleFolder(n.id)));
  const name = h('button', 'mname');
  name.type = 'button';
  name.innerHTML = ICON.folder;
  name.append(h('span', 'ltitle', n.title || t('untitled')), h('span', 'n', String(n.children.length)));
  name.addEventListener('click', (e) => { e.stopPropagation(); if (pointerAllowed()) toggleFolder(n.id); });
  row.append(name);
  if (state.editing === n.id) return editRow(n);
  row.append(panelBtn('more', 'more', t('folderMenu'), (ev) => folderMenu(n, ev.currentTarget)));
  if (n.depth > 0) dragMark(row, n);
  // Drop tabs here to bookmark them in this folder; drop a bookmark or folder here to move it inside.
  row.addEventListener('dragover', (e) => {
    const tabsIn = e.dataTransfer.types.includes('application/x-tabatha-tabs');
    if (tabsIn || canDropMark(n, true)) { e.preventDefault(); row.classList.add('drop'); }
  });
  row.addEventListener('dragleave', () => row.classList.remove('drop'));
  row.addEventListener('drop', async (e) => {
    e.preventDefault();
    row.classList.remove('drop');
    if (dragMarkId) return dropMark(n, true);
    let ids = [];
    try { ids = JSON.parse(e.dataTransfer.getData('application/x-tabatha-tabs')); } catch {}
    const tabs = state.tabs.filter((x) => ids.includes(x.id));
    if (!tabs.length || !pointerAllowed()) return;
    const added = await addMarks(n.id, tabs);
    state.folder = n.id;
    updateView({ folder: n.id }).catch(() => {});
    state.openFolders.add(n.id);
    state.picked.clear();
    toast(added ? tn('bookmarkedN', added, n.title) : t('actFailed'));
    await loadMarks();
    refresh();
  });
  return row;
}
// Drag bookmarks and folders to reorder them, or onto a folder to move them in (Chrome's real order).
let dragMarkId = null;
function dragMark(row, n) {
  row.draggable = true;
  row.addEventListener('dragstart', (e) => { e.stopPropagation(); dragMarkId = n.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', n.title || n.url || ''); row.classList.add('dragging'); });
  row.addEventListener('dragend', () => { dragMarkId = null; row.classList.remove('dragging'); });
}
function canDropMark(target, into) {
  if (!dragMarkId || dragMarkId === target.id || !state.tree) return false;
  const moving = state.tree.byId.get(dragMarkId);
  if (!moving) return false;
  const dest = into ? target : state.tree.byId.get(target.parentId);
  return !!dest && !(moving.children && marks.contains(moving, dest.id)); // never into itself
}
async function dropMark(target, into) {
  const id = dragMarkId;
  dragMarkId = null;
  if (!id || !pointerAllowed()) return;
  try {
    if (into) { await marks.move(id, target.id); state.openFolders.add(target.id); }
    else {
      const parent = state.tree.byId.get(target.parentId);
      const moving = state.tree.byId.get(id);
      let index = parent.children.findIndex((c) => c.id === target.id);
      if (moving.parentId === parent.id && parent.children.findIndex((c) => c.id === id) < index) index--; // Chrome counts after removing it
      await marks.move(id, parent.id, Math.max(0, index));
    }
  } catch (err) { toast(t('actFailed'), err); }
  await loadMarks();
  renderPanel();
}

// ⋯ on a folder: rename, new folder inside, bookmark the ticked tabs here, delete (says what it holds).
function folderMenu(n, anchor) {
  const inside = marks.countIn(n);
  const top = n.depth === 0; // the bookmarks bar, Other bookmarks: Chrome's own, can't be renamed or deleted
  menu(anchor, [
    ...(top ? [] : [{ label: t('rename'), fn: () => { state.editing = n.id; renderPanel(); } }]),
    { label: t('newFolder'), fn: () => newFolder(n) },
    ...(state.picked.size ? [{ label: tn('marksAddHere', state.picked.size), fn: async () => {
      const added = await addMarks(n.id, targets());
      state.folder = n.id; updateView({ folder: n.id }).catch(() => {});
      state.openFolders.add(n.id); state.picked.clear();
      toast(added ? tn('bookmarkedN', added, n.title) : t('actFailed')); await loadMarks(); refresh();
    } }] : []),
    ...(top ? [] : [null, { label: t('folderDelete'), danger: true, sure: inside ? tn('folderDeleteSure', inside) : t('gmForgetSure'), fn: async () => {
      await marks.removeFolder(n.id); state.openFolders.delete(n.id); await loadMarks(); refresh();
    } }]),
  ]);
}

function toggleFolder(id) {
  state.openFolders.has(id) ? state.openFolders.delete(id) : state.openFolders.add(id);
  renderPanel();
}
async function newFolder(parent) {
  const f = await marks.create(parent.id, t('newFolderName')).catch(() => null);
  if (!f) return toast(t('actFailed'));
  state.openFolders.add(parent.id);
  await loadMarks();
  state.editing = f.id;
  state.newFolder = f.id;
  renderPanel();
}
// Cancel an edit; a folder made a moment ago by "New folder" is removed again (it was never named).
async function cancelEdit() {
  const id = state.editing;
  state.editing = null;
  if (id && id === state.newFolder) { state.newFolder = null; await marks.remove(id).catch(() => {}); await loadMarks(); }
  renderPanel();
  el.search.focus({ preventScroll: true });
}

const isBookmarklet = (url) => /^\s*javascript:/i.test(url || '');
function markRow(n, flat) {
  if (state.editing === n.id) return editRow(n);
  const row = h('div', 'mrow');
  if (!flat) {
    dragMark(row, n);
    row.addEventListener('dragover', (e) => { if (canDropMark(n, false)) { e.preventDefault(); row.classList.add('drop-before'); } });
    row.addEventListener('dragleave', () => row.classList.remove('drop-before'));
    row.addEventListener('drop', (e) => { e.preventDefault(); row.classList.remove('drop-before'); if (dragMarkId) dropMark(n, false); });
  }
  row.style.setProperty('--d', String(flat ? 0 : n.depth));
  const name = h('button', 'mname');
  name.type = 'button';
  name.title = n.title + '\n' + n.url;
  const img = h('img'); img.src = favicon(n.url); img.alt = '';
  name.append(img, h('span', 'ltitle', n.title || hostOf(n.url)));
  if (flat) { const f = state.tree.byId.get(n.parentId); if (f) name.append(h('span', 'n', f.title)); }
  // Chrome refuses javascript: addresses from an extension, so a bookmarklet can't be opened (or moved out) from here.
  const bookmarklet = isBookmarklet(n.url);
  name.addEventListener('click', (e) => { e.stopPropagation(); if (!pointerAllowed()) return; if (bookmarklet) toast(t('bookmarkletTip')); else openUrlHere(n.url); });
  row.append(name, panelBtn('', 'edit', t('editMark'), () => { state.editing = n.id; renderPanel(); }));
  if (!bookmarklet) {
    row.append(panelBtn('', 'out', t('openRemove'), () => openAndRemove(n)));
  }
  const key = 'bm' + n.id;
  row.append(state.armed === key
    ? button(t('removeQ'), 'danger small', () => deleteMark(n))
    : panelBtn('x', 'trash', t('deleteMark'), () => deleteMark(n)));
  return row;
}
async function deleteMark(n) {
  if (!armed('bm' + n.id)) return;
  await marks.remove(n.id).catch(() => toast(t('actFailed')));
  await loadMarks();
  refresh();
}

// Edit a bookmark (title, address, folder) or rename a folder, right in the panel.
function editRow(n) {
  const form = h('form', 'medit');
  form.style.setProperty('--d', String(n.depth));
  const title = h('input');
  title.value = n.title;
  title.setAttribute('aria-label', t('markTitle'));
  title.placeholder = t('markTitle');
  form.append(title);
  let url = null, where = null;
  if (n.url) {
    url = h('input');
    url.value = n.url;
    url.setAttribute('aria-label', t('markUrl'));
    url.placeholder = 'https://';
    where = h('select');
    where.setAttribute('aria-label', t('moveTo'));
    for (const f of marks.folders(state.tree)) {
      const o = h('option', '', '  '.repeat(f.depth) + (f.title || t('untitled')));
      o.value = f.id;
      if (f.id === n.parentId) o.selected = true;
      where.append(o);
    }
    form.append(url, where);
  }
  const row = h('div', 'row');
  row.append(h('span', 'grow'), button(t('cancel'), 'quiet small', () => cancelEdit()));
  const save = h('button', 'btn primary small', t('save'));
  save.type = 'submit';
  row.append(save);
  form.append(row);
  form.addEventListener('click', (e) => e.stopPropagation());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pointerAllowed() && e.submitter) return;
    try {
      const changes = { title: title.value.trim() };
      if (url) {
        const u = url.value.trim();
        if (u !== n.url) { // an address it already had (a bookmarklet's, say) is kept as it is
          if (!/^(https?|file|chrome|about|ftp):/i.test(u)) { url.focus(); return toast(t('badUrl')); }
          changes.url = u;
        }
      }
      await marks.update(n.id, changes);
      if (where && where.value !== n.parentId) { await marks.move(n.id, where.value); state.openFolders.add(where.value); }
    } catch (err) { toast(t('actFailed'), err); }
    state.editing = null;
    state.newFolder = null;
    await loadMarks();
    renderPanel();
    el.search.focus({ preventScroll: true });
  });
  setTimeout(() => title.focus(), 0);
  return form;
}

// ---------------------------------------------------------------- dialogs
// Two dialogs live in the switcher: the first-run tour and the review prompt. While one is
// open it owns the keyboard (Esc closes it, not the switcher). Neither is shown while Alt is
// still held from the shortcut, so a quick Alt+Q flick is never interrupted.
let asking = false; // a browser permission prompt is open: its focus change must not close us

const K = (win, mac) => h('kbd', '', IS_MAC && mac ? mac : win);
const para = (...parts) => { const p = h('p'); p.append(...parts); return p; };
const button = (label, cls, fn) => { const b = h('button', 'btn ' + (cls || ''), label); b.type = 'button'; b.addEventListener('click', (e) => { e.stopPropagation(); if (pointerAllowed()) fn(); }); return b; };

function showDialog(kind, nodes) {
  state.modal = kind;
  el.dialog.replaceChildren(...nodes);
  el.modal.hidden = false;
  el.modal.classList.toggle('tour', kind === 'tour');
  el.dialog.classList.toggle('manual', kind === 'tour');
  el.dialog.classList.toggle('cap', kind === 'cap');
  const first = el.dialog.querySelector('textarea, .primary') || el.dialog.querySelector('button');
  if (first) first.focus({ preventScroll: true });
}
function closeDialog() {
  state.modal = null;
  el.modal.hidden = true;
  document.querySelectorAll('.tour-hl').forEach((n) => n.classList.remove('tour-hl'));
  el.search.focus({ preventScroll: true });
}
function whenTapMode(fn) {
  const t0 = performance.now();
  const tick = () => {
    if (state.done || state.modal || el.search.value) return; // closed, or already busy: don't interrupt
    if (!state.holding) return fn();
    if (performance.now() - t0 < 10000) setTimeout(tick, 150); // Alt still held from the shortcut: wait for the release
  };
  setTimeout(tick, 350);
}

// Asks for the optional tabGroups permission (needs a click). Granting it makes Chrome
// tab groups appear as sections, and lets Tabatha keep groups after they are closed.
async function enableGroups() {
  if (state.groupsOn) return true;
  asking = true;
  let ok = false;
  try { ok = await chrome.permissions.request({ permissions: ['tabGroups'] }); } catch {}
  asking = false;
  window.focus();
  if (!ok || state.done) return false;
  chrome.runtime.sendMessage({ type: MSG.GROUPS }).catch(() => {});
  await load();
  refresh();
  if (state.modal === 'tour') tourStep(tourAt); // redraw the step: it now says the groups are on
  return true;
}

// ---- the walkthrough: one list of steps, always written against today's interface (part D of the 1.3.5 plan).
// since = the version a feature first appeared; changed = the last version its look or place changed. When
// a feature goes, its step is deleted; when it moves or changes, the step is rewritten and `changed` bumped.
// So nobody is ever shown something that is gone, and an update from any version shows the current look.
// A new install (and "How it works") gets every step; an update from V gets the steps newer than V, marked
// New / Moved / Changed, then the fixes since V. Steps whose `when()` is false or whose target isn't on
// screen are skipped.
const keyRows = (...rows) => { const d = h('div', 'keys'); rows.forEach(([keys, word]) => { const k = h('span'); k.append(...keys); d.append(k, h('span', '', word)); }); return d; };
const WALK = [
  { id: 'press', since: '1.3.0', title: () => t('tour1Title', IS_MAC ? 'Option+Q' : 'Alt+Q'), hl: '.card[aria-selected="true"]', say: () => t('tour1Say'), body: () => [para(t('tour1Body'))] },
  { id: 'move', since: '1.3.0', title: () => t('tour2Title'), hl: '.card[aria-selected="true"]', body: () => [keyRows([[K('←'), K('→'), K('↑'), K('↓')], t('keyPick')], [[K('Enter')], t('keyOpen')], [[K('Del', '⌘⌫')], t('keyClose')], [[K('Esc')], t('keyLeave')])] },
  { id: 'search', since: '1.3.0', title: () => t('tour3Title'), hl: '.search', body: () => [para(t('tour3Body')), keyRows([[K('Ctrl+F', '⌘F')], t('keySearch')])] },
  { id: 'view', since: '1.3.5', title: () => t('walkViewTitle'), hl: '#group-by', body: () => [para(t('walkViewBody'))] },
  { id: 'windows', since: '1.3.3', changed: '1.3.5', title: () => t('tourWinTitle'), hl: '#wins', when: () => state.windows.length > 1, body: () => [para(t('tourWinBody'))] },
  { id: 'many', since: '1.3.3', changed: '1.3.4', moved: true, title: () => t('tourManyTitle'), hl: '.card[aria-selected="true"] .head', body: () => [para(t('tourManyBody'))] },
  { id: 'panel', since: '1.3.3', changed: '1.3.5', title: () => t('tourPanelTitle'), hl: () => (state.panel ? '#panel' : '#panel-btn'), say: () => t('tour4Say'), body: () => [
    para(t('tourPanelBody')), ...(state.groupsOn ? [para(t('tour4On'))] : [])] },
  { id: 'settings', since: '1.3.3', title: () => t('tourSetTitle'), hl: '#settings-btn', body: () => [para(t('tourSetBody'))] },
  { id: 'tell', since: '1.3.2', title: () => t('tour5Title'), hl: '#feedback-btn', say: () => t('tour5Say'), body: () => [para(t('tour5Body'))] },
];
// What was fixed in each version, for "Also fixed since you last looked". Delete a line when it stops being true.
const FIXES = {
  '1.3.5': ['fix135Dark', 'fix135Previews', 'fix135Smooth'],
  '1.3.4': ['fix134CloseHere', 'fix134Capture', 'fix134Clicks', 'fix134Frozen'],
};
const MAX_FIX_LINES = 6;
const VERSION = chrome.runtime.getManifest().version;
const stepTarget = (step) => { const sel = typeof step.hl === 'function' ? step.hl() : step.hl; return sel ? document.querySelector(sel) : null; };
const newer = (v, from) => !!v && cmpVersion(v, from) > 0;
function fixLines(from) {
  return Object.keys(FIXES).filter((v) => newer(v, from) && cmpVersion(v, VERSION) <= 0)
    .sort((x, y) => cmpVersion(y, x)).flatMap((v) => FIXES[v]);
}
// The steps for someone coming from version `from` ('' = everything, as an introduction).
function walkSteps(from) {
  const shown = (s) => (!s.when || s.when()) && (!s.hl || !!(stepTarget(s) && stepTarget(s).getClientRects().length));
  let steps = WALK.filter(shown);
  if (!from) return steps;
  steps = steps.filter((s) => newer(s.since, from) || newer(s.changed, from))
    .map((s) => ({ ...s, mark: newer(s.since, from) ? 'walkNew' : s.moved ? 'walkMoved' : 'walkChanged' }));
  const fixes = fixLines(from);
  if (fixes.length) steps.push({ id: 'fixes', title: () => t('walkFixesTitle'), body: () => {
    const ul = h('ul', 'news');
    for (const k of fixes.slice(0, MAX_FIX_LINES)) ul.append(h('li', '', t(k)));
    if (fixes.length > MAX_FIX_LINES) ul.append(h('li', 'more', tn('walkFixesMore', fixes.length - MAX_FIX_LINES)));
    return [ul];
  } });
  return steps;
}
let TOUR = [];
let tourAt = 0;
// Starts the walkthrough. Nothing to show (an update that changed nothing visible): it just counts as seen.
function startWalk(from = '') {
  TOUR = walkSteps(from);
  if (!TOUR.length) return endTour();
  tourStep(0);
}
function tourStep(i) {
  tourAt = Math.max(0, Math.min(TOUR.length - 1, i));
  const step = TOUR[tourAt];
  const last = tourAt === TOUR.length - 1;
  document.querySelectorAll('.tour-hl').forEach((n) => n.classList.remove('tour-hl'));
  const target = stepTarget(step);
  if (target) target.classList.add('tour-hl');
  const row = h('div', 'row');
  row.append(h('span', 'stepof', `${tourAt + 1} / ${TOUR.length}`), h('span', 'grow'));
  if (step.id === 'panel' && !state.groupsOn) row.append(button(t('groupsOn'), '', enableGroups));
  if (step.id === 'tell') // Save first: opening the tab can close the switcher (and cut off an unfinished write).
    row.append(button(t('tellMe'), '', async () => { await updateOnboard({ tour: true, flyout: true }).catch(() => {}); clearWnFrom().catch(() => {}); openUrl(feedbackUrl()); }));
  if (tourAt > 0) row.append(button(t('back'), 'quiet', () => tourStep(tourAt - 1)));
  if (!last) row.append(button(t('skip'), 'quiet', endTour));
  row.append(button(t(last ? 'done' : 'next'), 'primary', () => (last ? endTour() : tourStep(tourAt + 1))));
  const title = h('h3', '', step.title());
  title.id = 'dlg-title';
  if (step.mark) title.append(h('span', 'mark', t(step.mark)));
  const num = h('span', 'num', String(tourAt + 1));
  const says = h('div', 'says');
  says.append(ybit(step.say ? 'happy' : 'idle', 3));
  if (step.say) says.append(h('span', 'bubble', step.say()));
  showDialog('tour', [num, title, ...step.body(), says, row]);
  placeTour(target);
}

// The tour card sits next to what it talks about, on the side with the most room, so it covers as
// little of the switcher as it can. With nothing to point at, it sits in the middle.
function placeTour(target) {
  const d = el.dialog;
  d.style.left = d.style.top = '';
  d.removeAttribute('data-side');
  if (!target) return;
  if (target.scrollIntoViewIfNeeded) target.scrollIntoViewIfNeeded(false);
  const r = target.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
  const w = d.offsetWidth, h = d.offsetHeight, gap = 18;
  const room = { right: W - r.right, left: r.left, below: H - r.bottom, above: r.top };
  // Things along the top strip (the search box, the toolbar) get the card below them; others beside.
  const topStrip = r.bottom < 150 && room.below >= h + gap;
  const side = topStrip ? 'below' : room.right >= w + gap ? 'right' : room.left >= w + gap ? 'left' : room.below >= h + gap ? 'below' : room.above >= h + gap ? 'above' : 'right';
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  let x, y;
  if (side === 'right' || side === 'left') { x = side === 'right' ? r.right + gap : r.left - gap - w; y = clamp(r.top + r.height / 2 - h / 2, 12, H - h - 12); }
  else { y = side === 'below' ? r.bottom + gap : r.top - gap - h; x = clamp(r.left + r.width / 2 - w / 2, 12, W - w - 12); }
  d.style.left = clamp(x, 12, W - w - 12) + 'px';
  d.style.top = clamp(y, 12, H - h - 12) + 'px';
  d.dataset.side = side;
  // the arrow points at the middle of the target
  d.style.setProperty('--ax', clamp(r.left + r.width / 2 - parseFloat(d.style.left), 48, w - 18) + 'px');
  d.style.setProperty('--ay', clamp(r.top + r.height / 2 - parseFloat(d.style.top), 48, h - 18) + 'px'); // below the step number in the corner
}
function endTour() {
  updateOnboard({ tour: true, flyout: true }).catch(() => {});
  clearWnFrom().catch(() => {}); // seen: the walkthrough for this update is done
  closeDialog();
  el.pro.hidden = !SHOW_PRO;
}

// ---- "Want previews for all of them?" (part C of the 1.3.5 plan). Chrome only lets Tabatha screenshot the tab
// on screen, so a new install sees cards without previews. The card offers the existing capture run, sized by
// how many tabs need one: N = awake tabs Tabatha can capture that have no preview (sleeping ones are left
// asleep, pages Chrome refuses are mentioned). Order: most recently used first, so Stop leaves the useful ones.
const SECS_PER_TAB = 0.6;
const RECENT_FIRST = 50;
const tabsNoun = (n) => tn('capTabs', n);
// "about 5 seconds", "about 2 minutes": rounded up to 5 s under a minute, to whole minutes above.
function capTime(n, short = false) {
  const s = n * SECS_PER_TAB;
  if (s < 59) { const v = Math.max(5, Math.ceil(s / 5) * 5); return short ? t('capSecShort', v) : tn('capSec', v); }
  const m = Math.max(1, Math.round(s / 60));
  return short ? t('capMinShort', m) : tn('capMin', m);
}
// The tabs a capture card is about. `scoped`: only what the view shows (the toolbar button); else every tab.
function capPlan(scoped) {
  if (!state.hostOk) return null;
  const pool = scoped ? state.sections.flatMap((x) => x.entries).filter((e) => e.kind === 'tab').map((e) => e.tab) : state.tabs;
  const order = new Map(state.tabs.map((x, i) => [x.id, i])); // most recently used first
  const bare = pool.filter((x) => !x.active && !state.previews[x.id]);
  const todo = bare.filter(canCapture).sort((x, y) => order.get(x.id) - order.get(y.id));
  const sleeping = bare.filter((x) => x.discarded).length;
  const refused = bare.filter((x) => !x.discarded && !canCapture(x)).length;
  // total/wins: every tab the card is about (with or without a preview), for the heading; the tier follows todo.length.
  return { todo, sleeping, refused, total: pool.length, wins: new Set(pool.map((x) => x.windowId)).size, here: todo.filter((x) => x.windowId === CTX.srcWin) };
}
// More than half of the open tabs Tabatha could capture have no preview (an updater gets the card then).
function mostlyBare() {
  const can = state.tabs.filter((x) => !x.active && canCapture(x));
  return can.length > 0 && can.filter((x) => !state.previews[x.id]).length * 2 > can.length;
}
// Shows the card. `walk` (first run and updates only): the walkthrough to start after "Later", or after the run
// once Tabatha has reopened ('' = all of it, a version = what changed since). Returns false when there is nothing to offer.
function offerCapture({ scoped = false, first = false, walk = null } = {}) {
  const plan = capPlan(scoped);
  if (!plan || !plan.todo.length) return false;
  const n = plan.todo.length, w = plan.wins, all = plan.total; // n picks the tier, times and buttons; all is what the heading counts
  const answered = () => (first ? updateOnboard({ cap: VERSION }).catch(() => {}) : Promise.resolve());
  const later = async () => { await answered(); closeDialog(); if (walk !== null) startWalk(walk); };
  const go = (tabs) => async () => { await answered(); runCapture(tabs.map((x) => x.id), { scoped, walk }); };
  let head, body;
  const btns = [];
  if (n <= 10) {
    head = t('capH1', tabsNoun(all)); body = t('capB1', capTime(n));
    btns.push([t('capThem'), go(plan.todo)]);
  } else if (n <= 40) {
    head = w > 1 ? t('capH2', tabsNoun(all), tn('capWins', w)) : t('capH1', tabsNoun(all)); body = t('capB2', capTime(n));
    btns.push([t('capAll'), go(plan.todo)]);
  } else if (n <= 100) {
    head = w > 1 ? t('capH3', tabsNoun(all), tn('capWins', w)) : t('capH3One', tabsNoun(all)); body = t('capB3', capTime(n));
    btns.push([t('capAllTime', capTime(n, true)), go(plan.todo)]);
    if (w > 1 && plan.here.length && plan.here.length * 2 < n) btns.push([t('capHere', plan.here.length), go(plan.here)]);
  } else {
    head = t(n <= 300 ? 'capH4' : 'capH5', tabsNoun(all)); body = t(n <= 300 ? 'capB4' : 'capB5', capTime(n), RECENT_FIRST);
    btns.push([t('capRecent', RECENT_FIRST, capTime(RECENT_FIRST, true)), go(plan.todo.slice(0, RECENT_FIRST))]);
    btns.push([t('capAllN', n, capTime(n, true)), go(plan.todo)]);
  }
  const title = h('h3', '', head);
  title.id = 'dlg-title';
  const nodes = [title, ...(n < all ? [h('p', 'capcount', tn('capNoPrev', n))] : []), para(body)]; // "12 of them have no preview yet." only when some already have one
  const notes = [];
  if (plan.sleeping) notes.push(tn('capSleeping', plan.sleeping));
  if (plan.refused) notes.push(tn('capRefused', plan.refused));
  if (notes.length) { // one box, one note per line
    const box = h('p', 'note');
    notes.forEach((x, i) => { if (i) box.append(document.createElement('br')); box.append(x); });
    nodes.push(box);
  }
  const says = h('div', 'says capbit'); // Y-bit leads: Y-bit, heading, text, note, buttons
  says.append(ybit('happy', 3));
  const row = h('div', 'row cap');
  btns.forEach(([label, fn], i) => row.append(button(label, i ? '' : 'primary', fn)));
  row.append(h('span', 'grow'), button(t('later'), 'quiet', later));
  state.capLater = later;
  showDialog('cap', [says, ...nodes, row]);
  return true;
}
// The existing capture run (lib/sweep.js): Tabatha steps aside, the progress card with Stop shows, and
// Tabatha opens again where it was (same window, filter and search), in either mode.
function runCapture(tabIds, { scoped = false, walk = null } = {}) {
  const sel = state.entries[state.sel];
  setResume({ query: scoped ? state.query : '', scope: scoped ? state.scope : 'all', starred: scoped && state.starOnly, key: sel ? sel.key : null, walk, ttl: 20000 + tabIds.length * 4000 }).catch(() => {});
  asking = true; // the progress window takes focus: that is not the user leaving
  chrome.runtime.sendMessage({ type: MSG.SWEEP, tabIds, reopen: CTX.srcTab })
    .then((r) => { asking = false; if (r && r.n) finish('switch'); else { takeResume().catch(() => {}); closeDialog(); toast(t('sweepNothing')); } })
    .catch(() => { asking = false; closeDialog(); toast(t('actFailed')); });
}

// ---- "How is Tabatha working for you?": two steps, at most twice (lib/review.js has the timing).
// Same rules for everyone, and every answer still offers the store review. The answer itself stays
// on this computer; the buttons only open pages on the site, where people send what they choose.
const openUrl = async (url) => { try { await chrome.tabs.create({ url, windowId: CTX.srcWin, active: true }); } catch {} finish('switch'); };
const reviewDone = () => updateReview((r) => ({ ...r, done: true })).catch(() => {});
const goReview = async () => { await reviewDone(); openUrl(REVIEW_URL); };
const goPro = async (from) => openUrl(siteUrl('/pro', from));

function askStep1() {
  const title = h('h3', '', t('askTitle'));
  title.id = 'dlg-title';
  const faces = h('div', 'faces');
  for (const [label, mood] of [['moodGood', 'good'], ['moodOkay', 'okay'], ['moodBad', 'bad']]) faces.append(button(t(label), '', () => askStep2(mood)));
  const row = h('div', 'row');
  row.append(button(t('dontAsk'), 'quiet', () => { reviewDone(); closeDialog(); }), h('span', 'grow'), button(t('notNow'), 'quiet', closeDialog));
  showDialog('ask', [title, para(t('askBody')), faces, row]);
}
function askStep2(mood) {
  const good = mood === 'good';
  const title = h('h3', '', t(good ? 'askGoodTitle' : 'askBadTitle'));
  title.id = 'dlg-title';
  const row = h('div', 'row');
  if (good) row.append(button(t('reviewBtn'), 'primary', goReview));
  else row.append(button(t('surveyBtn'), 'primary', async () => { await reviewDone(); openUrl(siteUrl('/survey', 'extension-prompt', '&mood=' + mood)); }), button(t('reviewBtn'), '', goReview));
  row.append(h('span', 'grow'), button(t('notNow'), 'quiet', closeDialog));
  // The Pro waitlist, offered to everyone who answered, as its own eye-catching button.
  const pro = h('button', 'pixbtn pro wide');
  pro.type = 'button';
  pro.innerHTML = ICON.crown;
  pro.append(h('span', '', t('proAsk')));
  pro.addEventListener('click', async (e) => { e.stopPropagation(); if (!pointerAllowed()) return; await reviewDone(); goPro('extension-prompt'); });
  showDialog('ask', [title, para(t(good ? 'askGoodBody' : 'askBadBody')), row, h('hr'), pro, h('p', 'note', t('askNote'))]);
}
function askLater() { closeDialog(); }

// ---- is capturing working? Say so when it isn't, and offer the fix.
// Chrome lets users set an extension's "Site access" to "On click", which withholds the access
// Tabatha needs to screenshot pages and to react to Alt+Q on them. Detect that, and say why a
// preview is missing when the screenshot itself failed.
// `detail` (Chrome's own wording, for whoever wants it) goes in the tooltip, never on screen.
function showAlert(text, label, fn, detail = '', later = null) {
  el.alertText.textContent = text;
  el.alert.title = detail;
  el.alertBtn.hidden = !label;
  el.alertBtn.onclick = label ? (e) => { e.stopPropagation(); if (pointerAllowed()) fn(); } : null;
  if (label) el.alertBtn.textContent = label;
  el.alertLater.hidden = !later;
  el.alertLater.onclick = later ? (e) => { e.stopPropagation(); if (pointerAllowed()) later(); } : null;
  if (later) el.alertLater.textContent = t('shortcutLater');
  el.alert.hidden = false;
  setTop();
}
async function requestHostAccess() {
  asking = true;
  let ok = false;
  try { ok = await chrome.permissions.request({ origins: ['<all_urls>'] }); } catch {}
  asking = false;
  window.focus();
  if (!ok || state.done) return;
  showAlert(t('hostThanks'));
  setTimeout(() => { if (!state.done) { el.alert.hidden = true; render(); } }, 3500);
}
// Tabs the current view shows (window, star filter, search) that have no preview yet.
function missingPreviews() {
  return state.sections.flatMap((x) => x.entries).map((e) => e.tab)
    .filter((x) => !x.active && canCapture(x) && !state.previews[x.id]);
}
function updateSweepButton() {
  const n = missingPreviews().length;
  const scoped = state.scope !== 'all' || state.starOnly || state.query;
  el.sweepBtn.hidden = !state.hostOk || n === 0;
  el.sweepText.textContent = tn(scoped ? 'sweepThese' : 'sweepAll', n);
  el.sweepBtn.title = t(scoped ? 'sweepTitleThese' : 'sweepTitleAll') + ' ' + t('sweepTitleOne');
}
// Chrome's error text for a failed screenshot, in plain words (null = not worth mentioning).
function plainCaptureError(msg) {
  const m = String(msg || '');
  if (/MAX_CAPTURE|quota|per second/i.test(m)) return null; // we just went too fast: it retries by itself
  if (/invoked|activeTab|permission|host/i.test(m)) return { text: t('capErrHost'), fix: true };
  if (/chrome:|extensions gallery|cannot access/i.test(m)) return { text: t('capErrPage') };
  return { text: t('capErrOther') };
}
const SHORTCUT_QUIET_MS = 7 * 24 * 3600 * 1000; // "Not now" on the Alt+Q note keeps it away for a week
async function healthCheck() {
  try { state.hostOk = await chrome.permissions.contains({ origins: ['<all_urls>'] }); } catch { state.hostOk = true; }
  // Alt+Q itself can be left unassigned by Chrome (another app or extension owns it): say so, with the fix.
  let shortcut = 'assigned';
  try { const c = (await chrome.commands.getAll()).find((x) => x.name === 'open-switcher'); if (c && !c.shortcut) shortcut = 'missing'; } catch {}
  if (shortcut === 'missing') {
    const said = (await chrome.storage.local.get(KEY.SHORTCUT_LATER).catch(() => ({})))[KEY.SHORTCUT_LATER] || 0;
    if (Date.now() - said > SHORTCUT_QUIET_MS) {
      return showAlert(t('shortcutMissing', IS_MAC ? 'Option+Q' : 'Alt+Q'), t('shortcutFix'), () => openUrl('chrome://extensions/shortcuts'), '', () => {
        chrome.storage.local.set({ [KEY.SHORTCUT_LATER]: Date.now() }).catch(() => {});
        el.alert.hidden = true;
        render();
      });
    }
  }
  if (CTX.via === 'icon') toast(t('iconTip', IS_MAC ? 'Option+Q' : 'Alt+Q'));
  if (!state.hostOk) showAlert(t('hostBlocked'), t('hostAllow'), requestHostAccess, t('hostBlockedTip'));
  else {
    const cur = state.entries.find((e) => e.kind === 'tab' && e.tab.id === CTX.srcTab);
    if (cur && !cur.preview && /^https?:/.test(urlOf(cur.tab))) {
      const n = await getCaptureNote().catch(() => null);
      const say = n && n.stage === 'error' && Date.now() - n.t < 120000 ? plainCaptureError(n.msg) : null;
      if (say) showAlert(say.text, say.fix ? t('hostAllow') : '', requestHostAccess, `${n.host || t('thisPage')}: ${n.msg}`);
    }
  }
  updateSweepButton();
}

// Y-bit peeks out from behind the Pro / coffee buttons: once a day a few seconds after opening (never
// during the tour or a dialog), and whenever the pointer is on one of those buttons.
let peekTimer = null;
let peekFace = '';
const peekBox = () => el.peek.querySelector('.ybit-peek');
function face(state) {
  if (state === peekFace) return;
  peekFace = state;
  peekBox().replaceChildren(ybit(state, 3));
}
function peek(ms = 2600) {
  if (state.modal || state.done) return;
  const target = !el.pro.hidden ? el.pro : !el.coffee.hidden ? el.coffee : null;
  if (!target) return;
  face('happy');
  el.peek.style.left = (target.offsetLeft + 10) + 'px';
  el.peek.classList.add('up');
  el.peek.classList.toggle('wave', !!ms);
  clearTimeout(peekTimer);
  if (ms) peekTimer = setTimeout(() => { el.peek.classList.remove('up', 'wave'); }, ms);
}
// While Y-bit is out, its eyes follow the pointer; a click anywhere makes it smile.
window.addEventListener('mousemove', (e) => {
  if (!el.peek.classList.contains('up')) return;
  const r = el.peek.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2);
  face(dx < -40 ? 'lookL' : dx > 40 ? 'lookR' : 'idle');
});
window.addEventListener('mousedown', () => { if (el.peek.classList.contains('up')) { face('happy'); setTimeout(() => { peekFace = ''; }, 700); } });
async function dailyPeek() {
  const today = dayOf();
  const o = await chrome.storage.local.get(KEY.PEEK).catch(() => ({}));
  if (o[KEY.PEEK] === today) return;
  setTimeout(() => { if (state.modal || state.done) return; chrome.storage.local.set({ [KEY.PEEK]: today }).catch(() => {}); peek(); }, 3500);
}

// ---- Settings (the gear in the footer): language, and opening Tabatha when Chrome starts.
async function openSettings(anchor, { redraw = false } = {}) {
  if (!redraw && closeIfOpen(anchor)) return; // the gear again closes Settings
  document.querySelectorAll('.pop, .menu').forEach((x) => x.remove());
  const prefs = await getPrefs().catch(() => ({ lang: 'auto', startup: false }));
  const pop = h('div', 'pop settings');
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', t('settings'));
  const lang = h('select');
  lang.setAttribute('aria-label', t('setLang'));
  for (const [v, label] of [['auto', t('setLangAuto')], ['en', 'English'], ['ru', 'Русский'], ['es', 'Español']]) {
    const o = h('option', '', label); o.value = v; if (v === prefs.lang) o.selected = true; lang.append(o);
  }
  lang.addEventListener('change', async () => {
    await updatePrefs({ lang: lang.value }).catch(() => {});
    setLang(lang.value);
    localizePage();
    render();
    openSettings(anchor, { redraw: true }); // redraw this card in the new language
  });
  const start = h('input');
  start.type = 'checkbox';
  start.id = 'set-startup';
  start.checked = prefs.startup;
  start.addEventListener('change', () => updatePrefs({ startup: start.checked }).catch(() => {}));
  const startLabel = h('label', 'check', t('setStartup'));
  startLabel.prepend(start);
  const sc = h('button', 'lnk', t('setShortcut'));
  sc.type = 'button';
  sc.addEventListener('click', (e) => { e.stopPropagation(); if (pointerAllowed()) openUrl('chrome://extensions/shortcuts'); });
  pop.append(h('h4', '', t('settings')), h('label', '', t('setLang')), lang, startLabel, h('p', 'pfine', t('setStartupNote')), sc);
  pop.addEventListener('click', (e) => e.stopPropagation());
  pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); pop.remove(); el.search.focus(); } });
  pop._anchor = anchor;
  el.app.append(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.left = Math.max(12, r.left) + 'px';
  pop.style.top = Math.max(12, r.top - pop.offsetHeight - 10) + 'px';
  const close = (e) => { if (!pop.contains(e.target) && !anchor.contains(e.target)) { pop.remove(); document.removeEventListener('mousedown', close, true); } };
  setTimeout(() => document.addEventListener('mousedown', close, true), 0);
}

// Runs once per open, after the first render.
async function firstRun() {
  let onb = { tour: true }, rv = null, firstToday = false;
  const today = dayOf();
  try {
    [onb, rv] = await Promise.all([getOnboard(), updateReview((r) => { firstToday = r.day !== today; return { ...r, opens: r.opens + 1, day: today }; })]);
    if (!onb.flyout) updateOnboard({ flyout: true }).catch(() => {}); // opened once: the "press Alt+Q" flyout has done its job
  } catch { return; }
  el.pro.hidden = !SHOW_PRO || !onb.tour; // the waitlist button appears once the tour has been seen
  // A new install: the capture card (once), then the whole walkthrough. After "Capture" Tabatha closes for the
  // run and opens again; onb.cap is set by then, so this open goes straight on to the walkthrough.
  if (!onb.tour) return whenTapMode(() => { if (onb.cap || !offerCapture({ first: true, walk: '' })) startWalk(); });
  // An update: what changed since the version it came from, once (the capture card first if most previews are missing).
  const from = await getWnFrom().catch(() => '');
  if (from && cmpVersion(from, VERSION) >= 0) clearWnFrom().catch(() => {}); // nothing newer to show (a downgrade, or a reload)
  else if (from) { // that's enough for this open: no peek, no question
    return whenTapMode(() => { if (onb.cap === VERSION || !mostlyBare() || !offerCapture({ first: true, walk: from })) startWalk(from); });
  }
  dailyPeek();
  const plan = reviewPrompt(rv, Date.now(), { firstToday });
  if (plan === 'ask') {
    updateReview((r) => ({ ...r, asks: r.asks + 1, lastAsk: Date.now() })).catch(() => {});
    whenTapMode(askStep1);
  }
}

// While a dialog is open it takes the keyboard: Esc closes it, the tour has arrow keys,
// everything else (Tab, Enter, typing in the feedback box) works on the dialog itself.
function dialogKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return state.modal === 'tour' ? endTour() : state.modal === 'cap' ? state.capLater() : askLater(); }
  if (state.modal === 'tour' && !e.altKey && !e.ctrlKey && !e.metaKey) {
    if (e.key === 'ArrowRight') { e.preventDefault(); tourAt < TOUR.length - 1 ? tourStep(tourAt + 1) : endTour(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); tourStep(tourAt - 1); }
  }
}

// ------------------------------------------------------------------ input
const MODIFIERS = new Set(['Alt', 'Control', 'Meta']);

// Is Option/Alt down right now (without Ctrl, so AltGr typing still works)?
// On a Mac, Option+letter types a symbol (Option+W is "∑") through the
// system's text input, which can slip past a cancelled keydown and even
// start a composition. So the search box also refuses text while it's down.
let altDown = false;
function trackAlt(e) { altDown = e.altKey && !e.ctrlKey; }

function onKeyDown(e) {
  if (state.done) return;
  trackAlt(e);
  if (state.modal) return dialogKey(e);
  // Typing in any field other than the search box (a group name, a bookmark, Settings), or pressing a
  // button in the panel, a card or a menu: the key belongs to that field or button, not to the switcher.
  const target = e.target instanceof Element ? e.target : null;
  const own = target && target.closest('#panel, .pop, .menu, .promo'); // .promo: the Pro and coffee buttons
  if (target && target !== el.search && target.matches('input, select, textarea')) {
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      if (target.closest('#panel')) cancelEdit();
      else { document.querySelectorAll('.pop, .menu').forEach((x) => x.remove()); el.search.focus({ preventScroll: true }); }
    }
    return;
  }
  // An open ⋯ menu: arrows move between its items; Esc and Tab close it (not the switcher behind it).
  const menuEl = target && target.closest('.menu');
  if (menuEl && ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape', 'Tab'].includes(e.key)) {
    e.preventDefault(); e.stopPropagation();
    if (e.key === 'Escape' || e.key === 'Tab') { menuEl.remove(); el.search.focus({ preventScroll: true }); return; }
    const items = [...menuEl.querySelectorAll('.mi')];
    const i = items.indexOf(target);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1
      : (i + (e.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
    if (items[next]) items[next].focus({ preventScroll: true });
    return;
  }
  if (own && (e.key === 'Enter' || e.key === ' ')) return;
  const typing = document.activeElement === el.search && el.search.value !== '';
  const k = e.key;
  const altOnly = e.altKey && !e.ctrlKey && !e.metaKey;
  // Our Alt shortcuts must work even if the text system thinks it's composing.
  if (e.isComposing && !(altOnly && ['KeyQ', 'KeyW', 'KeyS', 'KeyP'].includes(e.code))) return;
  // A fresh modifier press, or any key without a modifier, means the user
  // had already let go of the shortcut: from now on it's "tap" mode.
  if ((MODIFIERS.has(k) && !e.repeat) || (!e.altKey && !e.ctrlKey && !e.metaKey)) state.holding = false;

  // Close the selected tab: Del, or Cmd+Backspace on a Mac (its "delete"
  // key is Backspace, which the search box needs).
  const closeKey = !typing && (k === 'Delete' || (IS_MAC && e.metaKey && k === 'Backspace'));

  // Hidden or covered by the page: don't act on keys the user can't see the
  // effect of - just get out of the way.
  const acts = k === 'Enter' || closeKey || (altOnly && ['KeyQ', 'KeyW', 'KeyS', 'KeyP'].includes(e.code));
  if (acts && !keysAllowed()) { e.preventDefault(); finish('cancel'); return; }

  // Holding the key sends repeats: close one tab per press, not one per repeat.
  if (closeKey) { e.preventDefault(); if (e.repeat) return; return closeTab(state.entries[state.sel]); }
  if (altOnly && e.code === 'KeyQ') { e.preventDefault(); return qPress(e.shiftKey ? -1 : 1); }
  if (altOnly && e.code === 'KeyW') { e.preventDefault(); return cycleScope(e.shiftKey ? -1 : 1); }
  if (altOnly && e.code === 'KeyS') { e.preventDefault(); if (!e.repeat) star(state.entries[state.sel]); return; }
  if (altOnly && e.code === 'KeyP') { e.preventDefault(); if (!e.repeat) captureOne(state.entries[state.sel]); return; }
  if (e.ctrlKey && (k === 'ArrowLeft' || k === 'ArrowRight')) { e.preventDefault(); return cycleScope(k === 'ArrowRight' ? 1 : -1); }
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyF') { e.preventDefault(); el.search.focus(); el.search.select(); return; }

  switch (k) {
    case 'Escape':
      e.preventDefault();
      e.stopPropagation();
      if (el.search.value) { el.search.value = ''; state.query = ''; refresh(); }
      else if (state.picked.size) clearPicks(); // first the ticks (also in the duplicates view), then the view
      else if (state.dupesView) dupesView(false);
      else finish('cancel');
      return;
    case 'Enter': e.preventDefault(); return choose(state.sel);
    case 'Tab': e.preventDefault(); return cycle(e.shiftKey ? -1 : 1);
    case 'ArrowRight': if (!typing) { e.preventDefault(); moveSpatial(1, 0); } return;
    case 'ArrowLeft': if (!typing) { e.preventDefault(); moveSpatial(-1, 0); } return;
    case 'ArrowDown': e.preventDefault(); return moveSpatial(0, 1);
    case 'ArrowUp': e.preventDefault(); return moveSpatial(0, -1);
    default:
      if (MODIFIERS.has(k)) { e.preventDefault(); return; }
      // Option/Alt + a key types symbols on a Mac (Option+Shift+4 is "›").
      // With Alt still down from the shortcut, that's a slip, not a search.
      if (altOnly && k.length === 1 && !el.search.value) { e.preventDefault(); return; }
      if (document.activeElement !== el.search && k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        el.search.focus(); // typing anywhere goes into the search box
      }
  }
}

// Alt+Q is only a trigger: tap it and the switcher stays open for arrows,
// typing, the mouse, Enter and Esc. Holding Alt and pressing Q again cycles
// like Alt+Tab, and then releasing Alt opens the selection.
function qPress(d) {
  if (state.holding) state.cycled = true;
  cycle(d);
}

function onKeyUp(e) {
  if (state.done) return;
  trackAlt(e);
  if (e.key === 'Alt') altDown = false;
  if (state.modal) return;
  if (!MODIFIERS.has(e.key)) return;
  e.preventDefault();
  const commit = state.holding && state.cycled && !el.search.value && state.entries.length;
  state.holding = false;
  if (commit) keysAllowed() ? choose(state.sel) : finish('cancel');
}

// ------------------------------------------------------ clickjacking guard
// A hostile page can make our iframe transparent, cover it, or move it, then
// get you to click somewhere. IntersectionObserver v2 tells us whether the
// overlay is actually visible and unobstructed; clicks are ignored unless it
// has been for a moment. A popup window can't be tampered with by a page.
let visibleSince = 0;   // when the overlay last became fully visible (0 = not visible)
let everVisible = false;
let bootedAt = 0;
let paintedAt = 0;   // when the first frame was on screen
function watchVisibility() {
  bootedAt = performance.now();
  if (CTX.mode !== 'overlay') return;
  try {
    new IntersectionObserver((entries) => {
      const e = entries[entries.length - 1];
      if (e.isVisible) everVisible = true;
      visibleSince = e.isVisible ? (visibleSince || performance.now()) : 0;
    }, { trackVisibility: true, delay: 100 }).observe(el.app);
  } catch {
    visibleSince = 0; // unsupported: fail closed
  }
}
function pointerAllowed() {
  if (CTX.mode !== 'overlay') return true;
  const ok = visibleSince > 0 && performance.now() - visibleSince >= LIMITS.POINTER_VISIBLE_MS;
  // Not the short settling moment after it appeared, but the page really hiding or covering it (a dark-mode
  // filter, the page's own dialog drawn on top): a dead click helps nobody, so move into Tabatha's own window.
  if (!ok && visibleSince === 0 && paintedAt && performance.now() - paintedAt > LIMITS.VISIBLE_CONFIRM_MS) reopenAsWindow();
  return ok;
}

// The overlay is safe only while Chrome confirms it's fully visible (see above). When a page filters or covers
// it, Tabatha opens again as a small window of its own, which no page can touch, where it was (search, window,
// filter, the selection). The page and its tabs are left exactly as they are.
let movedOut = false;
function reopenAsWindow() {
  if (movedOut || state.done || CTX.mode !== 'overlay') return;
  movedOut = true;
  const sel = state.entries[state.sel];
  setResume({ query: state.query, scope: state.scope, starred: state.starOnly, key: sel ? sel.key : null }).catch(() => {});
  chrome.runtime.sendMessage({ type: MSG.TO_WINDOW, src: CTX.srcTab, win: CTX.srcWin, state: CTX.srcState, dir: CTX.dir }).catch(() => {});
  state.done = true;
  parent.postMessage({ tabatha: FRAME_MSG.CLOSE }, '*');
}
// Keys may act while the overlay is visible, and during the first moments
// before Chrome has reported visibility (so a quick Alt+Q flick still works).
function keysAllowed() {
  if (CTX.mode !== 'overlay' || visibleSince > 0) return true;
  return !everVisible && performance.now() - bootedAt < LIMITS.KEYS_GRACE_MS;
}

function listen() {
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  el.search.addEventListener('beforeinput', (e) => { if (altDown) e.preventDefault(); });
  el.search.addEventListener('input', () => {
    if (altDown && el.search.value !== state.query) { el.search.value = state.query; return; } // slipped through anyway
    state.query = el.search.value; state.sel = 0; refresh({ keepKey: '-' }); toTop();
  });
  el.newtab.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!pointerAllowed()) return;
    try { await chrome.tabs.create({ windowId: CTX.srcWin, active: true }); } catch {}
    finish('switch');
  });
  // "Buy me a coffee" opens in a new tab next to where you were.
  el.coffee.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!pointerAllowed()) return;
    try { await chrome.tabs.create({ url: COFFEE_URL, windowId: CTX.srcWin, active: true }); } catch {}
    finish('switch');
  });
  // "N without preview · Capture" opens the capture card for what the view shows.
  el.sweepBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!pointerAllowed()) return;
    if (!offerCapture({ scoped: true })) toast(t('sweepNothing'));
  });
  el.starFilter.addEventListener('click', (e) => { e.stopPropagation(); if (pointerAllowed()) toggleStarFilter(); });
  $('group-by').addEventListener('click', (e) => { e.stopPropagation(); if (pointerAllowed()) groupMenu(e.currentTarget); });
  el.sort.addEventListener('click', (e) => {
    e.stopPropagation();
    const b = e.target.closest('button[data-sort]');
    if (b && pointerAllowed()) setSort(b.dataset.sort);
  });
  const on = (node, fn) => node.addEventListener('click', (e) => { e.stopPropagation(); if (pointerAllowed()) fn(e); });
  on(el.helpBtn, () => openUrl(HELP_URL));
  on(el.feedbackBtn, () => openUrl(feedbackUrl()));
  on(el.tourBtn, () => startWalk());
  on($('settings-btn'), (e) => openSettings(e.currentTarget));
  on(el.groupsBtn, enableGroups);
  on(el.dupesBtn, closeDupes);
  on(el.pro, () => goPro('extension-button'));
  for (const b of [el.pro, el.coffee]) {
    b.addEventListener('mouseenter', () => peek(0));
    b.addEventListener('mouseleave', () => { clearTimeout(peekTimer); el.peek.classList.remove('up'); });
  }
  on(el.selAll, selectAll);
  on(el.selNone, clearPicks);
  on(el.panelBtn, () => (state.panel ? closePanel() : openPanel()));
  on(el.panelClose, closePanel);
  for (const b of el.panel.querySelectorAll('.ptab')) on(b, () => { state.ptab = b.dataset.ptab; updateView({ ptab: state.ptab }).catch(() => {}); renderPanel(); });
  // Clicking empty space (not a card, chip, button, panel, dialog or the search box) cancels.
  el.app.addEventListener('click', (e) => {
    if (!e.target.closest('.card, .chip, button, .search, .modal-back, .foot, .tools, .panel, .acts, .promo, .toast, .wins')) finish('cancel');
  });
  window.addEventListener('mousemove', (e) => {
    state.mouseReady = true;
    if (!e.altKey && !e.ctrlKey && !e.metaKey) state.holding = false;
  });
  // Focus left the switcher (address bar, another app...): close quietly.
  // Only once we actually had focus, so a window that opens unfocused (or a
  // focus hiccup while it opens) doesn't make the switcher vanish instantly.
  let hadFocus = document.hasFocus();
  window.addEventListener('focus', () => { hadFocus = true; altDown = false; });
  window.addEventListener('blur', () => setTimeout(() => {
    if (hadFocus && !asking && !document.hasFocus()) finish('blur');
  }, 80));
  window.addEventListener('resize', () => { if (!state.done) render(); });
  // In the overlay, a wheel over anything that can't scroll would scroll the web page underneath.
  window.addEventListener('wheel', (e) => {
    if (!(e.target instanceof Element) || !e.target.closest('#scroller, .pane, .wins, .modal-back')) e.preventDefault();
  }, { passive: false });

  // Only the background service worker may move the selection (content
  // scripts always have sender.tab; the worker doesn't).
  chrome.runtime.onMessage.addListener((msg, sender, respond) => {
    if (state.done || sender.id !== chrome.runtime.id || sender.tab) return;
    if (msg && msg.type === MSG.CYCLE) { qPress(msg.dir === -1 ? -1 : 1); respond({ ok: true }); }
  });
  chrome.tabs.onRemoved.addListener((id) => { if (!state.done) forgetTab(id, undefined, { follow: false }); }); // closed elsewhere (or by us, first): the view stays put
}

// ------------------------------------------------------------------- boot
// Popup window: the token is in our URL (no web page can see or frame that
// window). Overlay: the content script posts it to us after we load; the
// iframe URL carries nothing. A token for one mode is refused in the other.
function getLaunch() {
  const inFrame = window.parent !== window;
  const urlToken = new URLSearchParams(location.search).get('t');
  if (!inFrame) {
    return urlToken ? consumeLaunch(urlToken).then((c) => (c && c.mode === 'window' ? c : null)) : Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let attempts = 0;
    const done = (v) => { window.removeEventListener('message', onMsg); clearTimeout(timer); resolve(v); };
    const onMsg = async (e) => {
      const d = e.data;
      if (e.source !== window.parent || !d || d.tabatha !== FRAME_MSG.LAUNCH || typeof d.token !== 'string') return;
      if (++attempts > 5) return done(null); // someone is guessing
      const c = await consumeLaunch(d.token);
      if (c && c.mode === 'overlay') done(c);
    };
    const timer = setTimeout(() => done(null), LIMITS.LAUNCH_WAIT_MS);
    window.addEventListener('message', onMsg);
  });
}

(async () => {
  // Anything that loads this page without the token the background just
  // issued (e.g. a website framing it) gets an empty page and no listeners.
  CTX = await getLaunch();
  if (!CTX) return;
  if (CTX.via === 'resume') state.holding = false; // reopened by Tabatha after a capture run: no shortcut is held
  document.documentElement.classList.add(CTX.mode);
  await loadLang();
  localizePage();
  el.coffee.hidden = !SHOW_COFFEE;
  if (IS_MAC) {
    document.querySelectorAll('kbd[data-mac]').forEach((k) => { k.textContent = k.dataset.mac; });
  }
  listen();
  watchVisibility();
  const resume = await takeResume().catch(() => null);
  await load();
  if (resume) { // back after capturing one tab's preview: show what was there before
    state.query = el.search.value = typeof resume.query === 'string' ? resume.query : '';
    state.scope = resume.scope === 'all' || Number.isInteger(resume.scope) ? resume.scope : 'all';
    state.starOnly = !!resume.starred;
  }
  derive();
  const mru = state.mruOrder;
  const first = resume && typeof resume.key === 'string' ? resume.key : mru.length > 1 ? mru[CTX.dir < 0 ? mru.length - 1 : 1].key : null;
  const at = first ? state.entries.findIndex((e) => e.key === first) : -1;
  if (first && at < 0) { const e = mru.find((x) => x.key === first); if (e && e.sec) { state.peek.add(e.sec); derive(); } }
  state.sel = Math.max(0, first ? state.entries.findIndex((e) => e.key === first) : 0);
  el.app.hidden = false;
  document.documentElement.classList.add('intro'); // cards pop in on the first draw only, not on every redraw
  setTimeout(() => document.documentElement.classList.remove('intro'), 500);
  render();
  takeSwept().then((n) => { if (n !== null) toast(tn('capDone', n)); }).catch(() => {}); // back from a capture run
  if (CTX.mode === 'overlay') {
    parent.postMessage({ tabatha: FRAME_MSG.READY }, '*');
    // Chrome never confirmed the overlay as visible (the page filters or covers it): use a window instead.
    // Counted from the first frame on screen, so a slow first draw (hundreds of tabs) isn't taken for a covered page.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      paintedAt = performance.now();
      setTimeout(() => { if (!everVisible) reopenAsWindow(); }, LIMITS.VISIBLE_CONFIRM_MS);
    }));
  }
  window.focus();
  el.search.focus({ preventScroll: true });
  // The Pro button shows on every open once the walkthrough has been seen, including a reopen after a capture run or a
  // close of the current tab (those skip firstRun).
  if (resume) getOnboard().then((o) => { el.pro.hidden = !SHOW_PRO || !o.tour; }).catch(() => {});
  if (!resume) firstRun();
  // Back from the capture card's run: the walkthrough it was in front of comes next.
  else if (resume.walk === '' || (typeof resume.walk === 'string' && /^\d+(\.\d+){0,3}$/.test(resume.walk))) whenTapMode(() => startWalk(resume.walk));
  healthCheck();
  el.feedbackBtn.hidden = false;
  try {
    const r = await chrome.runtime.sendMessage({ type: MSG.READY });
    const extra = r && Number.isInteger(r.extra) ? r.extra : 0;
    for (let i = 0; i < Math.abs(extra); i++) qPress(Math.sign(extra));
  } catch {}
})();
