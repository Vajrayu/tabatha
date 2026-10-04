// The "why no previews" diagnostics: withheld site access, and a failing screenshot.
import { launch, S } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
const base = process.env.EXT;

// 1. Site access withheld: a copy of the extension whose permission check says "no".
const withheld = path.join(S, 'ext-withheld');
fs.rmSync(withheld, { recursive: true, force: true }); fs.cpSync(base, withheld, { recursive: true });
const jsPath = path.join(withheld, 'switcher.js');
fs.writeFileSync(jsPath, fs.readFileSync(jsPath, 'utf8').replace("chrome.permissions.contains({ origins: ['<all_urls>'] })", 'Promise.resolve(false)'));
{
  const T = await launch(withheld);
  const [a] = await T.open(['alpha']); await T.skipFirstRun();
  await T.tap(a);
  const f = T.frame(a);
  const txt = await f.$eval('#alert-text', (n) => n.textContent);
  T.log('withheld access: alert explains it', !(await f.$eval('#alert', (n) => n.hidden)) && /limiting/.test(txt), txt);
  T.log('...with an "Allow on all sites" button', (await f.$eval('#alert-btn', (n) => (n.hidden ? '' : n.textContent))) === 'Allow on all sites');
  T.log('...and no capture button', await f.$eval('#sweep-btn', (n) => n.hidden));
  await a.screenshot({ path: path.join(S, 'shot-alert.png') });
  await T.close();
}
// 2. A screenshot that fails: the real extension, captureVisibleTab made to throw.
{
  const T = await launch(base);
  await T.sw.evaluate(() => { chrome.tabs.captureVisibleTab = async () => { throw new Error('simulated: capture not allowed'); }; });
  const [a] = await T.open(['alpha']); await T.skipFirstRun();
  await T.tap(a);
  const f = T.frame(a);
  const hidden = await f.$eval('#alert', (n) => n.hidden);
  const txt = hidden ? '' : await f.$eval('#alert-text', (n) => n.textContent);
  T.log('failed capture: alert names the reason', !hidden && /simulated: capture not allowed/.test(txt), txt);
  await T.close();
}
// 3. Everything fine: no alert.
{
  const T = await launch(base);
  const [a] = await T.open(['alpha']); await T.skipFirstRun();
  await T.tap(a);
  T.log('healthy: no alert', await T.frame(a).$eval('#alert', (n) => n.hidden));
  await T.close();
}
