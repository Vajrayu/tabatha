// Progress window for "Capture all previews" (opened and closed by the background worker).
import { KEY, MSG } from './lib/constants.js';
import { t, localizePage, loadLang } from './lib/i18n.js';
import { ybit } from './lib/ybit.js';

await loadLang();
localizePage();
document.title = t('sweepPageTitle');
document.getElementById('ybit').append(ybit('happy', 2));

const msg = document.getElementById('msg');
const fill = document.getElementById('fill');
const bar = document.querySelector('.bar');

function show(p) {
  if (!p || !p.running) { msg.textContent = t('sweepDone'); fill.style.width = '100%'; return; }
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  msg.textContent = t('sweepTabOf', Math.min(p.done + 1, p.total), p.total);
  fill.style.width = pct + '%';
  bar.setAttribute('aria-valuenow', String(pct));
}
chrome.storage.session.get(KEY.SWEEP).then((o) => show(o[KEY.SWEEP]));
chrome.storage.onChanged.addListener((c, area) => { if (area === 'session' && c[KEY.SWEEP]) show(c[KEY.SWEEP].newValue); });
document.getElementById('cancel').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: MSG.SWEEP_CANCEL }).catch(() => {});
  msg.textContent = t('sweepStopping');
});
