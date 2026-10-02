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

import { MSG, FRAME_MSG, LIMITS, COFFEE_URL } from './lib/constants.js';
import { getMru, getPreviews, consumeLaunch } from './lib/store.js';
import { isOwnUrl, normalizeUrl } from './lib/ext.js';

let CTX = null; // set once the launch token has been verified (see boot)

const $ = (id) => document.getElementById(id);
const el = {
  app: $('app'), bar: document.querySelector('.bar'), search: $('search'), count: $('count'),
  windows: $('windows'), scroller: $('scroller'), newtab: $('newtab'),
  openGrid: $('open-grid'), openEmpty: $('open-empty'),
  closedSection: $('closed-section'), closedGrid: $('closed-grid'),
  winHint: $('hint-win'), coffee: $('coffee'),
};

// Mac keyboards: Option instead of Alt, and the "delete" key is Backspace.
const IS_MAC = /mac/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '');

// -------------------------------------------------------------------- state
const state = {
  tabs: [],        // chrome.tabs.Tab[], most recently used first
  previews: {},    // tabId -> { img, url, t }
  closed: [],      // [{ session, preview }]
  windows: [],     // [{ id, label, count, activeTitle }]
  scope: 'all',    // 'all' or a windowId
  query: '',
  entries: [],     // derived: [{ kind: 'tab'|'closed', key, tab?, session?, preview }]
  openCount: 0,
  sel: 0,
  holding: true,   // Alt still held since the shortcut that opened us?
  cycled: false,   // Q pressed again while holding: releasing Alt then switches
  done: false,
  mouseReady: false,
  cardW: 320,      // current open-card width (px), set by render()
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
  const [allTabs, mru] = await Promise.all([
    chrome.tabs.query({ windowType: 'normal' }),
    getMru(),
  ]);
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

  await loadClosed();
}

async function loadClosed() {
  let sessions = [];
  try { sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 25 }); } catch {}
  // Chrome's list survives restarts and has no age limit; keep only the last
  // few hours, and don't let whole closed windows crowd out single tabs.
  const cutoff = Date.now() / 1000 - LIMITS.RECENTLY_CLOSED_MAX_AGE_S;
  let windows = 0;
  const shown = sessions
    .filter((s) => !s.lastModified || s.lastModified >= cutoff)
    .filter((s) => (s.tab ? isWorthReopening(urlOf(s.tab)) : !!(s.window && s.window.tabs && s.window.tabs.length)))
    .filter((s) => s.tab || ++windows <= LIMITS.RECENTLY_CLOSED_WINDOWS)
    .slice(0, LIMITS.RECENTLY_CLOSED);
  const urlOfSession = (s) => urlOf(s.tab || s.window.tabs[0]);
  const previews = await getPreviews(shown.map(urlOfSession));
  state.closed = shown.map((session) => ({ session, preview: previews[normalizeUrl(urlOfSession(session))] || null }));
}

// Blank pages, New Tab pages and our own pages aren't worth listing as "recently closed".
function isWorthReopening(url) {
  if (!url || isOwnUrl(url)) return false;
  return !/^(about:blank|chrome:\/\/newtab|chrome-search:|edge:\/\/newtab|brave:\/\/newtab)/.test(url);
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

  const closed = state.closed
    .filter(({ session: s }) => !q || (s.tab
      ? matches(q, s.tab.title, urlOf(s.tab))
      : s.window.tabs.some((t) => matches(q, t.title, urlOf(t)))))
    .map(({ session, preview }) => ({
      kind: 'closed', key: 'c' + (session.tab || session.window).sessionId, session, preview,
    }));

  state.entries = [...open, ...closed];
  state.openCount = open.length;
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
  // "Sleeping" is only for tabs Chrome has unloaded (tab.discarded, e.g. Memory
  // Saver). They reload when opened. A tab with no preview is not asleep.
  const asleep = entry.kind === 'tab' && entry.tab.discarded;
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
    const s = entry.session;
    const first = s.tab || s.window.tabs[0];
    entry.url = urlOf(first);
    fav.src = favicon(entry.url);
    const title = s.tab ? (s.tab.title || hostOf(entry.url)) : `Window · ${s.window.tabs.length} tabs`;
    // Some entries (e.g. closed windows) come without lastModified: no time tag then.
    const ago = timeAgo(s.lastModified);
    head.append(fav, h('span', 'title', title));
    if (ago) head.append(h('span', 'tag', ago));
    card.title = 'Reopen: ' + title + (s.tab ? '\n' + entry.url : '');
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

function render() {
  const open = state.entries.slice(0, state.openCount);
  const closed = state.entries.slice(state.openCount);

  state.cardW = Math.floor(cardWidth(open.length));
  el.openGrid.style.setProperty('--w', state.cardW + 'px');
  el.openGrid.replaceChildren(...open.map((e, i) => renderCard(e, i)));
  el.closedGrid.replaceChildren(...closed.map((e, i) => renderCard(e, i + state.openCount)));
  el.openEmpty.hidden = open.length > 0;
  el.closedSection.hidden = closed.length === 0;

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
  el.openGrid.removeAttribute('aria-activedescendant');
  el.closedGrid.removeAttribute('aria-activedescendant');
  cur.parentElement.setAttribute('aria-activedescendant', cur.id);
  if (scroll) cur.scrollIntoView({ block: 'nearest' });
}

// Alt+Q / Tab cycle through open tabs only; arrows can reach "Recently closed".
function cycle(d) {
  const n = state.openCount || state.entries.length;
  if (!n) return;
  const cur = state.sel < n ? state.sel : d > 0 ? -1 : n;
  select((((cur + d) % n) + n) % n);
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
    await chrome.sessions.restore((entry.session.tab || entry.session.window).sessionId);
    return finish('restore');
  } catch (e) {
    console.warn('[Tabatha] could not open entry:', e && e.message);
    finish('cancel');
  }
}

async function closeTab(entry) {
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

  if (closeKey) { e.preventDefault(); return closeTab(state.entries[state.sel]); }
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
  // Clicking empty space (not a card, chip, button or the search box) cancels.
  el.app.addEventListener('click', (e) => {
    if (!e.target.closest('.card, .chip, button, .search')) finish('cancel');
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
    if (hadFocus && !document.hasFocus()) finish('blur');
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
  state.sel = state.openCount > 1 ? (CTX.dir < 0 ? state.openCount - 1 : 1) : 0;
  el.app.hidden = false;
  render();
  if (CTX.mode === 'overlay') parent.postMessage({ tabatha: FRAME_MSG.READY }, '*');
  window.focus();
  el.search.focus({ preventScroll: true });
  try {
    const r = await chrome.runtime.sendMessage({ type: MSG.READY });
    const extra = r && Number.isInteger(r.extra) ? r.extra : 0;
    for (let i = 0; i < Math.abs(extra); i++) qPress(Math.sign(extra));
  } catch {}
})();
