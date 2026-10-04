// node render.mjs [--w 1080 --h 1920] [--sheet] [--out name] [--from s --to s]
// Renders the film frame by frame via window.seek(t), then encodes H.264 yuv420p CRF 16 with the synthesized score.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const W = +arg('w', 1080), H = +arg('h', 1920), FPS = 30, SHEET = process.argv.includes('--sheet');
const OUT = arg('out', `tabatha-${W}x${H}`);
const srv = spawn('python3', ['-m', 'http.server', '8765', '--bind', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ args: ['--no-proxy-server', '--font-render-hinting=none'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('console', (m) => console.log('page:', m.text())); page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto(`http://127.0.0.1:8765/film/index.html?w=${W}&h=${H}`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
const dir = `frames/${OUT}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const beats = JSON.parse(fs.readFileSync('beats.json'));
const times = SHEET ? beats.beats.map((b) => b + beats.beat * 0.45) : [...Array(Math.round(10 * FPS)).keys()].map((f) => f / FPS);
let i = 0;
for (const t of times) {
  await page.evaluate((t) => window.seek(t), t);
  await page.screenshot({ path: `${dir}/${String(i++).padStart(4, '0')}.png` });
}
await browser.close(); srv.kill();
if (SHEET) {
  fs.writeFileSync(`${dir}/times.json`, JSON.stringify(times));
  execSync(`python3 sheet.py ${dir} ${W} ${H}`, { stdio: 'inherit' });
} else {
  execSync(`ffmpeg -y -loglevel error -framerate ${FPS} -i ${dir}/%04d.png -i audio/score.wav -c:v libx264 -pix_fmt yuv420p -crf 16 -preset slow -c:a aac -b:a 256k -movflags +faststart -shortest out/${OUT}.mp4`, { stdio: 'inherit' });
  console.log('wrote', `out/${OUT}.mp4`);
}
