# Tabatha

**Alt+Tab for Chrome tabs.** Press <kbd>Alt</kbd>+<kbd>Q</kbd> to see live previews of every open tab, search them, jump between windows, and reopen the ones you just closed.

![Tabatha showing previews of open tabs](releases/v1.3.0/store-assets/screenshots/raw-01-overview.png)

## Features

- **Live previews**: a screenshot of every tab, not just a favicon and a title.
- **Hold-and-release switching**: hold Alt, tap Q to move through tabs in most-recently-used order, let go to switch. It works like Alt+Tab.
- **Search**: type to filter open and recently closed tabs by title or URL.
- **Every window in one view**: filter to one window with <kbd>Alt</kbd>+<kbd>W</kbd>.
- **Recently closed**: reopen closed tabs and windows, with their last preview.
- **Close from the switcher**: <kbd>Del</kbd> or middle-click.
- **Works everywhere**: on pages extensions can't draw on (New Tab, `chrome://`, the Web Store) it opens in a small popup window instead.
- **Private**: previews stay in memory on your computer and are wiped when Chrome closes. The extension makes no network requests. See [PRIVACY.md](PRIVACY.md).

## Shortcuts

| Keys | Action |
|---|---|
| <kbd>Alt</kbd>+<kbd>Q</kbd> / <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>Q</kbd> | Open, next / previous tab |
| <kbd>Alt</kbd>+<kbd>W</kbd> | Cycle window filter |
| Arrows, <kbd>Tab</kbd> | Move selection |
| <kbd>Enter</kbd> or release <kbd>Alt</kbd> | Switch to selected tab |
| <kbd>Del</kbd> | Close selected tab |
| <kbd>Esc</kbd> | Clear search / close |

On macOS, Alt is <kbd>Option</kbd>. To change the shortcut, go to `chrome://extensions/shortcuts`.

## Install from source

1. Clone this repo.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and pick the `extension/` folder.

Requires Chrome 116+.

## Repository layout

```
extension/            the extension source (what gets zipped and published)
releases/v<version>/  per-release artefacts: submitted zip, store listing text, screenshots, promo tiles, notes
tools/screenshots/    scripts that regenerate the store screenshots with fictional demo sites
PRIVACY.md            privacy policy (linked from the Chrome Web Store)
```

## How it works

- `background.js` (service worker) tracks tab usage order, captures a downscaled screenshot whenever a tab becomes visible, and opens the switcher.
- The switcher (`switcher.html/js/css`) is injected as a full-page iframe over the current tab. On pages where that's impossible, it opens in a popup window.
- `hotkey.js` is a tiny content-script fallback for Alt+Q, in case Chrome's shortcut is taken by another app.
- All state lives in `chrome.storage.session` (in memory only).
- The switcher only renders when it gets a one-time launch token from the background worker. Clicks only count while the overlay is actually visible, which guards against clickjacking by hostile pages.

## License

[MIT](LICENSE)
