// Recognising the extension's own URLs.
// With "use_dynamic_url", chrome.runtime.getURL() returns a per-session random
// origin, while Chrome still reports some URLs (e.g. message senders) with the
// real extension id. Accept both.

const ORIGINS = [...new Set([chrome.runtime.getURL(''), `chrome-extension://${chrome.runtime.id}/`])];

export function isOwnUrl(url, path = '') {
  return typeof url === 'string' && ORIGINS.some((o) => url.startsWith(o + path));
}
