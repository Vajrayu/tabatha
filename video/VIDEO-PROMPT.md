# Prompt: a 10-second product showreel, made in code

Paste everything below the line into Claude Code (or any coding agent with a shell, Node, Python and a browser). Fill in the `[SLOTS]` first.

---

You are a motion designer who builds videos in code. Make a short product showreel for **[PRODUCT]**, [ONE-LINE DESCRIPTION].

- **Product source / site:** [PATH OR URL]
- **Brand / design system:** [NAME + where its tokens, fonts, logo live]
- **The one action that shows how it works:** [e.g. "press Alt+Q"]
- **Features to show (max 2):** [FEATURE 1], [FEATURE 2]
- **CTA:** [e.g. "Add to Chrome, it's free" + "Chrome Web Store · search 'X'"]
- **Optional proof line:** [METRIC or "none"]
- **Length:** 10 s at 120 BPM. **Formats:** 1080×1920 (9:16) first, then 1080×1080 (1:1) and 1920×1080 (16:9) from the same timeline.
- **Save everything to:** [OUTPUT FOLDER]

## 1. How to think about it

Story, one beat each:
1. **Hook (0–1.5 s):** the viewer's problem in about 5 words of huge kinetic type, one word per beat.
2. **The product appears (1.5–3 s):** show the one action (e.g. the keys being pressed), and the real UI builds itself out of it, piece by piece.
3. **Feature 1 (≈2.5 s)** and **Feature 2 (≈2.5 s):** each one is a real UI moment with a cursor or keys doing a real action.
4. **End card (last ≈2 s):** logo, wordmark, one-line description, the CTA button getting clicked, and the action repeated as a reminder ("Then press [Alt] + [Q]").

Pacing rules (learned the hard way: the first cut felt anxious):
- **Fewer moments, each held longer.** Two features held for 2.5 s each beat four features at 1.5 s. If a viewer can't explain the product after one watch, cut something.
- **One short caption per moment** (3–4 words). No sub-tags, labels or second lines on top of it.
- **No stat card unless it gets 1.5 s or more on screen.** A number that flashes by just adds stress. When in doubt, cut it.
- Keep the hook and the end card strong. They're what people remember.
- Something visually new every 2–4 s, but motion inside a moment should be slow enough to follow (camera moves of about 0.3 s, typing at 0.25 s per letter).

Look:
- One display face, one UI face, one accent colour. Use the brand's own tokens (colours, borders, shadows, buttons) and draw them in code.
- Banned defaults: a centred title on a gradient, everything fading in, corner labels and frame borders, glow on UI chrome, generic particle bursts.

## 2. Gather real assets first (never redraw the UI)

- Capture the real product with Playwright: load the real build (for a browser extension, launch Chromium with `--load-extension`). Use fictional demo content, never real brands or personal data. Screenshot every UI state the story needs (open, each step of the action, search with each typed letter, results). For each state, also save a JSON file of element rectangles (cards, selected card, search box, chips) from `getBoundingClientRect()`, so animations can target the real positions.
- Capture each format's viewport separately (e.g. 960×1280 for portrait, 1280×800 for landscape).
- Copy the real logo, icons, cursor, fonts (woff2) and colour tokens.
- Save everything to `assets/` and write `assets/ASSETS.md` listing what you found **before** you animate. Crop and animate the real screenshots; never rebuild the UI from imagination.
- Don't commit fonts whose licence doesn't allow redistribution.

## 3. The engine: one canvas, pure function of time

`index.html` holds one `<canvas>`, sized from `?w=&h=`. Every frame is a pure function of `t`:
- No CSS transitions, no `setTimeout`, and no animation loop during a render.
- No state carried between frames.
- Seeded noise only (mulberry32), never `Math.random`.

```html
<canvas id="c"></canvas>
<script src="data.js"></script>  <!-- window.DATA = { beats, portrait: {state: rects}, landscape: {...} } -->
<script>
const Q = new URLSearchParams(location.search);
const W = +(Q.get('w') || 1080), H = +(Q.get('h') || 1920), DUR = 10;
const cv = document.getElementById('c'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
const S = Math.min(W, H) / 1080;                     // layout units: 1080 on the short side
const TALL = H > W * 1.3, WIDE = W > H * 1.3;        // pick a layout table per format

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const k = (t, t0, d) => clamp((t - t0) / d);         // local progress 0..1
const lerp = (a, b, p) => a + (b - a) * p;
const outExpo = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
const outBack = (p) => { const c = 1.9; return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2; };
const steps = (p, n) => Math.floor(clamp(p) * n) / n; // stepped ease (pixel-art feel)
function spring(t, k = 170, d = 26) {                // closed-form damped spring, 0 -> 1
  if (t <= 0) return 0; const w0 = Math.sqrt(k), z = d / (2 * w0);
  if (z < 1) { const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t)); }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
}
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0;   // mulberry32
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// timeline on the measured beat grid (B = 0.5 s at 120 BPM)
const B = DATA.beats.beat, gb = (n) => DATA.beats.phase + n * B;
const T = { HOOK: gb(0), PROD: gb(3), KEY: gb(4), F1: gb(6), F2: gb(11), END: gb(16) };

const SCENES = [
  { from: T.HOOK, to: T.PROD, draw(t) { /* kinetic words over a seeded pile of real tab titles */ } },
  { from: T.PROD, to: T.END,  draw(t) { /* keys, UI assembly, camera over real screenshots, cursor, captions */ } },
  { from: T.END,  to: DUR,    draw(t) { /* logo, wordmark, CTA click, reminder */ } },
  { from: 0,      to: DUR,    draw(t) { /* transitions between scenes, e.g. brand-colour band wipes */ } },
];
function draw(t) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.letterSpacing = '0px';  // reset ALL canvas state
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  for (const s of SCENES) if (t >= s.from && t < s.to) s.draw(t - s.from);
}
window.seek = (t) => { draw(t); return true; };
// init: await document.fonts.load(...) for every face, load every image, then:
// window.ready = true; and only if (!navigator.webdriver) run a requestAnimationFrame live preview.
</script>
```

Techniques that worked:
- **Camera over the real UI:** keyframes `[time, zoom, focus point in UI coordinates]`, eased between, and clamped so the view never leaves the screenshot. Draw the state image for time t (`stateAt(t)`), and draw the cursor in UI coordinates so it rides the camera.
- **UI assembling itself:** draw crops of the real screenshot at their real rects. Each crop drops, pops or flies in from the key, staggered.
- **Brand components in canvas:** draw the design system's buttons, keycaps and tags as rectangles (border, hard offset shadow, dither band) from its tokens.
- **Text:** centre words by their real ink box (`measureText().actualBoundingBoxAscent/Descent`), and lay out rows of words by measuring them. Reset `textAlign`, `textBaseline` and `letterSpacing` before every text draw, because canvas state leaks between draws.
- **Hits:** a short seeded screen shake (about 90 ms) on big beats.
- **One layout table per format** (portrait, square, wide): positions in 1080-based units × `S`. In 16:9, put the captions in a left column and the UI on the right, and clip the UI to its area.
- Screenshot PNGs can be 1× or 2×; check the real pixel size before cropping.

`make-data.mjs` bundles `beats.json` plus every `assets/ui/<format>/*.json` into `data.js`, so `index.html` also works from `file://` for preview.

## 4. Sound: synthesized, on the beat grid

`sound.py` (numpy, scipy, pyloudnorm) writes `audio/score.wav` and `beats.json`.
- **Music:** 120 BPM in one key (e.g. F minor: Fm, Db, Ab, Eb). A kick with a pitch drop, a noise snare, hats, a saw/pulse bass on eighths, a chip arpeggio on sixteenths, and saw pads. Hook = one stab per word with rising pitch. Groove from the product reveal to the end card. A big chord plus a pluck arpeggio on the end card.
- **SFX on the same grid:** a keycap "thock" for every key press and typed letter, a UI click on every cursor click, whooshes (filtered noise swept in 10 ms blocks) into each scene change, and small ticks as UI pieces pop in.
- **Seeded noise** (`np.random.default_rng(7)`).
- **Loudness:** normalise to **-14 LUFS** integrated, soft-limit peaks to about -1 dBTP, normalise again, and fade the last 0.4 s.
- **Measure the beat grid, don't assume it:** run onset detection on the kick stem (log-energy derivative, threshold about 2.0, 0.2 s minimum gap), take the median gap as the beat, and write `beats.json` with `beat`, `phase` and `beats[]`. The picture uses this grid (`gb(n)`), so cuts land on hits.
- When the timeline changes, change the SFX times and the scene constants in `sound.py` too, and re-run it.

## 5. Render

`render.mjs`:
- Flags: `--w`, `--h`, `--fps 60`, `--dur 10`, `--sub 4`, `--sheet`.
- Serve the folder with a tiny Node static server, so the canvas isn't tainted and `toDataURL` works.
- Open `index.html?w=&h=` in Playwright Chromium and wait for `window.ready`.
- For each of the `DUR × FPS × SUB` steps: `seek(i / (FPS × SUB))`, grab the canvas PNG with `toDataURL`, and write it to ffmpeg's stdin.

```js
const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(FPS * SUB), '-i', '-',
  '-vf', `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/${FPS}/TB`,   // average SUB sub-frames = real motion blur
  '-r', String(FPS), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'slow',
  '-movflags', '+faststart', `out/silent-${W}x${H}.mp4`]);
// ...write every frame (respect 'drain'), end stdin, wait for close, then mux the score:
// ffmpeg -i out/silent-WxH.mp4 -i audio/score.wav -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart out/[name]-WxH.mp4
```

- `--sheet` mode: grab one frame per beat (a little after each hit, `beat + 0.45 × B`) and tile them with labels (`sheet.py`, Pillow) into `out/contact-sheet-WxH.png`.
- `package.json` scripts: `"sheet"` and `"render"` run all three formats.
- Check the output: `ffprobe` (size, 60 fps, 600 frames, 10.0 s) and `ffmpeg -af ebur128` (about -14 LUFS).

## 6. The loop (don't skip it)

1. Make the contact sheets for all formats **before** any full render, and look at them.
2. Score each format 1–10 on: hook, readability on a phone, motion, variety, brand, and sound sync.
3. Fix the 3 worst things and repeat until everything is 8 or higher. Also ask: "Could someone who has never seen this product explain what it does after one watch?" If not, cut, then hold the rest longer.
4. Only then run the full renders. Look at a few full-size frames from the MP4s too (camera clamps, text overflow, clipped captions).
5. Deliver: the three MP4s, the contact sheets, the engine files (`index.html`, `data.js`, `make-data.mjs`, `render.mjs`, `sound.py`, `sheet.py`, `package.json`, `README.md`) and `assets/`.

To run it on a Mac: `brew install ffmpeg`, `pip install numpy scipy pyloudnorm pillow`, `npm install` (Playwright), then `python3 sound.py && npm run sheet && npm run render`.
