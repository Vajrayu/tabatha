// Interface text. Every string lives in _locales/<lang>/messages.json (en, ru, es), and the same text in
// lib/msgs/<lang>.js (generated from those files). Chrome gives extensions no way to switch language, so
// Tabatha picks its own: "auto" follows Chrome's language, or the user chooses one in Settings.
// chrome.i18n has no plurals, so counted phrases use keys ending in _one / _few / _many / _other, chosen
// with Intl.PluralRules (Russian needs all four). Call loadLang() once before the first t().
import EN from './msgs/en.js';
import RU from './msgs/ru.js';
import ES from './msgs/es.js';

export const LANGS = Object.freeze(['en', 'ru', 'es']);
const BOOKS = { en: EN, ru: RU, es: ES };

const chromeLang = () => {
  const l = (chrome.i18n.getUILanguage() || 'en').slice(0, 2).toLowerCase();
  return LANGS.includes(l) ? l : 'en';
};
let cur = chromeLang();
let book = BOOKS[cur];
let rules = new Intl.PluralRules(cur);
let rtf = new Intl.RelativeTimeFormat(cur, { numeric: 'auto', style: 'short' });

function use(lang) {
  cur = LANGS.includes(lang) ? lang : chromeLang();
  book = BOOKS[cur];
  rules = new Intl.PluralRules(cur);
  rtf = new Intl.RelativeTimeFormat(cur, { numeric: 'auto', style: 'short' });
  return cur;
}

/** Read the language setting ("auto" or a language). Resolves to the language in use. */
export async function loadLang() {
  let pref = 'auto';
  try { const o = await chrome.storage.local.get('prefs'); pref = (o.prefs && o.prefs.lang) || 'auto'; } catch {}
  return use(pref === 'auto' ? chromeLang() : pref);
}
/** Switch right away (Settings). */
export const setLang = (pref) => use(pref === 'auto' ? chromeLang() : pref);
/** The language the interface is in now: 'en' | 'ru' | 'es'. Also what the website pages are opened in. */
export const uiLang = () => cur;

const fill = (msg, subs) => msg.replace(/\$(\d)/g, (m, i) => (subs[i - 1] !== undefined ? subs[i - 1] : m));
const look = (key) => (key in book ? book[key] : key in EN ? EN[key] : null);

/** t('key', 'sub1', 'sub2') -> the text for this language ($1, $2 filled in). Missing keys show the key, so they're easy to spot. */
export function t(key, ...subs) {
  const m = look(key);
  return m === null ? key : fill(m, subs.map(String));
}

/** tn('tabs', 5) -> "5 вкладок". The message gets the number as $1. */
export function tn(key, n, ...subs) {
  const m = look(`${key}_${rules.select(n)}`) ?? look(`${key}_other`);
  return m === null ? key : fill(m, [String(n), ...subs.map(String)]);
}

/** "5 min ago" in this language. `sec` is a Unix time in seconds. */
export function timeAgo(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return ''; // no timestamp: say nothing rather than "20000 d ago"
  const s = Math.max(0, Date.now() / 1000 - sec);
  if (s < 60) return t('justNow');
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  return rtf.format(-Math.round(s / 86400), 'day');
}

/** Fill the static page: data-i18n (text), data-i18n-title, data-i18n-placeholder, data-i18n-aria. */
export function localizePage(root = document) {
  document.documentElement.lang = cur;
  for (const n of root.querySelectorAll('[data-i18n]')) n.textContent = t(n.dataset.i18n);
  for (const n of root.querySelectorAll('[data-i18n-title]')) n.title = t(n.dataset.i18nTitle);
  for (const n of root.querySelectorAll('[data-i18n-placeholder]')) n.placeholder = t(n.dataset.i18nPlaceholder);
  for (const n of root.querySelectorAll('[data-i18n-aria]')) n.setAttribute('aria-label', t(n.dataset.i18nAria));
}
