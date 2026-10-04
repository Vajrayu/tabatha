import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn, execSync } from 'node:child_process';
const [W,H,a,b,n]=process.argv.slice(2).map(Number);
const srv = spawn('python3', ['-m', 'http.server', '8766', '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const br = await chromium.launch({ args: ['--no-proxy-server'] }); const p = await br.newPage({ viewport: { width: W, height: H } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto(`http://127.0.0.1:8766/film/index.html?w=${W}&h=${H}`); await p.waitForFunction(() => window.ready === true);
const fs=await import('node:fs'); fs.mkdirSync('strip',{recursive:true}); for (const f of fs.readdirSync('strip')) fs.unlinkSync('strip/'+f);
for (let i=0;i<n;i++){const t=a+(b-a)*i/(n-1); await p.evaluate((t)=>seek(t),t); await p.screenshot({path:`strip/${String(i).padStart(3,'0')}.png`});}
await br.close(); srv.kill();
execSync(`python3 -c "
from PIL import Image;import glob
fs=sorted(glob.glob('strip/*.png'));w=270;h=int(w*${H}/${W})
s=Image.new('RGB',(w*len(fs),h))
for i,f in enumerate(fs): s.paste(Image.open(f).resize((w,h)),(i*w,0))
s.save('/tmp/claude-0/-home-claude/c832cc03-679f-50ac-8dc9-c6bbc959112a/scratchpad/strip.png')"`);
