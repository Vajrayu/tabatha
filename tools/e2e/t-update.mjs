// 1.3.5: Chrome's REAL update event. t-walk calls noteUpdatedFrom directly; this test lets Chrome do it: an old
// version (1.3.4, then 1.3.3, from git) is loaded unpacked from a fixed folder into a persistent profile, used once,
// the browser is closed, the folder's contents are replaced by the current extension/ (same path, so Chrome sees the
// same unpacked extension with a new version) and the same profile is launched again. onInstalled (reason "update",
// previousVersion) must then have saved wnFrom, and the first Alt+Q must show only what is newer than that version,
// then the fixes, once. The extension id depends on the folder path: it is checked to be the same before trusting this.
// Needs git (it makes the old copies with `git archive` of ea76d7c = 1.3.4 and the v1.3.3 tag).
//
// RESULT ON CHROME 153 (14 Oct 2026): Chrome does NOT fire onInstalled for this. A command-line unpacked extension is
// recorded in the profile (Default/Secure Preferences, location 8) with no manifest and no version, so on the next launch
// Chrome has nothing to compare and fires no event at all (not "update", not "install"). The extension id and the new
// version do come out right. So this test SKIPS (exit 0, says why) instead of faking an update; t-walk still covers
// noteUpdatedFrom directly. If a future Chrome does fire the event, the checks below run for real.
import { launch, S } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NEW = process.env.EXT;
const newVersion = JSON.parse(fs.readFileSync(path.join(NEW, 'manifest.json'), 'utf8')).version;
const within = (p, ms = 3000) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);

function oldCopy(rev, into) {
  fs.rmSync(into, { recursive: true, force: true });
  fs.mkdirSync(into, { recursive: true });
  const tar = execFileSync('git', ['archive', rev, 'extension'], { cwd: repo, maxBuffer: 1 << 28 });
  fs.writeFileSync(into + '.tar', tar);
  execFileSync('tar', ['-x', '-C', into, '-f', into + '.tar']);
  fs.rmSync(into + '.tar');
  return path.join(into, 'extension');
}
const versionOf = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).version;

// Resolves to false when the update event never came (the test is skipped), true when all checks ran.
async function scenario(label, rev, oldVersion, expect) {
  const base = path.join(S, 'upd-' + oldVersion);
  const src = oldCopy(rev, path.join(base, 'src'));
  const D = path.join(base, 'D'); // the one folder Chrome loads, before and after
  const P = path.join(base, 'profile');
  fs.rmSync(D, { recursive: true, force: true }); fs.rmSync(P, { recursive: true, force: true });
  fs.cpSync(src, D, { recursive: true });
  T0: {
    const T = await launch(D, { profile: P });
    const v = await T.sw.evaluate(() => chrome.runtime.getManifest().version);
    const id1 = new URL(T.sw.url()).host;
    const [a] = await T.open(['alpha', 'beta']);
    await T.skipFirstRun(); // a user who has seen everything in the old version
    await T.tap(a); await a.waitForTimeout(500);
    const opened = await T.isOpen(a);
    await a.keyboard.press('Escape'); await a.waitForTimeout(400);
    await T.sw.evaluate(() => chrome.storage.local.remove(['wnFrom']));
    T.log(`${label}: the old version (${oldVersion}) is what runs first`, v === oldVersion && opened, `${v}, switcher opened: ${opened}`);
    globalThis.__id1 = id1;
    await T.close();
  }
  // Replace the folder's contents with the current extension, same path.
  for (const f of fs.readdirSync(D)) fs.rmSync(path.join(D, f), { recursive: true, force: true });
  fs.cpSync(NEW, D, { recursive: true });
  const T = await launch(D, { profile: P });
  const id2 = new URL(T.sw.url()).host;
  const v2 = await T.sw.evaluate(() => chrome.runtime.getManifest().version);
  T.log(`${label}: same profile, same folder, same extension id, new version`, id2 === globalThis.__id1 && v2 === newVersion && versionOf(D) === newVersion, `${globalThis.__id1} -> ${id2}, ${oldVersion} -> ${v2}`);
  await new Promise((r) => setTimeout(r, 2500));
  const from = await T.sw.evaluate(() => chrome.storage.local.get('wnFrom').then((o) => o.wnFrom));
  if (from === undefined) {
    await T.close();
    let rec = 'profile record not found';
    try { // what Chrome keeps for the extension: no manifest, so no version to compare
      const prefs = JSON.parse(fs.readFileSync(path.join(P, 'Default', 'Secure Preferences'), 'utf8')).extensions.settings;
      const mine = Object.values(prefs).find((x) => x.path === D);
      if (mine) rec = `Chrome's record of the extension: location ${mine.location}, manifest ${mine.manifest ? 'kept (version ' + mine.manifest.version + ')' : 'NOT kept (no version to compare)'}`;
    } catch {}
    console.log(`SKIP ${label}: Chrome fired no onInstalled(update) for a command-line unpacked extension swapped on disk (wnFrom was never set). ${rec}. Not faked: t-walk covers noteUpdatedFrom directly.`);
    return false;
  }
  T.log(`${label}: Chrome's update event saved the version updated from (wnFrom)`, from === oldVersion, String(from));
  // A second window, so the window-list step applies; then the first open after the update.
  await T.sw.evaluate(async (u) => { await chrome.windows.create({ url: u, focused: false }); }, T.url('gamma'));
  const [a] = T.ctx.pages().filter((p) => /alpha/.test(p.url()));
  const page = a || T.ctx.pages()[0];
  await page.bringToFront(); await page.waitForTimeout(800);
  await T.tap(page); await page.waitForTimeout(700);
  const f = () => T.frame(page);
  // If most previews are missing the capture card comes first: answer Later (its own test is t-capcard).
  const card = await within(T.capCard(page).catch(() => null));
  if (card) { await T.capPress(page, 'Later'); await page.waitForTimeout(400); }
  const steps = [];
  for (let i = 0; i < 14; i++) {
    const fr = f();
    const s = !fr ? null : await within(fr.evaluate(() => {
      if (document.getElementById('modal').hidden) return null;
      const h = document.getElementById('dlg-title'); const m = h.querySelector('.mark'); const of = document.querySelector('#dialog .stepof');
      return { title: [...h.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(''), mark: m ? m.textContent : '', items: [...document.querySelectorAll('#dialog .news li')].map((x) => x.textContent), of: of ? of.textContent : '' };
    }).catch(() => null));
    if (!s) break;
    steps.push(s);
    if (!s.of || /^(\d+) \/ \1$/.test(s.of)) break;
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
  }
  const shown = steps.map((s) => s.title + (s.mark ? ` [${s.mark}]` : '')).join(' · ');
  T.log(`${label}: the first Alt+Q shows only what is newer, then the fixes`, shown === expect.steps, shown);
  const fixes = steps.length ? steps[steps.length - 1].items : [];
  T.log(`${label}: the fixes card lists ${expect.fixes} lines`, fixes.length === expect.fixes, fixes.join(' | '));
  T.log(`${label}: ${expect.many ? 'includes' : 'has no'} "Many at once" (the actions-bar step)`, steps.some((s) => s.title === 'Many at once') === expect.many);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  const left = await T.sw.evaluate(() => chrome.storage.local.get('wnFrom').then((o) => o.wnFrom || ''));
  T.log(`${label}: seen: wnFrom is cleared`, left === '', left);
  await T.tap(page); await page.waitForTimeout(700);
  const again = await within(f().evaluate(() => !document.getElementById('modal').hidden).catch(() => null));
  T.log(`${label}: a second open does not show it again`, again === false, String(again));
  await T.close();
  return true;
}

if (await scenario('1.3.4 → ' + newVersion, 'ea76d7c', '1.3.4', {
  steps: 'Sort and group [New] · Your windows [Changed] · Groups and bookmarks [Changed] · Also fixed since you last looked', fixes: 3, many: false }))
await scenario('1.3.3 → ' + newVersion, 'v1.3.3', '1.3.3', {
  steps: 'Sort and group [New] · Your windows [Changed] · Many at once [Moved] · Groups and bookmarks [Changed] · Also fixed since you last looked', fixes: 7, many: true });
