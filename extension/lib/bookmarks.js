// Chrome bookmarks, for the switcher's right panel. Needs the optional `bookmarks` permission,
// asked for when the user clicks "Turn on bookmarks" (Chrome shows its own prompt). Without it
// chrome.bookmarks is undefined and the panel only offers the switch. Tabatha keeps no copy:
// everything is read from and written to Chrome's own bookmarks, which Chrome may sync.

export const hasApi = () => !!(chrome.bookmarks && chrome.bookmarks.getTree);

export async function enable() {
  try { return await chrome.permissions.request({ permissions: ['bookmarks'] }); } catch { return false; }
}

// -> { byId: Map(id -> node), roots: node[] } where folders have `children` (folders first, then
// bookmarks, in Chrome's order) and bookmarks have `url`. The invisible root ("0") is dropped.
export async function getTree() {
  const [root] = await chrome.bookmarks.getTree();
  const byId = new Map();
  const walk = (n, depth) => {
    const node = { id: n.id, parentId: n.parentId, title: n.title || '', url: n.url || null, depth, children: null, unmodifiable: !!n.unmodifiable };
    byId.set(n.id, node);
    if (!n.url) node.children = (n.children || []).map((c) => walk(c, depth + 1));
    return node;
  };
  const roots = (root.children || []).map((c) => walk(c, 0)).filter((r) => r.children && (r.children.length || r.id !== '3')); // hide an empty "Mobile bookmarks"
  return { byId, roots };
}

// Every folder, flattened in tree order (for the "Move to" list).
export function folders(tree) {
  const out = [];
  const walk = (n) => { if (n.children) { out.push(n); n.children.forEach(walk); } };
  tree.roots.forEach(walk);
  return out;
}

export function search(tree, q, max = 100) {
  const out = [];
  for (const n of tree.byId.values()) {
    if (n.url && ((n.title || '').toLowerCase().includes(q) || n.url.toLowerCase().includes(q))) out.push(n);
    if (out.length >= max) break;
  }
  return out;
}

// The folder new bookmarks go into: the last one used, if it still exists, else the bookmarks bar.
export function defaultFolder(tree, lastId) {
  const last = lastId && tree.byId.get(lastId);
  if (last && last.children) return last;
  return tree.byId.get('1') || tree.roots.find((r) => r.children) || null;
}

export const create = (parentId, title, url) => chrome.bookmarks.create({ parentId, title, ...(url ? { url } : {}) });
export const update = (id, changes) => chrome.bookmarks.update(id, changes);
export const move = (id, parentId, index) => chrome.bookmarks.move(id, index === undefined ? { parentId } : { parentId, index });
export const remove = (id) => chrome.bookmarks.remove(id);
export const removeFolder = (id) => chrome.bookmarks.removeTree(id);

// How many bookmarks a folder holds, folders inside included.
export function countIn(node) {
  if (!node.children) return 1;
  return node.children.reduce((n, c) => n + (c.children ? countIn(c) : 1), 0);
}
// Is `id` the folder `node` or somewhere inside it? (A folder can't be moved into itself.)
export function contains(node, id) {
  return node.id === id || (!!node.children && node.children.some((c) => contains(c, id)));
}
