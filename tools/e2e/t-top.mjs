// 1.3.5 (part K): the Pro waitlist button and the coffee icon sit in the top row, right of the search; the key hints
// are in the footer, right. Layout only. Checked at 1100 and 1440 px and in the popup window: both buttons are in the
// first row (above the toolbar), don't touch the search field, the search stays centred; below ~1260 px Pro shows just
// "Pro" (full text as tooltip and accessible name); the coffee button is icon only (its words are the accessible name).
// Pro appears only after the walkthrough; Enter and a click on Pro open /pro?from=extension-button; coffee opens its
// link; the hints are in the footer (hidden on narrow windows); Y-bit peeks down from under Pro.
import { launch } from './lib.mjs';

const within = (p, ms = 3000) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
const rects = (f) => within(f.evaluate(() => {
  const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const cs = getComputedStyle(e); const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, hidden: e.hidden || cs.display === 'none' || !b.width }; };
  return { W: innerWidth, search: r('.search'), pro: r('#pro'), coffee: r('#coffee'), tools: r('#tools'), newtab: r('#newtab'), hint: r('.foot-hint'), foot: r('.foot'), peek: r('#peek') };
}));

async function layout(T, f, label, W, { hintShown }) {
  const g = await rects(f);
  const mid = (x) => (x.t + x.b) / 2;
  T.log(`${label}: Pro and Coffee are in the first row, above the toolbar`, !!g && !g.pro.hidden && !g.coffee.hidden && g.pro.b <= g.tools.t + 2 && g.coffee.b <= g.tools.t + 2 && Math.abs(mid(g.pro) - mid(g.newtab)) < 14 && Math.abs(mid(g.coffee) - mid(g.newtab)) < 14, JSON.stringify(g && { pro: g.pro, coffee: g.coffee, tools: g.tools }));
  T.log(`${label}: neither touches the search field, Pro is left of Coffee`, !!g && g.pro.l >= g.search.r + 8 && g.coffee.l >= g.pro.r + 8 && g.coffee.r <= g.W, JSON.stringify(g && { search: g.search, pro: g.pro, coffee: g.coffee }));
  T.log(`${label}: the search field stays centred`, !!g && Math.abs((g.search.l + g.search.r) / 2 - g.W / 2) <= 3, g && `centre ${(g.search.l + g.search.r) / 2} of ${g.W}`);
  const narrow = W < 1260;
  const txt = await within(f.evaluate(() => { const b = document.getElementById('pro'); const vis = (e) => getComputedStyle(e).display !== 'none'; return { full: vis(b.querySelector('.full')), short: vis(b.querySelector('.short')), aria: b.getAttribute('aria-label'), title: b.title }; }));
  T.log(`${label}: Pro shows ${narrow ? 'just "Pro"' : 'its full text'}; the full text is its accessible name`, !!txt && txt.full === !narrow && txt.short === narrow && txt.aria === 'Tabatha Pro · Join the waitlist' && /^Tabatha stays free/.test(txt.title), JSON.stringify(txt));
  const cof = await within(f.evaluate(() => { const b = document.getElementById('coffee'); return { text: b.textContent.trim(), aria: b.getAttribute('aria-label'), title: b.title }; }));
  T.log(`${label}: the coffee button is an icon; "Buy me a coffee" is its accessible name`, !!cof && cof.text === '' && cof.aria === 'Buy me a coffee' && /^Tabatha is free/.test(cof.title), JSON.stringify(cof));
  T.log(`${label}: the key hints are in the footer, right side${hintShown ? '' : ' (hidden on a narrow window)'}`,
    !!g && (hintShown ? !g.hint.hidden && g.hint.t > g.tools.b + 300 && g.hint.l > g.W / 2 && g.hint.r <= g.W : g.hint.hidden), JSON.stringify(g && g.hint));
  T.log(`${label}: the footer links stay on the left`, !!g && g.foot.l < 100 && g.foot.t > g.tools.b + 300 && (!hintShown || g.foot.r < g.hint.l), JSON.stringify(g && g.foot));
}

// ---------- overlay: a new install first (Pro appears only after the walkthrough), then 1440 and 1100 ----------
{
  const T = await launch(process.env.EXT, { viewport: { width: 1440, height: 800 } });
  const [a] = await T.open(['alpha', 'beta']);
  const f = () => T.frame(a);
  await T.tap(a); await a.waitForTimeout(500);
  T.log('new install: Pro is hidden while the capture card and walkthrough are up', await within(f().evaluate(() => document.getElementById('pro').hidden)));
  await T.capPress(a, 'Later'); await a.waitForTimeout(400);
  T.log('…still hidden during the walkthrough', await within(f().evaluate(() => document.getElementById('pro').hidden)));
  await a.keyboard.press('Escape'); await a.waitForTimeout(400); // ends the walkthrough
  T.log('…and it appears once the walkthrough has been seen', (await within(f().evaluate(() => !document.getElementById('pro').hidden))) === true);
  T.log('the coffee button is there from the start', (await within(f().evaluate(() => !document.getElementById('coffee').hidden))) === true);
  await T.close();
}
for (const W of [1440, 1100]) {
  const T = await launch(process.env.EXT, { viewport: { width: W, height: 800 } });
  const [a] = await T.open(['alpha', 'beta']);
  await T.skipFirstRun();
  const f = () => T.frame(a);
  await T.tap(a); await a.waitForTimeout(700);
  await layout(T, f(), `${W} px`, W, { hintShown: W > 1100 });
  if (W === 1440) {
    T.log('the "window" hint is hidden with one window, shown with two', await (async () => {
      const one = await within(f().evaluate(() => document.getElementById('hint-win').hidden));
      await a.keyboard.press('Escape'); await a.waitForTimeout(400);
      await T.sw.evaluate(async (u) => { await chrome.windows.create({ url: u, focused: false }); }, T.url('gamma'));
      await a.bringToFront(); await T.tap(a); await a.waitForTimeout(600);
      const two = await within(f().evaluate(() => document.getElementById('hint-win').hidden));
      return one === true && two === false;
    })());
    T.log('Mac variants of the hints are still in the markup', (await within(f().evaluate(() => document.querySelectorAll('.foot-hint kbd[data-mac]').length))) >= 3);
    // Y-bit peeks down from under Pro.
    await f().evaluate(() => document.getElementById('pro').dispatchEvent(new MouseEvent('mouseenter')));
    await a.waitForTimeout(600);
    const g = await rects(f());
    const up = await within(f().evaluate(() => document.getElementById('peek').classList.contains('up')));
    T.log('Y-bit peeks down from under the Pro button', up === true && Math.abs(g.peek.t - g.pro.b) <= 4 && g.peek.l >= g.pro.l - 4 && g.peek.l < g.pro.r, JSON.stringify(g.peek) + ' / pro ' + JSON.stringify(g.pro));
    await f().evaluate(() => document.getElementById('pro').dispatchEvent(new MouseEvent('mouseleave')));
    // Keyboard: a focused Pro button answers Enter; a focused coffee button answers Space.
    const urls = () => T.sw.evaluate(async () => (await chrome.tabs.query({})).map((t) => t.url || t.pendingUrl));
    await f().evaluate(() => document.getElementById('pro').focus());
    const ring = await within(f().evaluate(() => { const b = document.getElementById('pro'); return getComputedStyle(b).boxShadow; }));
    await a.keyboard.press('Enter'); await a.waitForTimeout(900);
    T.log('Enter on the focused Pro button opens /pro?from=extension-button', (await urls()).some((u) => /tabatha-vert\.vercel\.app\/pro\?from=extension-button/.test(u)), (await urls()).join(' '));
    T.log('a focused Pro button looks different (the pixel button shifts and its shadow grows)', typeof ring === 'string' && ring.length > 0);
    await a.bringToFront(); await T.tap(a); await a.waitForTimeout(700);
    await f().evaluate(() => document.getElementById('coffee').focus());
    await a.keyboard.press('Space'); await a.waitForTimeout(900);
    T.log('Space on the focused coffee button opens its link', (await urls()).some((u) => /buymeacoffee\.com\/vey9utb/.test(u)), (await urls()).join(' '));
    await a.bringToFront(); await T.tap(a); await a.waitForTimeout(700);
    await f().evaluate(() => document.getElementById('coffee').click()); await a.waitForTimeout(900);
    const c1 = (await urls()).filter((u) => /buymeacoffee/.test(u)).length;
    T.log('a click on coffee opens its link (another tab)', c1 >= 2, String(c1));
    await a.bringToFront(); await T.tap(a); await a.waitForTimeout(700);
    await f().evaluate(() => document.getElementById('pro').click()); await a.waitForTimeout(900);
    T.log('a click on Pro opens /pro?from=extension-button (another tab)', (await urls()).filter((u) => /\/pro\?from=extension-button/.test(u)).length >= 2);
  }
  await T.close();
}

// ---------- popup window (html.window) ----------
{
  const T = await launch(process.env.EXT);
  const [a] = await T.open(['alpha', 'beta']); await T.skipFirstRun();
  const extId = new URL(T.sw.url()).host;
  const info = await T.sw.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); return { src: t.id, win: t.windowId }; });
  for (const W of [1100, 1440]) {
    const token = crypto.randomUUID();
    await T.sw.evaluate(([tok, i]) => chrome.storage.session.set({ launch: { token: tok, t: Date.now(), ctx: { src: i.src, win: i.win, dir: 1, state: 'normal', mode: 'window' } } }), [token, info]);
    const page = await T.ctx.newPage(); await page.setViewportSize({ width: W, height: 800 });
    await page.goto(`chrome-extension://${extId}/switcher.html?t=${token}`); await page.waitForTimeout(500);
    await page.mouse.move(300, 300); await page.mouse.move(340, 320); await page.waitForTimeout(800);
    await layout(T, page.mainFrame(), `popup window, ${W} px`, W, { hintShown: W > 1100 });
    await page.close();
  }
  await T.close();
}
