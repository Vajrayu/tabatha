// First-run: flags, the short manual-style tour, Esc handling, and that it never runs twice.
import { launch, S } from './lib.mjs';
import path from 'node:path';
const T = await launch(process.env.EXT);
const ls = (k) => T.sw.evaluate((k) => chrome.storage.local.get(k).then((o) => o[k]), k);
const [a, b, c] = await T.open(['alpha', 'beta', 'gamma']);
let onb = await ls('onb');
T.log('install recorded first-run flags', !!onb && onb.at > 0 && !onb.flyout && !onb.tour, JSON.stringify(onb));
// The capture card that comes first on a new install has its own test (t-walk); here it counts as answered.
await T.sw.evaluate(() => chrome.storage.local.get('onb').then((o) => chrome.storage.local.set({ onb: { ...o.onb, cap: chrome.runtime.getManifest().version } })));
await T.tap(c);
const f = () => T.frame(c);
await c.waitForTimeout(500);
T.log('tour shown on first open', await f().$eval('#modal', (n) => !n.hidden));
const steps = [];
for (let i = 0; i < 9; i++) {
  const title = await f().$eval('#dlg-title', (n) => n.textContent).catch(() => null);
  if (!title) break;
  steps.push(title);
  const words = (await f().$eval('#dialog', (n) => n.innerText)).split(/\s+/).length;
  if (i === 0 || i === 1 || i === 4) await c.screenshot({ path: path.join(S, `shot-tour-${i + 1}.png`) });
  T.log(`step ${i + 1} "${title}" is short`, words <= 40, words + ' words');
  if (title === 'Anything off?') break;
  await c.keyboard.press('ArrowRight'); await c.waitForTimeout(150);
}
T.log('steps', /^Press (Alt|Option)\+Q,Move,Search,Sort and group,Many at once,Groups and bookmarks,Settings,Anything off\?$/.test(steps.join()), steps.join());
T.log('ends with the promise to fix things', steps[steps.length - 1] === 'Anything off?');
const tellMe = (await f().$$eval('#dialog button', (x) => x.map((b) => b.textContent))).includes('Tell me');
T.log('last step offers "Tell me"', tellMe);
await c.keyboard.press('Escape'); await c.waitForTimeout(300);
T.log('Esc ends only the tour', (await T.isOpen(c)) && (await f().$eval('#modal', (n) => n.hidden)));
onb = await ls('onb'); T.log('flags saved', onb.tour && onb.flyout);
await c.keyboard.press('Escape'); await c.waitForTimeout(400);
await T.tap(c); await c.waitForTimeout(600);
T.log('tour not shown again', await f().$eval('#modal', (n) => n.hidden));
T.log('footer has Help and Feedback links', !(await f().$eval('#feedback-btn', (n) => n.hidden)) && !(await f().$eval('#help-btn', (n) => n.hidden)));
await f().click('#feedback-btn'); await c.waitForTimeout(600);
const urls = await T.sw.evaluate(async () => (await chrome.tabs.query({})).map((t) => t.url || t.pendingUrl));
T.log('Feedback opens the site form with source and version', urls.some((u) => /^https:\/\/tabatha-vert\.vercel\.app\/feedback\?from=extension&v=\d+\.\d+\.\d+&lang=en$/.test(u)), urls.join(' '));
await T.close();
