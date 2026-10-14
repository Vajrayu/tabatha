# Tabatha 1.3.5

_One fix on top of 1.3.4 (live 13 Oct 2026), from a 400-tab profile with Dark Reader. No new permissions; one new list kept in memory only (the sites where Tabatha had to open as a window), cleared when Chrome quits. The Russian and Spanish text is still the first draft._

## Faster and clickable on dark-mode pages
- **On a page a dark-mode extension recolours (Dark Reader, dark themes for Google Docs and others), Tabatha now opens as its own window straight away**, in about a third of a second. 1.3.4 first drew itself inside the page, waited over a second for Chrome to confirm nothing was altering it (clicks did nothing meanwhile), then drew everything again in a window: 1.7 to 3 seconds with 400 tabs, and it felt frozen.
- **Sites where this happened once open as a window from then on** (until Chrome quits), also when the page's own pop-up was covering Tabatha.
- **Big profiles:** the check that moves Tabatha to a window now starts counting only once Tabatha is on screen, so a slow first draw with hundreds of tabs is never mistaken for a covered page.

Measured in Chromium with 400 tabs and 300 saved previews: plain pages 0.2 to 0.9 s in the page (unchanged); dark-mode pages 1.7 to 3.2 s → about 0.3 s. Test: `tools/e2e/t-big.mjs`.
