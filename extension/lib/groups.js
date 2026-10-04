// Saved tab groups.
//
// Chrome forgets a tab group when its last tab (or its window) closes. Tabatha
// keeps a copy of every group it has seen, so a closed group stays in the
// switcher until the user removes it. While a group is open the copy is kept
// up to date; once it is gone the copy is left alone.
//
// Needs the optional "tabGroups" permission, which the user switches on from
// inside Tabatha (a required one would show a new warning and disable the
// extension on update). Nothing here leaves the device.

import { KEY, LIMITS } from './constants.js';
import { normalizeUrl, isWorthReopening } from './ext.js';
import { withLock } from './store.js';

export const GROUP_COLORS = Object.freeze(['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange']);
const L = chrome.storage.local;

export const hasGroupsApi = () => !!chrome.tabGroups;
export const groupsGranted = () => chrome.permissions.contains({ permissions: ['tabGroups'] }).catch(() => false);

const isUrl = (u) => typeof u === 'string' && u.length <= LIMITS.MAX_URL_KEY && /^(https?|file|ftp|chrome):/.test(u);
const isTab = (t) => !!t && typeof t === 'object' && isUrl(t.u) && typeof t.ti === 'string';
const isGroup = (g) => !!g && typeof g === 'object' && typeof g.id === 'string' && g.id.length <= 64
  && typeof g.title === 'string' && GROUP_COLORS.includes(g.color) && Array.isArray(g.tabs) && g.tabs.length > 0
  && g.tabs.every(isTab) && Number.isFinite(g.t) && g.t > 0 && typeof g.open === 'boolean';

function clean(v) {
  return Array.isArray(v) ? v.filter(isGroup).map((g) => ({
    ...g, title: g.title.slice(0, LIMITS.GROUP_TITLE_MAX), tabs: g.tabs.slice(0, LIMITS.MAX_GROUP_TABS),
    cid: Number.isInteger(g.cid) ? g.cid : null, b: Number.isFinite(g.b) ? g.b : 0,
  })) : [];
}

export async function getSavedGroups() {
  return clean((await L.get(KEY.GROUPS))[KEY.GROUPS]);
}

const snap = (t) => {
  const u = (t && (t.url || t.pendingUrl)) || '';
  return isUrl(u) && isWorthReopening(u) && !t.incognito ? { u, ti: String(t.title || '').slice(0, 300) } : null;
};

// How many pages two tab lists share (by normalized URL).
function overlap(a, b) {
  const keys = new Set(a.map((t) => normalizeUrl(t.u)));
  return b.reduce((n, t) => n + (keys.has(normalizeUrl(t.u)) ? 1 : 0), 0);
}

// Make the saved copies match the groups Chrome has right now.
export function syncGroups() {
  return withLock('groups', async () => {
    if (!hasGroupsApi()) return;
    let live, tabs, boot;
    try {
      [live, tabs, boot] = await Promise.all([
        chrome.tabGroups.query({}), chrome.tabs.query({ windowType: 'normal' }),
        chrome.storage.session.get(KEY.BOOT_AT),
      ]);
    } catch { return; }
    const bootAt = boot[KEY.BOOT_AT] || 0;
    const now = Date.now();
    const starting = now - bootAt < LIMITS.CLEANUP_BOOT_DELAY_MS; // Chrome may still be restoring tabs
    const before = (await L.get(KEY.GROUPS))[KEY.GROUPS];
    const saved = clean(before);
    const matched = new Set();

    for (const g of live) {
      const mine = tabs.filter((t) => t.groupId === g.id).sort((a, b) => a.index - b.index).map(snap).filter(Boolean).slice(0, LIMITS.MAX_GROUP_TABS);
      if (!mine.length) continue;
      const color = GROUP_COLORS.includes(g.color) ? g.color : 'grey';
      const title = String(g.title || '').slice(0, LIMITS.GROUP_TITLE_MAX);
      // Same Chrome group as last time, or (after a restart, when ids change) the same name, colour and pages.
      let rec = saved.find((r) => !matched.has(r.id) && r.cid === g.id && r.b === bootAt);
      if (!rec) {
        const cands = saved.filter((r) => !matched.has(r.id) && r.title === title && r.color === color)
          .map((r) => ({ r, n: overlap(r.tabs, mine) })).filter((c) => c.n > 0).sort((a, b) => b.n - a.n);
        rec = cands.length ? cands[0].r : null;
      }
      if (!rec) { rec = { id: crypto.randomUUID(), title, color, tabs: mine, t: now, cid: g.id, b: bootAt, open: true }; saved.push(rec); }
      matched.add(rec.id);
      let list = mine;
      if (starting) { // keep pages that haven't been restored yet
        const have = new Set(mine.map((t) => normalizeUrl(t.u)));
        list = [...mine, ...rec.tabs.filter((t) => !have.has(normalizeUrl(t.u)))].slice(0, LIMITS.MAX_GROUP_TABS);
      }
      Object.assign(rec, { title, color, tabs: list, cid: g.id, b: bootAt, open: true });
    }
    for (const r of saved) if (!matched.has(r.id) && r.open) { r.open = false; r.cid = null; r.t = now; } // gone: keep the copy

    // Over the cap: drop the oldest closed ones.
    let out = saved;
    if (out.length > LIMITS.MAX_SAVED_GROUPS) {
      const drop = new Set(out.filter((r) => !r.open).sort((a, b) => a.t - b.t).slice(0, out.length - LIMITS.MAX_SAVED_GROUPS).map((r) => r.id));
      out = out.filter((r) => !drop.has(r.id));
    }
    // `t` of an open group is only for ordering and would change on every sync: don't write for that alone.
    const strip = (arr) => JSON.stringify(arr.map(({ t, ...r }) => (r.open ? r : { ...r, t })));
    if (strip(out) !== strip(clean(before)) || !Array.isArray(before)) await L.set({ [KEY.GROUPS]: out });
  });
}

export function removeSavedGroup(id) {
  return withLock('groups', async () => {
    const saved = await getSavedGroups();
    await L.set({ [KEY.GROUPS]: saved.filter((g) => g.id !== id) });
  });
}

// Open a saved group again in `windowId`, as a real Chrome tab group.
export async function reopenGroup(g, windowId) {
  const ids = [];
  for (const t of g.tabs) {
    const tab = await chrome.tabs.create({ url: t.u, windowId, active: false });
    ids.push(tab.id);
  }
  const gid = await chrome.tabs.group({ tabIds: ids, createProperties: { windowId } });
  await chrome.tabGroups.update(gid, { title: g.title, color: g.color });
  await chrome.tabs.update(ids[0], { active: true });
  return ids[0];
}
