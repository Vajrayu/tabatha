// In-page fallback for Alt+Q (classic content script, can't use imports).
// Chrome's shortcut system can leave a key unassigned when another extension
// or app already owns it; this makes Alt+Q work on web pages anyway.
//
// Security: this runs on every page, so the page is untrusted. It reads
// nothing from the page and only reacts to *real* key presses (isTrusted), so
// a page can't open the switcher by dispatching fake keyboard events.
//
// Idempotent: the script is both declared in the manifest and injected on
// install/reload. A live copy makes later copies no-ops; a copy orphaned by
// an extension reload (chrome.runtime.id is gone) is replaced.
(() => {
  const HOTKEY = 'tabatha:hotkey'; // keep in sync with MSG.HOTKEY in lib/constants.js
  const alive = () => { try { return !!chrome.runtime.id; } catch { return false; } };

  const existing = window.__tabathaHotkey;
  if (existing && existing.alive()) return;
  if (existing) window.removeEventListener('keydown', existing.onKey, true);

  function onKey(e) {
    if (!e.isTrusted || e.code !== 'KeyQ' || !e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
    if (!alive()) { window.removeEventListener('keydown', onKey, true); return; }
    e.preventDefault();
    e.stopImmediatePropagation();
    send(e.shiftKey ? -1 : 1);
  }

  // The service worker can be asleep or still starting when the key is pressed. Sending a
  // message normally wakes it, but if it isn't listening yet the call is rejected, and a
  // silently swallowed rejection looks like "Alt+Q does nothing". So retry once after a
  // moment, by which time the worker has woken.
  function send(dir) {
    const msg = { type: HOTKEY, dir };
    chrome.runtime.sendMessage(msg).catch(() => new Promise((r) => setTimeout(r, 50))
      .then(() => { if (alive()) return chrome.runtime.sendMessage(msg); })
      .catch(() => {}));
  }

  window.addEventListener('keydown', onKey, true);
  window.__tabathaHotkey = { alive, onKey };
})();
