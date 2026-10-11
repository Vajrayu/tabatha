// "How is Tabatha working for you?": after 3 days + 15 opens, never on the first open of the day,
// at most twice and 14 days apart, ends when answered. Every answer still offers the store review.
import { launch } from './lib.mjs';
const T = await launch(process.env.EXT);
const ls = (k) => T.sw.evaluate((k) => chrome.storage.local.get(k).then((o) => o[k]), k);
const today = await T.sw.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; });
const setRv = (o) => T.sw.evaluate((o) => chrome.storage.local.set({ rv: o }), { soft: 0, lastSoft: 0, asks: 0, lastAsk: 0, done: false, day: today, ...o });
const [c] = await T.open(['alpha']); await T.skipFirstRun();
const f = () => T.frame(c);
const modalShown = async () => !(await f().$eval('#modal', (n) => n.hidden));
const day = 86400000, now = Date.now();
const reopen = async () => { await c.keyboard.press('Escape'); await c.waitForTimeout(300); await T.tap(c); await c.waitForTimeout(700); };

await T.tap(c); await c.keyboard.press('Escape'); await c.waitForTimeout(300);
T.log('open counter counts', (await ls('rv')).opens >= 1);

await setRv({ since: now - 2 * day, opens: 30 });
await reopen();
T.log('not before 3 days', !(await modalShown()));
await setRv({ since: now - 5 * day, opens: 10 });
await reopen();
T.log('not before 15 opens', !(await modalShown()));
await setRv({ since: now - 5 * day, opens: 20, day: '2000-1-1' });
await reopen();
T.log('not on the first open of the day', !(await modalShown()));

await setRv({ since: now - 5 * day, opens: 20 });
await reopen();
T.log('asks after 3 days and 15 opens', await modalShown());
T.log('asks how it is going', (await f().$eval('#dlg-title', (n) => n.textContent)) === 'How is Tabatha working for you?');
await f().click('text=Needs work'); await c.waitForTimeout(250);
let btns = await f().$$eval('#dialog button', (x) => x.map((b) => b.textContent));
T.log('a bad answer offers the survey, the review and the Pro waitlist', btns.includes('Tell me what would help') && btns.some((x) => /Review on the Chrome Web Store/.test(x)) && btns.some((x) => /Pro waitlist/.test(x)), btns.join('|'));
await c.keyboard.press('Escape'); await c.waitForTimeout(250);
T.log('Esc closes the dialog only', (await T.isOpen(c)) && !(await modalShown()));
T.log('ask counted', (await ls('rv')).asks === 1);

await setRv({ since: now - 20 * day, opens: 60, asks: 1, lastAsk: now - day });
await reopen();
T.log('not repeated within 14 days', !(await modalShown()));
await setRv({ since: now - 40 * day, opens: 90, asks: 2, lastAsk: now - 30 * day });
await reopen();
T.log('never more than twice', !(await modalShown()));

await setRv({ since: now - 5 * day, opens: 20 });
await reopen();
await f().click('text=Love it'); await c.waitForTimeout(250);
btns = await f().$$eval('#dialog button', (x) => x.map((b) => b.textContent));
T.log('a good answer offers the review first, and the waitlist', /Review on the Chrome Web Store/.test(btns.find((x) => x !== '') || '') && btns.some((x) => /Pro waitlist/.test(x)), btns.join('|'));
await f().click('#dialog .pixbtn.pro'); await c.waitForTimeout(900);
let urls = await T.sw.evaluate(async () => (await chrome.tabs.query({})).map((t) => t.url || t.pendingUrl));
T.log('the waitlist button opens /pro with only source, version and language', urls.some((u) => /^https:\/\/tabatha-vert\.vercel\.app\/pro\?from=extension-prompt&v=[\d.]+&lang=en$/.test(u)), urls.join(' '));
T.log('and it never asks again', (await ls('rv')).done === true);

await setRv({ since: now - 5 * day, opens: 20 });
await c.bringToFront(); await reopen();
await f().click('text=It’s okay'); await c.waitForTimeout(250);
await f().click('text=Tell me what would help'); await c.waitForTimeout(900);
urls = await T.sw.evaluate(async () => (await chrome.tabs.query({})).map((t) => t.url || t.pendingUrl));
T.log('the survey opens with the mood filled in', urls.some((u) => /\/survey\?from=extension-prompt&v=[\d.]+&lang=en&mood=okay$/.test(u)), urls.join(' '));

await setRv({ since: now - 5 * day, opens: 20 });
await c.bringToFront(); await reopen();
await f().click('text=Don’t ask again'); await c.waitForTimeout(300);
T.log('"Don’t ask again" ends it', (await ls('rv')).done === true && !(await modalShown()));
await T.close();
