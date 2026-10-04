# Tabatha showreel (10 s, 120 BPM)

A motion-graphics video for Tabatha 1.3.2, styled with the yuvsualy design system.
Final renders: `out/tabatha-1080x1920.mp4` (9:16) and `out/tabatha-1080x1080.mp4` (1:1), H.264 yuv420p CRF 16.
Every frame is a pure function of time: `window.seek(t)` in `film/film.js` paints frame t.

- `assets/`        real captures of the 1.3.2 switcher (`ui/portrait`, `ui/landscape` + element rects), logo, store shots, yuvsualy tokens/icons/cursor, fonts. See `assets/ASSETS.md`.
- `film/`          the timeline page (`index.html`, `film.js`). `film/assets` links to `../assets`.
- `sound.py`       synthesizes the score + SFX, writes `audio/score.wav` (-14 LUFS) and `beats.json` (beat grid measured from the kick).
- `render.mjs`     `node render.mjs` renders 1080x1920 to `out/`; `--w 1080 --h 1080` for the square; `--sheet` makes a contact sheet (one frame per beat).
- `cap/capture.js` re-captures the switcher states with Playwright (uses the `tools/screenshots` demo sites).
- `out/`           contact sheets and the MP4s.

Needs Node + Playwright (Chromium), ffmpeg, Python 3 with numpy, scipy, pyloudnorm, Pillow.
render.mjs imports Playwright from `/opt/node22/lib/node_modules/playwright` (the cloud machine); on a Mac run `npm i playwright` and change that import to `'playwright'`.
The Gavency demo fonts (personal use only) are not in this repo: copy Gavency-Italic.woff2 and Gavency-Condensed.woff2 from the portfolio's public/fonts into `assets/fonts/`.
