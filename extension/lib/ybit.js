// Y-bit, drawn from a character grid into a crisp SVG (no image files).
// Y-bit and this sprite code: Copyright (c) 2026 Vajrayu, all rights reserved (see ../../ART-LICENSE.md).

const INK = '#1B2A4A';
const PAL = { k: INK, o: '#FF9F5A', l: '#FFC38F', d: '#E0703A', w: '#FFFFFF', p: '#FF8FB1', g: '#6BCB77', G: '#3E8E41', m: '#C0392B' };

// A round little courier: orange body, sprout on top, envelope satchel. 20 x 19.
function rows(state) {
  const W = 20, H = 19, cx = 10, cy = 9.5, rx = 8.5, ry = 7.5;
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const inside = (x, y) => { const a = (x + 0.5 - cx) / rx, b = (y + 0.5 - cy) / ry; return a * a + b * b <= 1; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inside(x, y)) {
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    if (edge) g[y][x] = 'k';
    else { const n = ((x + 0.5 - cx) / rx) * 0.6 + ((y + 0.5 - cy) / ry) * 0.8; g[y][x] = n < -0.5 ? 'l' : n > 0.45 ? 'd' : 'o'; }
  }
  const set = (pts, c) => pts.forEach(([x, y]) => { g[y][x] = c; });
  g[1][10] = 'G'; g[0][10] = 'G'; g[0][11] = 'g'; g[0][12] = 'g'; g[1][11] = 'g';
  if (state === 'happy') { set([[4, 9], [5, 8], [6, 9], [12, 9], [13, 8], [14, 9]], 'k'); set([[9, 11], [10, 11]], 'k'); set([[9, 12], [10, 12]], 'm'); }
  else if (state === 'blink') { set([[5, 10], [6, 10], [12, 10], [13, 10]], 'k'); set([[9, 12], [10, 12]], 'k'); }
  else { // 'idle', or 'lookL' / 'lookR': the eyes move one pixel towards where it looks
    const dx = state === 'lookL' ? -1 : state === 'lookR' ? 1 : 0;
    const eye = (x0) => [[x0, 8], [x0, 9], [x0, 10], [x0 + 1, 8], [x0 + 1, 9], [x0 + 1, 10]];
    set([...eye(5 + dx), ...eye(12 + dx)], 'k');
    set(dx > 0 ? [[6 + dx, 8], [13 + dx, 8]] : [[5 + dx, 8], [12 + dx, 8]], 'w'); set([[9, 12], [10, 12]], 'k');
  }
  set([[3, 11], [4, 11], [14, 11], [15, 11]], 'p');
  set([[6, 18], [7, 18], [12, 18], [13, 18]], 'k');
  ['kkkkk', 'kkwkk', 'kwwwk', 'kkkkk'].forEach((r, dy) => [...r].forEach((ch, dx) => { g[12 + dy][15 + dx] = ch; }));
  return g.map((r) => r.join(''));
}

// Returns an <svg> element (built with the DOM, so nothing is parsed from a string).
export function ybit(state = 'idle', scale = 4) {
  const r = rows(state), NS = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', `0 0 ${r[0].length} ${r.length}`);
  s.setAttribute('width', String(r[0].length * scale));
  s.setAttribute('height', String(r.length * scale));
  s.setAttribute('shape-rendering', 'crispEdges');
  s.setAttribute('aria-hidden', 'true');
  r.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const ch = row[x];
      if (!PAL[ch]) { x++; continue; }
      let x2 = x; while (x2 < row.length && row[x2] === ch) x2++;
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', x); rect.setAttribute('y', y); rect.setAttribute('width', x2 - x); rect.setAttribute('height', 1); rect.setAttribute('fill', PAL[ch]);
      s.append(rect); x = x2;
    }
  });
  return s;
}
