// Saved groups can't grow past their share of storage: the oldest closed ones go first.
import { launch, withTabGroups } from './lib.mjs';
const T = await launch(withTabGroups(process.env.EXT));
const [a] = await T.open(['alpha']); await T.skipFirstRun();
await T.tap(a);
const f = T.frame(a);
const r = await f.evaluate(async () => {
  const { syncGroups } = await import('./lib/groups.js');
  const now = Date.now();
  const mk = (i) => ({ id: 'g' + i, title: 'Group ' + i, color: 'blue', open: false, cid: null, b: 0, t: now - (100 - i) * 1000,
    tabs: Array.from({ length: 100 }, (_, k) => ({ u: 'https://example.com/' + i + '-' + k + '-' + 'x'.repeat(1500), ti: 'Tab ' + k })) });
  await chrome.storage.local.set({ groups: Array.from({ length: 40 }, (_, i) => mk(i)) });
  await syncGroups();
  const g = (await chrome.storage.local.get('groups')).groups;
  return { n: g.length, bytes: JSON.stringify(g).length, ids: g.map((x) => x.id) };
});
T.log('saved groups are trimmed to the size cap', r.bytes <= 2 * 1024 * 1024 && r.n < 40 && r.n > 5, JSON.stringify({ n: r.n, mb: (r.bytes / 1048576).toFixed(2) }));
T.log('the newest closed groups are the ones kept', r.ids.includes('g39') && !r.ids.includes('g0'));
await T.close();
