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

import { MSG, FRAME_MSG, LIMITS, COFFEE_URL, REVIEW_URL, FEEDBACK_URL } from './lib/constants.js';
import { getMru, getPreviews, getClosedLog, getSlept, consumeLaunch, getReview, updateReview, getOnboard, updateOnboard } from './lib/store.js';
import { reviewPrompt } from './lib/review.js';
import { hasGroupsApi, syncGroups, getSavedGroups, removeSavedGroup, reopenGroup } from './lib/groups.js';
import { isOwnUrl, normalizeUrl, isWorthReopening } from './lib/ext.js';

let CTX = null; // set once the launch token has been verified (see boot)

const $ = (id) => document.getElementById(id);
const el = {
  app: $('app'), bar: document.querySelector('.bar'), search: $('search'), count: $('count'),
  windows: $('windows'), scroller: $('scroller'), newtab: $('newtab'),
  openGrid: $('open-grid'), openEmpty: $('open-empty'),
  closedSection: $('closed-section'), closedGrid: $('closed-grid'),
  winHint: $('hint-win'), coffee: $('coffee'),
  savedSection: $('saved-section'), savedGrid: $('saved-grid'),
  tourBtn: $('tour-btn'), groupsBtn: $('groups-btn'),
  soft: $('soft'), modal: $('modal'), dialog: $('dialog'),
};
const GROUP_HEX = { grey: '#9aa0a6', blue: '#8ab4f8', red: '#f28b82', yellow: '#fdd663', green: '#81c995', pink: '#ff8bcb', purple: '#c58af9', cyan: '#78d9ec', orange: '#fcad70' };

// Mac keyboards: Option instead of Alt, and the "delete" key is Backspace.
const IS_MAC = /mac/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '');

// -------------------------------------------------------------------- state
const state = {
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
  armed: null,     // key of a saved group waiting for a second Delete / click on x
  modal: null,     // 'tour' | 'ask' while a dialog is open
};

// ---------------------------------------------------------------- icons
const ICON = {
  moon: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M13.5 10.2A5.8 5.8 0 0 1 5.8 2.5a5.8 5.8 0 1 0 7.7 7.7Z" fill="currentColor"/></svg>',
  history: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v2.8h2.8M8 5v3.2l2.2 1.4" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  speaker: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 6h2.5L8 3v10L4.5 10H2z" fill="currentColor"/><path d="M10.5 5.5a3.5 3.5 0 0 1 0 5M12.3 3.8a6 6 0 0 1 0 8.4" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  camera: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M2.5 5.5h2.2l1.2-1.8h4.2l1.2 1.8h2.2v7h-11z" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/><circle cx="8" cy="8.8" r="2" stroke="currentColor" stroke-width="1.3" fill="none"/></svg>',
  window: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M2 6h12" stroke="currentColor" stroke-width="1.3"/></svg>',
};

// ---------------------------------------------------------------- helpers
const urlOf = (t) => (t && (t.url || t.pendingUrl)) || '';
const favicon = (url) => chrome.runtime.getURL('/_favicon/') + '?pageUrl=' + encodeURIComponent(url) + '&size=32';
function hostOf(url) {
  try { const u = new URL(url); return u.host || u.protocol.replace(':', ''); } catch { return ''; }
}
function timeAgo(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return ''; // no timestamp: say nothing rather than "20000 d ago"
  const s = Math.max(0, Date.now() / 1000 - sec);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  return Math.round(s / 86400) + ' d ago';
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
  const order = [CTX.srcWin];
  for (const t of tabs) if (!order.includes(t.windowId)) order.push(t.windowId);
  const byAge = order.filter((id) => id !== CTX.srcWin).sort((a, b) => a - b);
  state.windows = order
    .map((id) => {
      const wt = tabs.filter((t) => t.windowId === id);
      const active = wt.find((t) => t.active) || wt[0];
      return {
        id,
        label: id === CTX.srcWin ? 'This window' : 'Window ' + (byAge.indexOf(id) + 2),
        count: wt.length,
        activeTitle: active ? active.title || '' : '',
      };
    })
    .filter((w) => w.count > 0);

  await loadGroups();
  await loadClosed();
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
    live.forEach((g) => state.groupInfo.set(g.id, { title: g.title || '', color: g.color }));
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
        id: 's' + s.window.sessionId, kind: 'window', url: urlOf(tabs[0]), title: `Window · ${tabs.length} tab${tabs.length === 1 ? '' : 's'}`,
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

function derive() {
  const q = state.query.trim().toLowerCase();
  if (state.scope !== 'all' && !state.windows.some((w) => w.id === state.scope)) state.scope = 'all';

  const open = state.tabs
    .filter((t) => state.scope === 'all' || t.windowId === state.scope)
    .filter((t) => !q || matches(q, t.title, urlOf(t)))
    .map((tab) => ({ kind: 'tab', key: 't' + tab.id, tab, preview: state.previews[tab.id] || null }));

  // Sections: each Chrome tab group (in order of its most recently used tab), then the ungrouped tabs.
  const secs = new Map();
  for (const e of open) {
    const gid = e.tab.groupId >= 0 && state.groupInfo.has(e.tab.groupId) ? e.tab.groupId : -1;
    if (!secs.has(gid)) secs.set(gid, { key: 'g' + gid, group: gid >= 0 ? state.groupInfo.get(gid) : null, entries: [] });
    secs.get(gid).entries.push(e);
  }
  const grouped = [...secs.values()].filter((x) => x.group);
  const plain = secs.get(-1);
  state.sections = plain ? [...grouped, plain] : grouped;
  state.mruOrder = open;

  const saved = state.saved
    .filter((g) => !q || matches(q, g.title, ...g.tabs.flatMap((t) => [t.ti, t.u])))
    .map((g) => ({ kind: 'saved', key: 'sg' + g.id, group: g, url: g.tabs[0].u }));
  const closed = closedFor(q).map((item) => ({ kind: 'closed', key: 'c' + item.id, item, preview: item.preview }));

  state.entries = [...state.sections.flatMap((x) => x.entries), ...saved, ...closed];
  state.openCount = open.length;
  state.savedCount = saved.length;
}

// ------------------------------------------------------------------ render
function cardWidth(n) {
  const avail = Math.min(window.innerWidth - 80, 1640);
  if (n <= 2) return Math.min(420, (avail - 20) / 2);
  if (n <= 6) return Math.min(340, (avail - 40) / 3);
  return Math.max(240, Math.min(320, (avail - 60) / 4));
}

function renderWindows() {
  const multi = state.windows.length > 1;
  el.windows.hidden = !multi;
  el.winHint.hidden = !multi;
  el.windows.textContent = '';
  if (!multi) return;
  const chips = [{ id: 'all', label: 'All windows', count: state.tabs.length, activeTitle: '' }, ...state.windows];
  for (const w of chips) {
    const b = h('button', 'chip');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(state.scope === w.id));
    if (w.activeTitle) b.title = 'Active tab: ' + w.activeTitle;
    if (w.id !== 'all') b.insertAdjacentHTML('beforeend', ICON.window);
    b.append(h('span', 'label', w.label), h('span', 'n', String(w.count)));
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!pointerAllowed()) return;
      setScope(w.id);
      el.search.focus();
    });
    el.windows.append(b);
  }
}

function windowTag(tab) {
  if (state.scope !== 'all' || state.windows.length < 2 || tab.windowId === CTX.srcWin) return null;
  const w = state.windows.find((x) => x.id === tab.windowId);
  return w ? h('span', 'tag', w.label) : null;
}

function thumbFor(entry, { label, sub, icon }) {
  const thumb = h('div', 'thumb');
  if (entry.preview && entry.preview.img) {
    const img = h('img', 'shot');
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
    box.append(tile, h('div', 'label', label || 'No preview yet'), h('div', 'sub', sub || ''));
    thumb.append(box);
  }
  return thumb;
}

function renderCard(entry, index) {
  // "Sleeping" is only for tabs Chrome unloaded while we were watching (Memory Saver
  // etc.): discarded now AND seen being discarded in this browser session. A tab that
  // is merely discarded because Chrome restored it lazily after a restart is not
  // sleeping: it shows its stored preview normally. Neither is a tab with no preview.
  const asleep = entry.kind === 'tab' && !!entry.tab.discarded && state.slept.has(entry.tab.id);
  const card = h('div', 'card' + (entry.kind === 'closed' ? ' closed' : '') + (asleep ? ' asleep' : ''));
  card.id = 'opt-' + entry.key;
  card.setAttribute('role', 'option');
  card.setAttribute('aria-selected', String(index === state.sel));

  const head = h('div', 'head');
  const fav = h('img', 'fav');
  fav.alt = '';

  if (entry.kind === 'tab') {
    const t = entry.tab;
    entry.url = urlOf(t);
    fav.src = favicon(entry.url);
    const host = hostOf(entry.url);
    head.append(fav, h('span', 'title', t.title || host || 'Untitled'));
    // The site name only fits next to the title on wider cards; narrow ones
    // keep the title readable (the full URL is in the tooltip).
    if (t.title && host && state.cardW >= 300) head.append(h('span', 'host', host.replace(/^www\./, '')));
    const tag = windowTag(t);
    if (tag) head.append(tag);
    if (t.audible) { const b = h('span', 'badge'); b.innerHTML = ICON.speaker; head.append(b); }
    const x = h('button', 'x');
    x.type = 'button';
    x.title = 'Close tab (Del)';
    x.setAttribute('aria-label', 'Close tab');
    x.innerHTML = ICON.close;
    x.addEventListener('click', (e) => { e.stopPropagation(); if (pointerAllowed()) closeTab(entry); });
    head.append(x);
    card.title = (t.title || '') + '\n' + entry.url + (asleep ? '\nSleeping: Chrome unloaded this tab to save memory. It reloads when you open it.' : '');
    // No preview just means Chrome only lets us screenshot the visible tab and
    // we haven't seen this one yet; it's an awake background tab, not asleep.
    // The placeholder shows the domain, since narrow cards hide it in the header.
    const sub = host;
    card.append(head, thumbFor(entry, asleep
      ? { label: 'Sleeping', sub, icon: ICON.moon }
      : { label: entry.preview ? '' : 'No preview yet', sub, icon: ICON.camera }));
  } else {
    const c = entry.item;
    entry.url = c.url;
    fav.src = favicon(entry.url);
    const title = c.title || hostOf(c.url);
    // Some entries (e.g. closed windows) come without a time: no time tag then.
    const ago = timeAgo(c.ts / 1000);
    head.append(fav, h('span', 'title', title));
    if (ago) head.append(h('span', 'tag', ago));
    card.title = 'Reopen: ' + title + (c.kind === 'tab' ? '\n' + c.url : '');
    card.append(head, thumbFor(entry, { label: 'Closed', sub: hostOf(entry.url), icon: ICON.history }));
  }

  card.addEventListener('click', (e) => {
    e.stopPropagation();
    if (pointerAllowed()) choose(state.entries.indexOf(entry));
  });
  card.addEventListener('auxclick', (e) => {
    if (e.button === 1 && entry.kind === 'tab') { e.preventDefault(); if (pointerAllowed()) closeTab(entry); }
  });
  card.addEventListener('mousemove', () => {
    const i = state.entries.indexOf(entry);
    if (state.mouseReady && i !== state.sel) select(i, { scroll: false });
  });
  return card;
}

function renderSaved(entry, index) {
  const g = entry.group;
  const card = h('div', 'card gcard' + (state.armed === entry.key ? ' armed' : ''));
  card.id = 'opt-' + entry.key;
  card.setAttribute('role', 'option');
  card.setAttribute('aria-selected', String(index === state.sel));
  const head = h('div', 'head');
  const dot = h('span', 'dot');
  dot.style.setProperty('--gc', GROUP_HEX[g.color] || GROUP_HEX.grey);
  head.append(dot, h('span', 'title', g.title || 'Unnamed group'), h('span', 'tag', g.tabs.length + (g.tabs.length === 1 ? ' tab' : ' tabs')));
  const x = h('button', 'x');
  x.type = 'button';
  x.title = 'Remove this saved group (Del)';
  x.setAttribute('aria-label', 'Remove saved group');
  if (state.armed === entry.key) x.textContent = 'Remove?'; else x.innerHTML = ICON.close;
  x.addEventListener('click', (e) => { e.stopPropagation(); if (pointerAllowed()) removeSaved(entry); });
  head.append(x);
  const list = h('ul', 'glist');
  for (const t of g.tabs.slice(0, 5)) {
    const li = h('li');
    const img = h('img');
    img.src = favicon(t.u);
    img.alt = '';
    li.append(img, h('span', '', t.ti || hostOf(t.u)));
    list.append(li);
  }
  if (g.tabs.length > 5) list.append(h('li', 'more', '+ ' + (g.tabs.length - 5) + ' more'));
  card.title = 'Reopen this group (' + g.tabs.length + ' tabs)';
  card.append(head, list);
  card.addEventListener('click', (e) => { e.stopPropagation(); if (pointerAllowed()) choose(state.entries.indexOf(entry)); });
  card.addEventListener('mousemove', () => {
    const i = state.entries.indexOf(entry);
    if (state.mouseReady && i !== state.sel) select(i, { scroll: false });
  });
  return card;
}

function renderSection(sec, startIndex, hasGroups) {
  const box = h('div', 'gsec' + (sec.group ? ' grouped' : ''));
  box.setAttribute('role', 'group');
  if (sec.group || hasGroups) {
    const name = sec.group ? sec.group.title || 'Unnamed group' : 'Ungrouped';
    box.setAttribute('aria-label', name);
    const head = h('div', 'ghead');
    if (sec.group) {
      const dot = h('span', 'dot');
      dot.style.setProperty('--gc', GROUP_HEX[sec.group.color] || GROUP_HEX.grey);
      box.style.setProperty('--gc', GROUP_HEX[sec.group.color] || GROUP_HEX.grey);
      head.append(dot);
    }
    head.append(h('span', '', name), h('span', 'n', String(sec.entries.length)));
    box.append(head);
  }
  const grid = h('div', 'grid');
  grid.style.setProperty('--w', state.cardW + 'px');
  grid.append(...sec.entries.map((e, i) => renderCard(e, startIndex + i)));
  box.append(grid);
  return box;
}

function render() {
  const closed = state.entries.slice(state.openCount + state.savedCount);
  const saved = state.entries.slice(state.openCount, state.openCount + state.savedCount);

  state.cardW = Math.floor(cardWidth(state.openCount));
  const hasGroups = state.sections.some((x) => x.group);
  el.openGrid.classList.toggle('has-groups', hasGroups);
  let at = 0;
  el.openGrid.replaceChildren(...state.sections.map((sec) => { const box = renderSection(sec, at, hasGroups); at += sec.entries.length; return box; }));
  el.savedGrid.replaceChildren(...saved.map((e, i) => renderSaved(e, i + state.openCount)));
  el.closedGrid.replaceChildren(...closed.map((e, i) => renderCard(e, i + state.openCount + state.savedCount)));
  el.openEmpty.hidden = state.openCount > 0;
  el.savedSection.hidden = saved.length === 0;
  el.closedSection.hidden = closed.length === 0;
  const open = { length: state.openCount };
  // Footer: offer tab groups to people who use them (or have no choice but to ask) until they turn them on.
  el.groupsBtn.hidden = state.groupsOn || !state.tabs.some((t) => t.groupId >= 0);

  const n = open.length;
  el.count.textContent = state.query ? `${n} open · ${closed.length} closed` : `${n} tab${n === 1 ? '' : 's'}`;
  renderWindows();
  el.scroller.style.setProperty('--top', el.bar.offsetHeight + (el.windows.hidden ? 0 : el.windows.offsetHeight) + 'px');
  select(state.sel, { scroll: true });
}

function refresh({ keepKey } = {}) {
  const prevKey = keepKey || (state.entries[state.sel] || {}).key;
  derive();
  const i = state.entries.findIndex((e) => e.key === prevKey);
  state.sel = i >= 0 ? i : 0;
  render();
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
  const mru = state.mruOrder;
  const n = mru.length;
  if (!n) return;
  const here = state.sel < state.openCount ? mru.indexOf(state.entries[state.sel]) : d > 0 ? -1 : n;
  select(state.entries.indexOf(mru[(((here + d) % n) + n) % n]));
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

function setScope(scope) {
  state.scope = scope;
  state.sel = 0;
  refresh({ keepKey: '-' });
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
    if (entry.kind === 'saved') {
      if (CTX.mode === 'window') await chrome.windows.update(CTX.srcWin, { focused: true }).catch(() => {});
      await reopenGroup(entry.group, CTX.srcWin);
      return finish('restore');
    }
    if (entry.kind === 'tab') {
      const t = entry.tab;
      if (t.id === CTX.srcTab && CTX.mode === 'overlay') return finish('cancel');
      await chrome.tabs.update(t.id, { active: true });
      if (CTX.mode === 'window' || t.windowId !== CTX.srcWin) {
        await chrome.windows.update(t.windowId, { focused: true });
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

// Saved groups are only ever deleted by the user: the first press asks, the second removes.
async function removeSaved(entry) {
  if (state.armed !== entry.key) {
    state.armed = entry.key;
    refresh({ keepKey: entry.key });
    setTimeout(() => { if (state.armed === entry.key) { state.armed = null; if (!state.done) refresh({ keepKey: entry.key }); } }, 3500);
    return;
  }
  state.armed = null;
  const next = [state.entries[state.sel + 1], state.entries[state.sel - 1]].find((e) => e && e !== entry);
  await removeSavedGroup(entry.group.id).catch(() => {});
  state.saved = state.saved.filter((g) => g.id !== entry.group.id);
  refresh({ keepKey: next && next.key });
}

async function closeTab(entry) {
  if (entry && entry.kind === 'saved') return removeSaved(entry);
  if (!entry || entry.kind !== 'tab' || state.done) return;
  const id = entry.tab.id;
  const i = state.entries.indexOf(entry);
  const neighbour = [state.entries[i + 1], state.entries[i - 1]].find((e) => e && e.kind === 'tab');
  try { await chrome.tabs.remove(id); } catch { return; }
  if (id === CTX.srcTab && CTX.mode === 'overlay') return; // overlay closes with its tab
  forgetTab(id, neighbour && neighbour.key);
  // Give Chrome a moment to add it to "Recently closed", then show it there.
  setTimeout(async () => { await loadClosed(); if (!state.done) refresh(); }, 200);
}

function forgetTab(id, keepKey) {
  const tab = state.tabs.find((t) => t.id === id);
  if (!tab) return;
  state.tabs = state.tabs.filter((t) => t.id !== id);
  state.windows = state.windows
    .map((w) => (w.id === tab.windowId ? { ...w, count: w.count - 1 } : w))
    .filter((w) => w.count > 0);
  refresh({ keepKey });
}

// ---------------------------------------------------------------- dialogs
// Two dialogs live in the switcher: the first-run tour and the review prompt. While one is
// open it owns the keyboard (Esc closes it, not the switcher). Neither is shown while Alt is
// still held from the shortcut, so a quick Alt+Q flick is never interrupted.
let asking = false; // a browser permission prompt is open: its focus change must not close us

const K = (win, mac) => h('kbd', '', IS_MAC && mac ? mac : win);
const para = (...parts) => { const p = h('p'); p.append(...parts); return p; };
const list = (...items) => { const u = h('ul'); items.forEach((it) => { const li = h('li'); li.append(...[].concat(it)); u.append(li); }); return u; };
const button = (label, cls, fn) => { const b = h('button', 'btn ' + (cls || ''), label); b.type = 'button'; b.addEventListener('click', (e) => { e.stopPropagation(); if (pointerAllowed()) fn(); }); return b; };

function showDialog(kind, nodes) {
  state.modal = kind;
  el.dialog.replaceChildren(...nodes);
  el.modal.hidden = false;
  el.modal.classList.toggle('tour', kind === 'tour');
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
    if (state.done) return;
    if (!state.holding) return fn();
    if (performance.now() - t0 < 1500) setTimeout(tick, 150);
  };
  setTimeout(tick, 350);
}

// Asks for the optional tabGroups permission (needs a click). Granting it makes Chrome
// tab groups appear as sections, and lets Tabatha keep groups after they are closed.
async function enableGroups() {
  if (state.groupsOn) return;
  asking = true;
  let ok = false;
  try { ok = await chrome.permissions.request({ permissions: ['tabGroups'] }); } catch {}
  asking = false;
  window.focus();
  if (!ok || state.done) return;
  chrome.runtime.sendMessage({ type: MSG.GROUPS }).catch(() => {});
  await load();
  refresh();
  if (state.modal === 'tour') tourStep(TOUR.length - 1);
}

// ---- first-run tour
const TOUR = [
  { title: 'This is Tabatha', hl: '.card[aria-selected="true"]', body: () => [
    para('Every tab you have open, with a live preview. ', K('Alt+Q', '⌥Q'), ' opened this. You can let go of the keys now: it stays open.'),
    para('Your last tab comes first, so ', K('Alt+Q', '⌥Q'), ' then ', K('Enter'), ' flips straight back to where you just were.')] },
  { title: 'Move around', hl: '#scroller', body: () => [
    list([K('←'), K('→'), K('↑'), K('↓'), ' or the mouse to pick a tab'],
         [K('Enter'), ' or a click to open it'],
         [K('Esc'), ' or a click outside to leave'],
         [K('Del', '⌘⌫'), ' closes the selected tab']),
    para('Prefer Alt+Tab style? Hold ', K('Alt', '⌥'), ' and tap ', K('Q'), ' to flick through tabs, then let go to open one.')] },
  { title: 'Find anything', hl: '.search', body: () => [
    para('Just start typing. Tabatha searches your open tabs and the tabs you closed in the last 7 days, by title or address.'),
    para('Closed tabs sit under "Recently closed". ', K('Enter'), ' brings one back.')] },
  { title: 'Lots of windows?', hl: null, body: () => [
    para('With more than one window open, the chips at the top filter by window. ', K('Alt+W', '⌥W'), ' jumps to the next one.')] },
  { title: 'Tab groups', hl: null, body: () => [
    para('Your Chrome tab groups show up as sections, with their name and colour.'),
    para('When you close a group, or its whole window, Tabatha keeps it under "Saved tab groups" until you remove it. ', K('Enter'), ' reopens it as a group.'),
    para(state.groupsOn ? 'Tab groups are on.' : 'This needs one extra permission, which Chrome asks you for when you click:')] },
];
let tourAt = 0;
function tourStep(i) {
  tourAt = Math.max(0, Math.min(TOUR.length - 1, i));
  const step = TOUR[tourAt];
  const last = tourAt === TOUR.length - 1;
  document.querySelectorAll('.tour-hl').forEach((n) => n.classList.remove('tour-hl'));
  const target = step.hl && document.querySelector(step.hl);
  if (target) target.classList.add('tour-hl');
  const dots = h('div', 'dots');
  TOUR.forEach((_, k) => dots.append(h('i', k === tourAt ? 'on' : '')));
  const row = h('div', 'row');
  row.append(dots, h('span', 'grow'));
  if (last && !state.groupsOn) row.append(button('Turn on tab groups', '', enableGroups));
  if (tourAt > 0) row.append(button('Back', 'quiet', () => tourStep(tourAt - 1)));
  if (!last) row.append(button('Skip', 'quiet', endTour));
  row.append(button(last ? 'Done' : 'Next', 'primary', () => (last ? endTour() : tourStep(tourAt + 1))));
  const title = h('h3', '', step.title);
  title.id = 'dlg-title';
  showDialog('tour', [title, ...step.body(), row]);
}
function endTour() {
  updateOnboard({ tour: true, flyout: true }).catch(() => {});
  closeDialog();
}

// ---- review prompt: a quiet banner a few times, then (much later) one dialog.
// Same rules for everyone; the review button is always offered, whatever the answer.
const openUrl = async (url) => { try { await chrome.tabs.create({ url, windowId: CTX.srcWin, active: true }); } catch {} finish('switch'); };
const reviewDone = () => updateReview((r) => ({ ...r, done: true })).catch(() => {});
const goReview = async () => { await reviewDone(); openUrl(REVIEW_URL); };

function showSoft() {
  updateReview((r) => ({ ...r, soft: r.soft + 1, lastSoft: Date.now() })).catch(() => {});
  el.soft.hidden = false;
}

function askStep1() {
  const title = h('h3', '', 'How is Tabatha working for you?');
  title.id = 'dlg-title';
  const faces = h('div', 'faces');
  for (const [label, key] of [['Love it', 'good'], ['It’s okay', 'okay'], ['Needs work', 'bad']]) faces.append(button(label, '', () => askStep2(key)));
  const row = h('div', 'row');
  row.append(h('span', 'grow'), button('Not now', 'quiet', closeDialog));
  showDialog('ask', [title, para('It takes ten seconds, and it tells me what to build next. Everything stays on your computer until you choose to send something.'), faces, row]);
}
function askStep2(mood) {
  const title = h('h3', '', mood === 'good' ? 'Glad to hear it!' : 'Thanks for being honest');
  title.id = 'dlg-title';
  const text = h('textarea');
  text.maxLength = 1000;
  text.placeholder = mood === 'good' ? 'Anything you’d like it to do next? (optional)' : 'What should be better?';
  text.setAttribute('aria-label', 'Your feedback');
  const note = h('p', 'note', 'Feedback opens a new GitHub issue with your text filled in. You can edit it before posting, and it is public. Tabatha sends nothing itself.');
  const send = () => {
    const body = (text.value.trim() || '(no details)') + '\n\n---\nTabatha ' + chrome.runtime.getManifest().version + ' · mood: ' + mood;
    reviewDone().then(() => openUrl(FEEDBACK_URL + '?title=' + encodeURIComponent('Feedback') + '&body=' + encodeURIComponent(body)));
  };
  const row = h('div', 'row');
  row.append(button('Review on the Chrome Web Store', 'primary', goReview), button('Send feedback', '', send), h('span', 'grow'), button('Not now', 'quiet', closeDialog));
  showDialog('ask', [title, para(mood === 'good'
    ? 'A review is the best way to help other people find Tabatha.'
    : 'Tell me what to fix below. If you’d like to leave a review as well, that’s always welcome.'), text, note, row]);
}
function askLater() { closeDialog(); }

// Runs once per open, after the first render.
async function firstRun() {
  let onb = { tour: true }, rv = null;
  try {
    [onb, rv] = await Promise.all([getOnboard(), updateReview((r) => ({ ...r, opens: r.opens + 1 }))]);
    if (!onb.flyout) updateOnboard({ flyout: true }).catch(() => {}); // opened once: the "press Alt+Q" flyout has done its job
  } catch { return; }
  if (!onb.tour) return whenTapMode(() => tourStep(0));
  const plan = reviewPrompt(rv);
  if (plan === 'soft') showSoft();
  else if (plan === 'ask') {
    updateReview((r) => ({ ...r, asks: r.asks + 1, lastAsk: Date.now() })).catch(() => {});
    whenTapMode(askStep1);
  }
}

// While a dialog is open it takes the keyboard: Esc closes it, the tour has arrow keys,
// everything else (Tab, Enter, typing in the feedback box) works on the dialog itself.
function dialogKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return state.modal === 'tour' ? endTour() : askLater(); }
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
  const typing = document.activeElement === el.search && el.search.value !== '';
  const k = e.key;
  const altOnly = e.altKey && !e.ctrlKey && !e.metaKey;
  // Our Alt shortcuts must work even if the text system thinks it's composing.
  if (e.isComposing && !(altOnly && (e.code === 'KeyQ' || e.code === 'KeyW'))) return;
  // A fresh modifier press, or any key without a modifier, means the user
  // had already let go of the shortcut: from now on it's "tap" mode.
  if ((MODIFIERS.has(k) && !e.repeat) || (!e.altKey && !e.ctrlKey && !e.metaKey)) state.holding = false;

  // Close the selected tab: Del, or Cmd+Backspace on a Mac (its "delete"
  // key is Backspace, which the search box needs).
  const closeKey = !typing && (k === 'Delete' || (IS_MAC && e.metaKey && k === 'Backspace'));

  // Hidden or covered by the page: don't act on keys the user can't see the
  // effect of - just get out of the way.
  const acts = k === 'Enter' || closeKey || (altOnly && (e.code === 'KeyQ' || e.code === 'KeyW'));
  if (acts && !keysAllowed()) { e.preventDefault(); finish('cancel'); return; }

  // Holding the key sends repeats: close one tab per press, not one per repeat.
  if (closeKey) { e.preventDefault(); if (e.repeat) return; return closeTab(state.entries[state.sel]); }
  if (altOnly && e.code === 'KeyQ') { e.preventDefault(); return qPress(e.shiftKey ? -1 : 1); }
  if (altOnly && e.code === 'KeyW') { e.preventDefault(); return cycleScope(e.shiftKey ? -1 : 1); }
  if (e.ctrlKey && (k === 'ArrowLeft' || k === 'ArrowRight')) { e.preventDefault(); return cycleScope(k === 'ArrowRight' ? 1 : -1); }
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyF') { e.preventDefault(); el.search.focus(); el.search.select(); return; }

  switch (k) {
    case 'Escape':
      e.preventDefault();
      e.stopPropagation();
      if (el.search.value) { el.search.value = ''; state.query = ''; refresh(); }
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
  return visibleSince > 0 && performance.now() - visibleSince >= LIMITS.POINTER_VISIBLE_MS;
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
    state.query = el.search.value; state.sel = 0; refresh({ keepKey: '-' });
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
  el.tourBtn.addEventListener('click', (e) => { e.stopPropagation(); if (pointerAllowed()) tourStep(0); });
  el.groupsBtn.addEventListener('click', (e) => { e.stopPropagation(); if (pointerAllowed()) enableGroups(); });
  $('soft-review').addEventListener('click', (e) => { e.stopPropagation(); if (pointerAllowed()) goReview(); });
  $('soft-later').addEventListener('click', (e) => { e.stopPropagation(); el.soft.hidden = true; });
  $('soft-never').addEventListener('click', (e) => { e.stopPropagation(); el.soft.hidden = true; reviewDone(); });
  // Clicking empty space (not a card, chip, button, dialog or the search box) cancels.
  el.app.addEventListener('click', (e) => {
    if (!e.target.closest('.card, .chip, button, .search, .modal-back, .foot')) finish('cancel');
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

  // Only the background service worker may move the selection (content
  // scripts always have sender.tab; the worker doesn't).
  chrome.runtime.onMessage.addListener((msg, sender, respond) => {
    if (state.done || sender.id !== chrome.runtime.id || sender.tab) return;
    if (msg && msg.type === MSG.CYCLE) { qPress(msg.dir === -1 ? -1 : 1); respond({ ok: true }); }
  });
  chrome.tabs.onRemoved.addListener((id) => { if (!state.done) forgetTab(id); });
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
  document.documentElement.classList.add(CTX.mode);
  if (IS_MAC) {
    document.querySelectorAll('kbd[data-mac]').forEach((k) => { k.textContent = k.dataset.mac; });
  }
  listen();
  watchVisibility();
  await load();
  derive();
  const mru = state.mruOrder;
  state.sel = mru.length > 1 ? state.entries.indexOf(mru[CTX.dir < 0 ? mru.length - 1 : 1]) : 0;
  el.app.hidden = false;
  render();
  if (CTX.mode === 'overlay') parent.postMessage({ tabatha: FRAME_MSG.READY }, '*');
  window.focus();
  el.search.focus({ preventScroll: true });
  firstRun();
  try {
    const r = await chrome.runtime.sendMessage({ type: MSG.READY });
    const extra = r && Number.isInteger(r.extra) ? r.extra : 0;
    for (let i = 0; i < Math.abs(extra); i++) qPress(Math.sign(extra));
  } catch {}
})();
