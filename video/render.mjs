// node render.mjs [--w 1080 --h 1920] [--fps 60] [--dur 10] [--sub 4] [--sheet] [--out name]
// Seeks index.html at FPS*SUB steps, pipes each canvas frame to ffmpeg, which averages SUB sub-frames
// into one (motion blur), encodes H.264 yuv420p CRF 16 to out/silent-WxH.mp4, then muxes audio/score.wav.
import { execSync, spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
let chromium;
try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); }

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const W = +arg('w', 1080), H = +arg('h', 1920), FPS = +arg('fps', 60), DUR = +arg('dur', 10), SUB = +arg('sub', 4);
const SHEET = process.argv.includes('--sheet'), OUT = arg('out', `tabatha-${W}x${H}`);
const ROOT = path.dirname(new URL(import.meta.url).pathname);
process.chdir(ROOT);
execSync('node make-data.mjs', { stdio: 'inherit' });

// tiny static server, so the canvas stays untainted and toDataURL works
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
const srv = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(0, '127.0.0.1');
await new Promise((r) => srv.once('listening', r));
const URL_ = `http://127.0.0.1:${srv.address().port}/index.html?w=${W}&h=${H}`;

const browser = await chromium.launch({ args: ['--no-proxy-server', '--font-render-hinting=none'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto(URL_);
await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
const grab = async (t) => {
  const b64 = await page.evaluate((t) => { window.seek(t); return document.getElementById('c').toDataURL('image/png').slice(22); }, t);
  return Buffer.from(b64, 'base64');
};
fs.mkdirSync('out', { recursive: true });

if (SHEET) {   // one frame per beat (a little after the hit), tiled by sheet.py
  const dir = `frames/${OUT}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const beats = JSON.parse(fs.readFileSync('beats.json'));
  const times = beats.beats.map((b) => b + beats.beat * 0.45);
  for (const [i, t] of times.entries()) fs.writeFileSync(`${dir}/${String(i).padStart(4, '0')}.png`, await grab(t));
  fs.writeFileSync(`${dir}/times.json`, JSON.stringify(times));
  await browser.close(); srv.close();
  execSync(`python3 sheet.py ${dir} ${W} ${H}`, { stdio: 'inherit' });
  process.exit(0);
}

const silent = `out/silent-${W}x${H}.mp4`;
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(FPS * SUB), '-i', '-',
  '-vf', `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/${FPS}/TB`,
  '-r', String(FPS), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'slow', '-movflags', '+faststart', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
const N = Math.round(DUR * FPS * SUB), t0 = Date.now();
for (let i = 0; i < N; i++) {
  const buf = await grab(i / (FPS * SUB));
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % (FPS * SUB) === 0) console.log(`${(i / (FPS * SUB)).toFixed(0)}s / ${DUR}s  (${((Date.now() - t0) / 1000).toFixed(0)}s elapsed)`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await browser.close(); srv.close();
execSync(`ffmpeg -y -loglevel error -i ${silent} -i audio/score.wav -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart out/${OUT}.mp4`, { stdio: 'inherit' });
console.log('wrote', silent, 'and', `out/${OUT}.mp4`);
