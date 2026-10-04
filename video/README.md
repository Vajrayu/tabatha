# Tabatha showreel (10 s, 120 BPM)

A motion-graphics video for Tabatha 1.3.2, styled with the yuvsualy design system.
Final renders: `out/tabatha-1080x1920.mp4` (9:16) and `out/tabatha-1080x1080.mp4` (1:1), 60 fps, H.264 yuv420p CRF 16, score at -14 LUFS.

## The engine
`index.html` is a single 1080-wide canvas. Every frame is a pure function of time: `window.seek(t)` paints frame t.
The film is a `SCENES` array of `{ from, to, draw(t) }` shots (hook, UI + features, metric, end card, sky-band wipes).
Motion uses a closed-form `spring()`, eases and stepped eases; noise is seeded (mulberry32), never `Math.random`.
Open `index.html` in a browser for a live preview (`?w=1080&h=1080` for the square, `?t=4.5` to freeze a frame).

`render.mjs` seeks the page at FPS x SUB steps, pipes each canvas frame to ffmpeg, which averages SUB sub-frames
into one (`tmix`, real motion blur), writes `out/silent-WxH.mp4`, then muxes `audio/score.wav` into `out/tabatha-WxH.mp4`.

    npm install                                 # Playwright
    node render.mjs                             # 1080x1920, --fps 60 --dur 10 --sub 4
    node render.mjs --w 1080 --h 1080           # the square, same SCENES
    node render.mjs --sheet                     # contact sheet, one frame per beat
    npm run render                              # both formats

## Files
- `assets/`        real captures of the 1.3.2 switcher (`ui/portrait`, `ui/landscape` + element rects), logo, store shots, yuvsualy tokens/icons/cursor, fonts. See `assets/ASSETS.md`.
- `make-data.mjs`  bundles `beats.json` and the capture rects into `data.js` (render.mjs runs it for you).
- `sound.py`       synthesizes the score + SFX, writes `audio/score.wav` (-14 LUFS) and `beats.json` (beat grid measured from the kick).
- `sheet.py`       tiles the contact-sheet frames.
- `cap/capture.js` re-captures the switcher states with Playwright (uses the `tools/screenshots` demo sites).
- `out/`           contact sheets and the MP4s.

Needs Node + Playwright (Chromium), ffmpeg, Python 3 with numpy, scipy, pyloudnorm, Pillow.
The Gavency demo fonts (personal use only) are not in this repo: copy Gavency-Italic.woff2 and Gavency-Condensed.woff2 from the portfolio's public/fonts into `assets/fonts/`.
