// Tabatha showreel. A pure function of time: window.seek(t) paints frame t.
// No transitions, timers or rAF; the DOM is built once and every animated property is set on every seek.
(async () => {
const Q = new URLSearchParams(location.search);
const W = +(Q.get('w') || 1080), H = +(Q.get('h') || 1920);
const TALL = H > W * 1.3;
const SET = TALL ? 'portrait' : 'landscape';          // which real capture set this format uses
const CW = TALL ? 960 : 1280, CH = TALL ? 1280 : 800;  // capture viewport (CSS px); images are @2x
const DUR = 10;
const beats = await (await fetch('../beats.json')).json();
const B = beats.beat;                                  // measured beat (0.5 s at 120 BPM)
const g = (n) => beats.phase + n * B;                  // time of beat n (fractional n = 8ths/16ths)

// ---------------------------------------------------------------- helpers
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const k = (t, t0, d) => clamp((t - t0) / d);
const lerp = (a, b, p) => a + (b - a) * p;
const outExpo = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
const outBack = (p) => { const c = 1.9; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
const inOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const steps = (p, n) => Math.floor(clamp(p) * n) / n;  // yuvsualy: stepped eases for pixel things
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; (parent || stage).append(e); return e; };
const css = (e, o) => { for (const key in o) e.style[key] = o[key]; };
const tf = (e, x, y, s = 1, r = 0) => { e.style.transform = `translate(${x}px,${y}px) rotate(${r}deg) scale(${s})`; };
const show = (e, on) => { e.style.display = on ? '' : 'none'; };
const loadJSON = async (n) => (await fetch(`assets/ui/${SET}/${n}.json`)).json();
const IMG = (n) => `assets/ui/${SET}/${n}.png`;

const stage = document.getElementById('stage');
css(stage, { width: W + 'px', height: H + 'px' });
const S = W / 1080;                                   // global unit scale (both formats are 1080 wide)

// ---------------------------------------------------------------- data from the real captures
const STATES = ['10-overview', '01-open-held', '02-cycle1', '03-cycle2', '04-cycle3', '12-cleared',
  '11-search-0', '11-search-1', '11-search-2', '11-search-3', '11-search-4', '13-window2'];
if (!TALL) STATES.push('14-window2-closed');   // landscape: Recently closed sits below the fold, so a scrolled capture
const R = {}; for (const n of STATES) R[n] = await loadJSON(n);
const ov = R['10-overview'];
const FAV = { Northwind: 'docs.northwind.example', Longform: 'read.longform.example', Gitforge: 'code.gitforge.example', Stackboard: 'board.stackboard.example',
  Mailpost: 'mail.mailpost.example', Pulse: 'app.pulse.example', Parley: 'team.parley.example', Tunebox: 'play.tunebox.example', Hearth: 'shop.hearth.example',
  Wayfare: 'maps.wayfare.example', Skycast: 'skycast.example', Dayplan: 'cal.dayplan.example', Skyroute: 'flights.skyroute.example' };
const favFor = (title) => { for (const w in FAV) if (title.includes(w)) return `assets/ui/favicons/${FAV[w]}.svg`; return 'assets/ui/favicons/docs.northwind.example.svg'; };
const TITLES = ov.cards.map((c) => c.t.replace(/\s+/g, ' '));

// ---------------------------------------------------------------- timeline (seconds, on the measured grid)
const T = { HOOK: g(0), PROD: g(3), KEY: g(4), F1: g(6), F2: g(9), F3: g(12), MET: g(15), END: g(17.5), DUR };

// ---------------------------------------------------------------- layout per format
const L = TALL ? {
  ui: { x: 43, y: 430, w: 994 }, capY: 120, capSize: 124, tagY: 330,
  keys: { y: 1700, h: 170, font: 84, gap: 40 },
  hook: [ { w: 'WHERE', x: 540, y: 330, size: 330 }, { w: 'DID', x: 0, y: 640, size: 300 }, { w: 'THAT', x: 0, y: 640, size: 300 },
          { w: 'TAB', x: 540, y: 990, size: 420, panel: true }, { w: 'GO?', x: 540, y: 1330, size: 400 } ],
  pile: { y0: 1480, y1: 1880 },
  met: [ { w: 'EIGHTEEN', y: 420, size: 300 }, { w: 'HOURS', y: 720, size: 300 }, { w: 'A YEAR', y: 1020, size: 300 }, { w: 'BACK', y: 1350, size: 340, panel: true } ],
  metTagY: 1650,
  end: { logoY: 470, logo: 256, wordY: 840, wordSize: 210, subY: 1010, btnY: 1220, btnFont: 54, pressY: 1480, urlY: 1640 },
} : {
  ui: { x: 40, y: 300, w: 1000 }, capY: 70, capSize: 96, tagY: 228,
  keys: { y: 935, h: 128, font: 62, gap: 30 },
  hook: [ { w: 'WHERE', x: 0, y: 250, size: 250 }, { w: 'DID', x: 0, y: 250, size: 250 }, { w: 'THAT', x: 0, y: 520, size: 250 },
          { w: 'TAB', x: 0, y: 520, size: 270, panel: true }, { w: 'GO?', x: 540, y: 770, size: 250 } ],
  pile: { y0: 900, y1: 1070 },
  met: [ { w: 'EIGHTEEN', y: 175, size: 200 }, { w: 'HOURS', y: 370, size: 200 }, { w: 'A YEAR', y: 565, size: 200 }, { w: 'BACK', y: 790, size: 190, panel: true } ],
  metTagY: 960,
  end: { logoY: 230, logo: 192, wordY: 480, wordSize: 170, subY: 615, btnY: 760, btnFont: 46, pressY: 930, urlY: 1030 },
};
const U = L.ui, s0 = U.w / CW;                          // UI scale at zoom 1

// ---------------------------------------------------------------- backgrounds
const bg = el('div', 'layer');
const grid = el('div', 'layer');                        // yuvsualy 4px-grid paper for cream scenes
css(grid, { backgroundImage: 'linear-gradient(rgba(27,42,74,.06) 2px, transparent 2px), linear-gradient(90deg, rgba(27,42,74,.06) 2px, transparent 2px)', backgroundSize: '48px 48px' });

// ---------------------------------------------------------------- HOOK: kinetic type over a pile of real tab titles
const hook = el('div', 'layer');
const rnd = mulberry32(42);
const chips = [];
for (let i = 0; i < 46; i++) {
  const t = TITLES[i % TITLES.length];
  const c = el('div', 'px chip abs', hook, `<img src="${favFor(t)}"><span>${t.length > 30 ? t.slice(0, 28) + '…' : t}</span>`);
  if (!TALL) c.style.fontSize = '22px';
  chips.push({ e: c, x: rnd() * (W - 260) - 60, y: lerp(L.pile.y0, L.pile.y1, Math.pow(rnd(), 0.7)), r: (rnd() - 0.5) * 30, t0: 0.02 + (i / 46) * 1.36 + rnd() * 0.05, fill: rnd() < 0.18 });
}
chips.forEach((c) => { if (c.fill) c.e.style.setProperty('--fill', 'var(--sun)'); });
const words = L.hook.map((h, i) => {
  const box = el('div', 'abs', hook);
  let w;
  if (h.panel) {
    const p = el('div', 'px dither', box); css(p, { position: 'relative', '--px': '8px', '--sh': '16px', '--fill': 'var(--sun)', '--dh': '40px', padding: `${h.size * 0.12}px ${h.size * 0.16}px ${h.size * 0.02}px` });
    w = el('div', 'word', p, h.w); w.style.fontSize = h.size + 'px';
  } else { w = el('div', 'word', box, h.w); w.style.fontSize = h.size + 'px'; w.style.textShadow = `${h.size * 0.025}px ${h.size * 0.03}px 0 var(--sun)`; }
  return { box, h, t0: [0, 0.5, 1, 1.5, 2][i] * B };
});

// ---------------------------------------------------------------- the UI (real captures) under a camera
const CLIPY = (TALL ? 400 : 270) * S;
const uiClip = el('div', 'abs'); css(uiClip, { top: CLIPY + 'px', width: W + 'px', height: H - CLIPY + 'px', overflow: 'hidden' });
const uiWrap = el('div', 'abs', uiClip);                 // camera transform lives here
const uiShadow = el('div', 'abs', uiWrap);               // yuvsualy hard shadow, sun on ink
css(uiShadow, { width: CW + 'px', height: CH + 'px', background: 'var(--sun)' });
const ui = el('div', 'abs', uiWrap);
css(ui, { width: CW + 'px', height: CH + 'px', overflow: 'hidden', background: '#16171c' });
const shots = {}; for (const n of STATES) { const d = el('div', 'crop', ui); css(d, { left: 0, top: 0, width: CW + 'px', height: CH + 'px', backgroundImage: `url(${IMG(n)})`, backgroundSize: `${CW}px ${CH}px` }); shots[n] = d; }
// assembly pieces: cropped from the real overview capture at their real positions
const crop = (r) => { const d = el('div', 'crop abs', ui); css(d, { width: r[2] + 'px', height: r[3] + 'px', backgroundImage: `url(${IMG('10-overview')})`, backgroundSize: `${CW}px ${CH}px`, backgroundPosition: `${-r[0]}px ${-r[1]}px` }); return d; };
const newTab = [40, 20, 120, 40];
const pieces = [];
pieces.push({ e: crop(ov.search), r: ov.search, at: T.KEY + 0.1, kind: 'drop' });
pieces.push({ e: crop(newTab), r: newTab, at: T.KEY + 0.1, kind: 'drop' });
ov.chips.forEach((c, i) => pieces.push({ e: crop(c.r), r: c.r, at: T.KEY + 0.16 + i * 0.05, kind: 'pop' }));
const openHead = ov.heads[0].r; pieces.push({ e: crop([openHead[0], openHead[1] - 4, 200, openHead[3] + 8]), r: openHead, at: T.KEY + 0.2, kind: 'pop' });
const visCards = ov.cards.filter((c) => c.r[1] < CH - 20);
visCards.forEach((c, i) => pieces.push({ e: crop([c.r[0] - 6, c.r[1] - 6, c.r[2] + 12, c.r[3] + 12]), r: c.r, at: T.KEY + 0.22 + i * (0.5 / visCards.length), kind: 'fly', i }));
const coffeeR = ov.coffee; pieces.push({ e: crop([coffeeR[0] - 8, coffeeR[1] - 8, coffeeR[2] + 16, coffeeR[3] + 16]), r: coffeeR, at: g(5.75), kind: 'pop' });
if (ov.heads[2] && ov.heads[2].r[1] < CH) { const h2 = ov.heads[2].r; pieces.push({ e: crop([h2[0], h2[1] - 4, 220, h2[3] + 8]), r: h2, at: g(5.75), kind: 'pop' }); }

// cursor (yuvsualy pixel arrow) + click ring
const cursor = el('img', 'cursor pix'); cursor.src = 'assets/yuvsualy/cursor-arrow.svg';
const ring = el('div', 'abs'); css(ring, { border: '6px solid var(--sun)', width: '10px', height: '10px' });

// ---------------------------------------------------------------- keycaps (yuvsualy buttons as keys)
const keyRow = el('div', 'abs');
const mkKey = (label, cream, parent, font, h) => { const b = el('div', 'px btn dither' + (cream ? ' btn--cream' : ''), parent); css(b, { position: 'absolute', font: `700 ${font}px/1 Geist`, height: h + 'px', minWidth: h + 'px', padding: `0 ${font * 0.45}px ${font * 0.1}px`, '--px': '5px', '--sh': '10px', '--dh': `${h * 0.2}px`, '--edge': 'var(--ink)', '--shade': cream ? '#ADA186' : 'var(--amber)' }); el('span', '', b, label); return b; };
const kAlt = mkKey('Alt', true, keyRow, L.keys.font, L.keys.h), kQ = mkKey('Q', false, keyRow, L.keys.font, L.keys.h);
const kPlus = el('div', 'abs', keyRow, '+'); css(kPlus, { font: `700 ${L.keys.font}px/1 Geist`, color: 'var(--cream)' });

// ---------------------------------------------------------------- captions + tags
const mkCap = (lines) => { const c = el('div', 'abs'); lines.forEach((ln) => { const d = el('div', 'cap', c, ln); d.style.fontSize = L.capSize * S + 'px'; d.style.position = 'relative'; }); return c; };
const caps = [
  { e: mkCap(['Every tab, live']), t0: T.KEY + B / 2, t1: T.F1, tag: 'Real previews, not favicons' },
  { e: mkCap(['Hold Alt, tap Q']), t0: T.F1, t1: T.F2, tag: 'Most recent first' },
  { e: mkCap(['Type to find it']), t0: T.F2, t1: T.F3, tag: 'Open + closed in 7 days' },
  { e: mkCap(['Every window']), t0: T.F3, t1: g(13.5), tag: 'Filter in one click' },
  { e: mkCap(['Even closed tabs']), t0: g(13.5), t1: T.MET, tag: 'Reopen what you lost' },
];
caps.forEach((c) => { c.tagE = el('div', 'px tag abs', null, c.tag); css(c.tagE, { font: `500 ${TALL ? 30 : 24}px/1 'Geist Mono'`, padding: '10px 16px 12px', '--px': '3px', '--sh': '4px', '--shade': 'var(--amber)' }); });
const pressCap = mkCap(['Press']); // "Press Alt + Q" lead-in during the key beat

// ---------------------------------------------------------------- METRIC
const met = el('div', 'layer');
const sunSprite = el('img', 'abs pix', met); sunSprite.src = 'assets/yuvsualy/sun.svg';
const metWords = L.met.filter((m) => m.size).map((m, i) => {
  const box = el('div', 'abs', met); let w;
  if (m.panel) { const p = el('div', 'px', box); css(p, { position: 'relative', '--px': '8px', '--sh': '16px', '--fill': 'var(--cream)', padding: `${m.size * 0.12}px ${m.size * 0.14}px ${m.size * 0.02}px` }); w = el('div', 'word', p, m.w); }
  else { w = el('div', 'word', box, m.w); w.style.textShadow = `${m.size * 0.025}px ${m.size * 0.03}px 0 var(--cream)`; }
  w.style.fontSize = m.size + 'px'; return { box, m, t0: T.MET + [0, 0.125, 0.25, 0.5][i] };
});
const metTag = el('div', 'px tag abs', met, 'est. 30 tab hunts a day × 6 s saved');
css(metTag, { '--fill': 'var(--cream)', font: `500 ${TALL ? 30 : 24}px/1 'Geist Mono'`, padding: '12px 18px 14px' });

// ---------------------------------------------------------------- END: logo lockup + CTA
const end = el('div', 'layer');
const E = L.end;
const logo = el('img', 'abs', end); logo.src = 'assets/brand/icon128.png'; css(logo, { width: E.logo + 'px', height: E.logo + 'px' });
const wordmark = el('div', 'abs', end); wordmark.style.whiteSpace = 'nowrap'; const wmLetters = [...'Tabatha'].map((ch) => { const s = el('span', '', wordmark, ch); css(s, { display: 'inline-block', font: `${E.wordSize}px/1 Gavency, 'Instrument Serif', serif`, color: 'var(--ink)' }); return s; });
const sub = el('div', 'abs', end, 'Alt+Tab for your Chrome tabs'); css(sub, { font: `500 ${TALL ? 44 : 36}px/1 Geist`, color: 'var(--ink-2)', whiteSpace: 'nowrap' });
const cta = el('div', 'px btn dither abs', end); css(cta, { font: `700 ${E.btnFont}px/1 Geist`, padding: `${E.btnFont * 0.5}px ${E.btnFont * 0.7}px ${E.btnFont * 0.62}px`, '--px': '5px', '--sh': '10px', '--dh': `${E.btnFont * 0.4}px` });
el('span', '', cta, 'Add to Chrome, it’s free');
const arrow = el('img', 'pix', cta); arrow.src = 'assets/yuvsualy/icon-arrowRight.svg'; css(arrow, { width: E.btnFont * 0.8 + 'px', height: E.btnFont * 0.8 + 'px', position: 'relative', zIndex: 1 });
const pressRow = el('div', 'abs', end);
const pLead = el('div', '', pressRow, 'Then press'); css(pLead, { position: 'absolute', font: `600 ${TALL ? 44 : 36}px/1 Geist`, color: 'var(--ink)', whiteSpace: 'nowrap' });
const ePlus = el('div', '', pressRow, '+'); css(ePlus, { position: 'absolute', font: `700 ${TALL ? 44 : 36}px/1 Geist`, color: 'var(--ink)' });
const eAlt = mkKey('Alt', true, pressRow, TALL ? 44 : 36, TALL ? 86 : 72), eQ = mkKey('Q', false, pressRow, TALL ? 44 : 36, TALL ? 86 : 72);
[eAlt, eQ].forEach((b) => css(b, { '--px': '3px', '--sh': '5px', '--shade': 'var(--ink)' }));
const url = el('div', 'abs', end, 'Chrome Web Store · search “Tabatha”'); css(url, { font: `500 ${TALL ? 28 : 24}px/1 'Geist Mono'`, color: 'var(--ink-2)', letterSpacing: '.04em', whiteSpace: 'nowrap' });

// ---------------------------------------------------------------- sky-band wipe (yuvsualy sky, top to bottom)
const bands = ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6', '--s7'].map((v) => { const b = el('div', 'band'); css(b, { background: `var(${v})`, height: Math.ceil(H / 7) + 2 + 'px' }); return b; });
const WIPES = [T.PROD - 0.15, T.MET - 0.15, T.END - 0.15];

// re-order layers on top
[uiClip, keyRow, ...caps.map((c) => c.e), ...caps.map((c) => c.tagE), pressCap, met, end, ring, cursor, ...bands].forEach((e) => stage.append(e));

// measure static sizes once (fonts loaded)
await document.fonts.ready;
await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
await Promise.all(STATES.map((n) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = IMG(n); })));
const size = (e) => [e.offsetWidth, e.offsetHeight];
// hook rows: words sharing a y are laid out as one centred row (measured, so nothing collides)
{ const rows = {}; words.forEach((w) => (rows[w.h.y] = rows[w.h.y] || []).push(w));
  for (const y in rows) { const r = rows[y]; const gap = 40; const ws = r.map((w) => size(w.box)[0]); const tot = ws.reduce((a, b) => a + b, 0) + gap * (r.length - 1);
    let x = W / 2 - tot / 2; r.forEach((w, i) => { w.h.x = (x + ws[i] / 2) / S; x += ws[i] + gap; }); } }

// ---------------------------------------------------------------- camera (UI coords)
const cardC = (st, pred) => { const c = R[st].cards.find(pred); return c ? [c.r[0] + c.r[2] / 2, c.r[1] + c.r[3] / 2] : [CW / 2, CH / 2]; };
const selC = (st) => cardC(st, (c) => c.sel === 'true');
const s4 = R['11-search-4'];
const w2 = R[TALL ? '13-window2' : '14-window2-closed'];
const w2chip = R['11-search-4'].chips.find((c) => /Window 2/.test(c.t)) || ov.chips[2];
const closedHead = (w2.heads.find((h) => /Recently/.test(h.t) && h.r[3]) || { r: [0, CH * 0.6, CW, 16] }).r;
const closedCards = w2.cards.filter((c) => c.closed);
const closedC = closedCards.length ? [closedCards.reduce((a, c) => a + c.r[0] + c.r[2] / 2, 0) / closedCards.length, closedCards[0].r[1] + closedCards[0].r[3] / 2] : [CW / 2, closedHead[1] + 100];
const C0 = [CW / 2, CH / 2];
const KF = [ // [time, zoom, focus]
  [0, 1, C0], [T.F1 - 0.01, 1, C0],
  [T.F1 + 0.22, TALL ? 1.95 : 1.7, selC('01-open-held')], [g(6.5), TALL ? 1.95 : 1.7, selC('01-open-held')],
  [g(6.5) + 0.18, TALL ? 1.95 : 1.7, selC('02-cycle1')], [g(7), TALL ? 1.95 : 1.7, selC('02-cycle1')],
  [g(7) + 0.18, TALL ? 1.95 : 1.7, selC('03-cycle2')], [g(7.5), TALL ? 1.95 : 1.7, selC('03-cycle2')],
  [g(7.5) + 0.18, TALL ? 1.95 : 1.7, selC('04-cycle3')], [g(8.5), TALL ? 1.95 : 1.7, selC('04-cycle3')],
  [T.F2, TALL ? 1.75 : 1.6, [ov.search[0] + ov.search[2] / 2, ov.search[1] + (TALL ? 230 : 170)]], [g(10.75), TALL ? 1.75 : 1.6, [ov.search[0] + ov.search[2] / 2, ov.search[1] + (TALL ? 230 : 170)]],
  [g(11) + 0.2, TALL ? 1.25 : 1.2, [CW / 2, TALL ? 420 : 330]], [g(11.75), TALL ? 1.25 : 1.2, [CW / 2, TALL ? 420 : 330]],
  [T.F3 - 0.15, 1.6, [CW / 2, TALL ? 330 : 280]], [g(13.5), 1.6, [CW / 2, TALL ? 330 : 280]],
  [g(13.5) + 0.3, 1.6, closedC], [T.MET, 1.75, closedC],
];
function camera(t) {
  let i = 0; while (i < KF.length - 2 && t >= KF[i + 1][0]) i++;
  const [ta, za, fa] = KF[i], [tb, zb, fb] = KF[i + 1];
  const p = outExpo(k(t, ta, Math.max(0.001, tb - ta)) * 1.0);
  const z = lerp(za, zb, p); let f = [lerp(fa[0], fb[0], p), lerp(fa[1], fb[1], p)];
  if (t >= T.F1) {   // keep the visible window inside the capture
    const sc = s0 * z, hw = W / 2 / sc, top = (anchor[1] - CLIPY) / sc, bot = (H - anchor[1]) / sc;
    f[0] = CW > 2 * hw ? clamp(f[0], hw, CW - hw) : CW / 2;
    f[1] = CH > top + bot ? clamp(f[1], top, CH - bot) : f[1];
  }
  return { z, f };
}
const anchor = [U.x + s0 * CW / 2, U.y + s0 * CH / 2];
const toScreen = (cam, p) => [anchor[0] + s0 * cam.z * (p[0] - cam.f[0]), anchor[1] + s0 * cam.z * (p[1] - cam.f[1])];

function stateAt(t) {
  if (t < T.F1) return '10-overview';
  if (t < g(6.5)) return '01-open-held'; if (t < g(7)) return '02-cycle1'; if (t < g(7.5)) return '03-cycle2';
  if (t < T.F2) return '04-cycle3';
  if (t < g(9.5)) return '12-cleared';
  const typing = [g(9.5), g(9.75), g(10), g(10.25), g(10.5)];
  for (let i = 4; i >= 0; i--) if (t >= typing[i]) { if (t < T.F3) return '11-search-' + i; }
  if (t < T.F3) return '12-cleared';
  return !TALL && t >= g(13.5) + 0.05 ? '14-window2-closed' : '13-window2';
}
// cursor path in UI coords (follows the camera); screen coords on the end card
const searchPt = [ov.search[0] + 120, ov.search[1] + ov.search[3] / 2];
const chipPt = [w2chip.r[0] + w2chip.r[2] / 2, w2chip.r[1] + w2chip.r[3] / 2];
const CUR = [ [g(8.25), [CW * 0.85, CH * 0.75]], [T.F2 - 0.02, searchPt], [g(10.75), searchPt], [g(11.5), [searchPt[0] + 160, searchPt[1] + 220]], [T.F3 - 0.02, chipPt], [g(13.25), chipPt], [g(14), [chipPt[0] + 60, chipPt[1] + 180]] ];
function curUI(t) {
  if (t < CUR[0][0] || t > T.MET) return null;
  let i = 0; while (i < CUR.length - 2 && t >= CUR[i + 1][0]) i++;
  const [ta, pa] = CUR[i], [tb, pb] = CUR[i + 1]; const p = inOut(k(t, ta, tb - ta));
  return [lerp(pa[0], pb[0], p), lerp(pa[1], pb[1], p)];
}

// ---------------------------------------------------------------- paint
window.seek = function seek(t) {
  // ----- background colour per scene
  const scene = t < T.PROD ? 'hook' : t < T.MET ? 'ui' : t < T.END ? 'met' : 'end';
  bg.style.background = { hook: 'var(--cream)', ui: 'var(--ink)', met: 'var(--sun)', end: 'var(--cream)' }[scene];
  show(grid, scene !== 'ui');
  // global hit shake (seeded), decays over 90 ms after each hook word / impact
  let shx = 0, shy = 0;
  for (const h of [...words.map((w) => w.t0), T.PROD, T.MET, T.END]) { const d = t - h; if (d >= 0 && d < 0.09) { const r = mulberry32(Math.floor(h * 1000)); const a = (1 - d / 0.09) * 14 * S; shx += (r() - 0.5) * 2 * a; shy += (r() - 0.5) * 2 * a; } }

  // ----- HOOK
  show(hook, scene === 'hook');
  if (scene === 'hook') {
    tf(hook, shx, shy);
    for (const c of chips) {
      const p = k(t, c.t0, 0.32); show(c.e, t >= c.t0);
      const fall = p * p;                                   // gravity
      const bounce = p >= 1 ? Math.sin(clamp((t - c.t0 - 0.32) / 0.12) * Math.PI) * -18 * Math.max(0, 1 - (t - c.t0 - 0.32) / 0.12) : 0;
      const shake = t > g(2.5) ? Math.sin(t * 90 + c.r) * 6 : 0;
      tf(c.e, c.x + shake, lerp(-120, c.y, fall) + bounce, 1, c.r * (0.4 + 0.6 * p));
    }
    for (const w of words) {
      const p = k(t, w.t0, 0.12); show(w.box, t >= w.t0);
      const [bw, bh] = size(w.box);
      const sc = lerp(2.4, 1, steps(outExpo(p), 4));
      const pulse = t > g(2) ? 1 + 0.04 * Math.max(0, 1 - (t - g(2)) / 0.1) : 1;
      tf(w.box, w.h.x * S - (bw * sc * pulse) / 2, w.h.y * S - (bh * sc * pulse) / 2, sc * pulse, w.h.panel ? -4 : 0);
    }
  }

  // ----- UI scenes
  const uiOn = scene === 'ui';
  show(uiClip, uiOn); show(keyRow, uiOn && t < T.F2 + 0.15); show(pressCap, uiOn && t < T.KEY + B / 4);
  if (uiOn) {
    const cam = camera(t);
    const [ox, oy] = toScreen(cam, [0, 0]);
    // the panel arrives with a stepped rise at PROD, before it is filled
    const burst = t < T.KEY ? 0 : steps(outExpo(k(t, T.KEY, 0.22)), 6);
    show(uiWrap, t >= T.KEY);
    const kc = [W / 2, H * 0.52];                       // where the keys sit before the press
    const bs = lerp(0.08, 1, burst);
    tf(uiWrap, lerp(kc[0], ox, burst) + shx - (1 - burst) * s0 * CW * bs / 2, lerp(kc[1], oy, burst) + shy - CLIPY - (1 - burst) * s0 * CH * bs / 2, s0 * cam.z * bs);
    const sh = 14 / (s0 * cam.z); tf(uiShadow, sh, sh);
    const st = stateAt(t);
    for (const n of STATES) show(shots[n], t >= T.F1 && n === st);
    // assembly (PROD .. F1): real pieces at their real positions
    for (const pc of pieces) {
      const on = t >= pc.at && t < T.F1; show(pc.e, on); if (!on) continue;
      const r = pc.r; const p = k(t, pc.at, pc.kind === 'fly' ? 0.2 : 0.14);
      let x = 0, y = 0, s = 1, rot = 0;
      if (pc.kind === 'drop') { y = (1 - outBack(p)) * -160; }
      else if (pc.kind === 'pop') { s = steps(outBack(p), 4) || 0.0001; }
      else { // cards spring out of the Q key, arc into their slot
        const keyUI = [(W / 2 - ox) / (s0 * cam.z), (L.keys.y * S - oy) / (s0 * cam.z)];
        const e = outExpo(p);
        const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2;
        x = lerp(keyUI[0] - cx, 0, e); y = lerp(keyUI[1] - cy, 0, e) - Math.sin(Math.PI * e) * 160; s = lerp(0.25, 1, e); rot = (1 - e) * (pc.i % 2 ? 12 : -12);
      }
      const ex = (pc.kind === 'fly' ? 6 : pc.kind === 'pop' && pc.r === coffeeR ? 8 : 0);
      const ey = (pc.kind === 'fly' ? 6 : pc.kind === 'pop' && pc.r === coffeeR ? 8 : pc.r === openHead || (ov.heads[2] && pc.r === ov.heads[2].r) ? 4 : 0);
      css(pc.e, { left: r[0] - ex + 'px', top: r[1] - ey + 'px', transformOrigin: '50% 50%' });
      pc.e.style.transform = `translate(${x}px,${y}px) rotate(${rot}deg) scale(${s})`;
    }
    // keycaps: drop in at PROD, Alt down at KEY - 1/8, Q at KEY; F1: Alt held, Q taps on 3.25/3.5/3.75 (the cycle)
    const kp = steps(outBack(k(t, T.PROD + 0.05, 0.2)), 5);
    const [aw] = size(kAlt), [qw] = size(kQ), [pw] = size(kPlus);
    const small = t >= T.F1 ? 0.62 : 1;
    const total = (aw + qw + pw + 2 * L.keys.gap);
    const big = t < T.KEY + B / 4 ? 1.35 : 1;
    const toBottom = outExpo(k(t, T.KEY + B / 4, 0.2));
    const kyMid = H * 0.52 - (L.keys.h * big) / 2, kyLow = (t >= T.F1 ? H - (TALL ? 260 : 170) : L.keys.y - L.keys.h / 2) * S;
    const sc2 = t >= T.F1 ? small : lerp(big, 1, toBottom);
    const kx = W / 2 - (total * sc2) / 2, ky = lerp(kyMid, kyLow, toBottom);
    tf(keyRow, kx + shx, ky + (1 - kp) * 500 * S + (t > T.F2 ? k(t, T.F2, 0.15) * 400 : 0), sc2);
    const altDown = t >= T.KEY - B / 4 && (t < T.KEY + B / 2 || (t >= T.F1 && t < T.F2));
    const qTaps = [T.KEY, g(6.5), g(7), g(7.5)];
    const qDown = qTaps.some((q) => t >= q && t < q + B / 4);
    const press = (b, d) => { b.style.setProperty('--sh', d ? '0px' : '10px'); b.style.translate = d ? '10px 10px' : '0 0'; };
    css(kAlt, { left: '0px', top: '0px' }); css(kPlus, { left: aw + L.keys.gap + 'px', top: L.keys.h * 0.18 + 'px' }); css(kQ, { left: aw + pw + 2 * L.keys.gap + 'px', top: '0px' });
    press(kAlt, altDown); press(kQ, qDown);
    // "Press" lead-in on the key beat
    { const p = steps(outExpo(k(t, T.PROD + B / 4, 0.15)), 4); const [cw] = size(pressCap); tf(pressCap, W / 2 - cw / 2, H * 0.52 - (TALL ? 330 : 250) * S + (1 - p) * 60 * S); pressCap.style.opacity = p > 0 ? 1 : 0; }
  }
  // captions per feature: words slam up from below, stepped
  for (const c of caps) {
    const on = uiOn && t >= c.t0 && t < c.t1; show(c.e, on); show(c.tagE, on && t >= c.t0 + B / 2);
    if (!on) continue;
    const p = steps(outExpo(k(t, c.t0, 0.16)), 4); const [cw] = size(c.e);
    tf(c.e, W / 2 - cw / 2, (L.capY + (1 - p) * 90) * S);
    const tp = steps(outBack(k(t, c.t0 + B / 2, 0.14)), 4); const [tw] = size(c.tagE);
    tf(c.tagE, W / 2 - (tw * tp) / 2, L.tagY * S, tp || 0.0001);
  }
  // cursor + click ring
  let cur = null, curS = 1;
  if (uiOn) { const u = curUI(t); if (u) { const cam = camera(t); cur = toScreen(cam, u); } }
  const clicks = [T.F2, T.F3, g(19)];
  for (const c of clicks) if (t >= c && t < c + 0.1) curS = 0.82;
  if (scene === 'end' && t >= g(18)) {
    const [bw, bh] = size(cta); const bx = W / 2 - bw / 2, by = E.btnY * S;
    const target = [bx + bw * 0.7, by + bh * 0.55];
    const p = inOut(k(t, g(18), g(19) - g(18)));
    cur = [lerp(W + 40, target[0], p), lerp(H * 0.95, target[1], p)];
  }
  show(cursor, !!cur);
  if (cur) tf(cursor, cur[0], cur[1], curS * (TALL ? 1 : 0.85));
  let ringOn = false;
  for (const c of clicks) { const d = t - c; if (d >= 0 && d < 0.16 && cur) { ringOn = true; const s = 30 + steps(d / 0.16, 4) * 120; css(ring, { width: s + 'px', height: s + 'px', opacity: 1 }); tf(ring, cur[0] - s / 2, cur[1] - s / 2); } }
  show(ring, ringOn);

  // ----- METRIC
  show(met, scene === 'met');
  if (scene === 'met') {
    show(sunSprite, false); const sz = 0;
    tf(sunSprite, W / 2 - sz / 2 + shx, H / 2 - sz / 2 + shy, 1, Math.floor((t - T.MET) / (B / 4)) * 15);
    for (const w of metWords) {
      const p = k(t, w.t0, 0.12); show(w.box, t >= w.t0);
      const [bw, bh] = size(w.box); const sc = lerp(0.2, 1, steps(outBack(p), 4));
      tf(w.box, W / 2 - (bw * sc) / 2 + shx, w.m.y * S - (bh * sc) / 2 + shy, sc, w.m.panel ? 3 : 0);
    }
    show(metTag, t >= T.MET + 0.75); const tp = steps(outBack(k(t, T.MET + 0.75, 0.14)), 4); const [tw] = size(metTag); tf(metTag, W / 2 - (tw * tp) / 2, L.metTagY * S, tp || 0.0001);
  }

  // ----- END
  show(end, scene === 'end');
  if (scene === 'end') {
    const lp = outBack(k(t, T.END, 0.22)); const ls = steps(lp, 5) || 0.0001;
    tf(logo, W / 2 - (E.logo * ls) / 2 + shx, E.logoY * S - (E.logo * ls) / 2 + shy, ls);
    const [ww, wh] = size(wordmark); tf(wordmark, W / 2 - ww / 2, E.wordY * S - wh / 2);
    wmLetters.forEach((s, i) => { const p = steps(outExpo(k(t, g(18) - B / 2 + i * 0.03, 0.14)), 4); s.style.transform = `translateY(${(1 - p) * 120}px)`; s.style.opacity = t >= g(18) - B / 2 + i * 0.03 ? 1 : 0; });
    const sp = t >= g(18) - B / 4; show(sub, sp); { const [sw] = size(sub); tf(sub, W / 2 - sw / 2, E.subY * S); }
    const bp = steps(outBack(k(t, g(18), 0.16)), 4); show(cta, t >= g(18));
    const down = t >= g(19) && t < g(19) + 0.12;
    cta.style.setProperty('--sh', down ? '0px' : '10px');
    { const [bw] = size(cta); tf(cta, W / 2 - (bw * bp) / 2 + (down ? 10 : 0), E.btnY * S + (down ? 10 : 0), bp || 0.0001); }
    // press row
    show(pressRow, t >= g(19));
    const [lw] = size(pLead), [aw2] = size(eAlt), [qw2] = size(eQ);
    const gap = 22, tot = lw + aw2 + qw2 + 3 * gap + 30;
    css(pLead, { left: '0px', top: (TALL ? 20 : 18) + 'px' }); css(eAlt, { left: lw + gap + 'px', top: '0px' }); css(eQ, { left: lw + aw2 + 3 * gap + 30 + 'px', top: '0px' }); css(ePlus, { left: lw + aw2 + 2 * gap + 2 + 'px', top: (TALL ? 20 : 16) + 'px' });
    const pr = steps(outExpo(k(t, g(19), 0.14)), 4);
    tf(pressRow, W / 2 - tot / 2, (E.pressY + (1 - pr) * 40) * S);
    eAlt.style.setProperty('--sh', '5px'); eQ.style.setProperty('--sh', t >= g(19.5) && t < g(19.75) ? '0px' : '5px');
    show(url, t >= g(19.25)); { const [uw] = size(url); tf(url, W / 2 - uw / 2, E.urlY * S); }
  }

  // ----- sky-band wipes (bands sweep up through the frame, stepped)
  let anyBand = false;
  for (const w0 of WIPES) {
    const d = t - w0; if (d < 0 || d >= 0.3) continue; anyBand = true;
    bands.forEach((b, i) => { const p = steps(clamp((d - i * 0.01) / 0.22), 6); const y = lerp(H + i * H / 7, -H / 7 * (7 - i), p); show(b, true); tf(b, 0, y); });
  }
  if (!anyBand) bands.forEach((b) => show(b, false));
};
window.DUR = DUR; window.T = T; window.ready = true;
window.seek(Number(Q.get('t') || 0));
})();
