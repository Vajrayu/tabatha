// End-to-end harness: real Chromium + the unpacked extension + a tiny local site (site/*.html).
// Run a test with:  EXT=/path/to/extension S=/some/scratch/dir node t-xxx.mjs
// Playwright is resolved from PW (default: a portfolio checkout next to this repo).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(process.env.PW || new URL('../../../portfolio/node_modules/playwright/index.mjs', import.meta.url).href);
export const S = process.env.S || '/tmp/tabatha-e2e';
fs.mkdirSync(S, { recursive: true });

export async function launch(ext, { profile, args = [], viewport = { width: 1280, height: 800 } } = {}) {
  const srv = http.createServer((q, r) => {
    try { r.end(fs.readFileSync(path.join(here, 'site', q.url.split('?')[0].split('#')[0]))); } catch { r.statusCode = 404; r.end(); }
  }).listen(0);
  const port = srv.address().port;
  const ctx = await chromium.launchPersistentContext(profile || path.join(S, 'prof' + Date.now() + Math.floor(Math.random() * 1e4)), {
    channel: 'chromium', headless: true, viewport,
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, ...args],
  });
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const url = (n) => `http://localhost:${port}/${n}.html`;
  const open = async (names) => {
    const ps = [];
    for (const n of names) { const p = ps.length && ctx.pages().length ? await ctx.newPage() : ctx.pages()[0]; await p.goto(url(n)); await p.waitForTimeout(700); ps.push(p); }
    return ps;
  };
  const frame = (p) => p.frames().find((f) => f.url().includes('switcher.html'));
  const isOpen = async (p) => !!(await p.$('iframe[aria-label="Tabatha tab switcher"]'));
  const tap = async (p) => { await p.bringToFront(); await p.keyboard.down('Alt'); await p.keyboard.press('KeyQ'); await p.waitForTimeout(1300); await p.keyboard.up('Alt'); await p.waitForTimeout(500); };
  const log = (n, ok, x = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!ok) process.exitCode = 1; };
  // Skip the first-run tour/flyout (they'd swallow keys): call after open().
  // …and the "What's new" card (a test that wants it removes `wnSeen`).
  const skipFirstRun = () => sw.evaluate(() => chrome.storage.local.set({ onb: { at: 1, flyout: true, tour: true }, wnSeen: chrome.runtime.getManifest().version }));
  const close = async () => { await ctx.close(); srv.close(); };
  return { ctx, sw, url, open, frame, isOpen, tap, log, skipFirstRun, close, port };
}

// A copy of the extension with optional permissions made normal ones (Playwright can't click Chrome's permission prompt).
export function withPermissions(ext, perms) {
  const dir = path.join(S, 'ext-' + perms.join('-'));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync(ext, dir, { recursive: true });
  const mp = path.join(dir, 'manifest.json');
  const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
  m.permissions.push(...perms);
  m.optional_permissions = (m.optional_permissions || []).filter((p) => !perms.includes(p));
  if (!m.optional_permissions.length) delete m.optional_permissions;
  fs.writeFileSync(mp, JSON.stringify(m, null, 1));
  return dir;
}
export const withTabGroups = (ext) => withPermissions(ext, ['tabGroups']);
