// Clicking "Tell me" on the tour's last step opens the feedback form AND marks the tour as seen.
import { launch } from './lib.mjs';
const T = await launch(process.env.EXT);
const [c] = await T.open(['alpha']);
await T.tap(c); await c.waitForTimeout(500);
for (let i = 0; i < 4; i++) { await c.keyboard.press('ArrowRight'); await c.waitForTimeout(120); }
await T.frame(c).click('#dialog button:has-text("Tell me")'); await c.waitForTimeout(700);
const onb = await T.sw.evaluate(() => chrome.storage.local.get('onb').then((o) => o.onb));
T.log('tour marked as seen', onb.tour === true, JSON.stringify(onb));
const urls = await T.sw.evaluate(async () => (await chrome.tabs.query({})).map((t) => t.url || t.pendingUrl));
T.log('feedback form opened', urls.some((u) => u.startsWith('https://gettabatha.vercel.app/feedback')));
await T.close();
