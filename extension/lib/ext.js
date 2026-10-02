// Recognising the extension's own URLs.
// With "use_dynamic_url", chrome.runtime.getURL() returns a per-session random
// origin, while Chrome still reports some URLs (e.g. message senders) with the
// real extension id. Accept both.

const ORIGINS = [...new Set([chrome.runtime.getURL(''), `chrome-extension://${chrome.runtime.id}/`])];

export function isOwnUrl(url, path = '') {
  return typeof url === 'string' && ORIGINS.some((o) => url.startsWith(o + path));
}

// Key for the on-disk preview cache. Tab IDs don't survive a restart, URLs do.
// Drops the #fragment and any trailing slash, so https://a.com, https://a.com/
// and https://a.com/#top share one preview. Returns '' for anything unusable.
export function normalizeUrl(url) {
  if (typeof url !== 'string' || !url) return '';
  try {
    const u = new URL(url);
    u.hash = '';
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '') || '/';
    return u.href;
  } catch {
    return '';
  }
}

// Blank pages, New Tab pages and our own pages aren't worth listing as "recently closed".
export function isWorthReopening(url) {
  if (!url || isOwnUrl(url)) return false;
  return !/^(about:blank|chrome:\/\/newtab|chrome-search:|edge:\/\/newtab|brave:\/\/newtab)/.test(url);
}
