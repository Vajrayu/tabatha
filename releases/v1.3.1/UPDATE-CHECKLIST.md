# Tabatha 1.3.1: what to change in the Chrome Web Store dashboard

Compared with what was submitted for 1.3.0 (27 Sep 2026). Go screen by screen; anything not listed here stays exactly as it is.
The text to paste is in `store-listing.md` in this folder.

## Before you open the dashboard
- [ ] Windows check from `audit.md` done (tap Alt+Q stays open on Windows).
- [ ] The updated `PRIVACY.md` is pushed to GitHub. The Privacy tab links to it on GitHub, so the reviewer sees whatever is on GitHub `main`, not the file on your Mac.

## 1. Package
- [ ] **Upload new package** → `tabatha-1.3.1.zip` (this folder). The dashboard should then show version **1.3.1**.
- Name, summary and icons come from the zip: unchanged.

## 2. Store listing
- [ ] **Description**: replace the whole text with the Description block in `store-listing.md`. Changed lines:
  - How it works: now tap-to-open first, hold-and-release second
  - All your windows: "each labelled with its site and window"
  - Recently closed: "closed in the last few hours"
  - Tidy up fast: "(Cmd+Backspace on a Mac)"
  - "Sleeping tabs" line reworded: only tabs Chrome unloaded are Sleeping; awake tabs with no screenshot say "No preview yet"
  - New line: Buy Me a Coffee
  - Keyboard shortcuts: "Alt+Q: open Tabatha / next tab", new "Arrow keys" line, Mac close key
  - Private by design: coffee-link sentence added; the two bullets about memory-only previews / 30 minutes replaced (previews are now on disk for 7 days)
- Summary: **unchanged** (comes from the manifest).
- Category, language, homepage and support URLs: **unchanged**.
- [ ] **Screenshots**: delete the 3 old ones, upload the new ones from `store-assets/screenshots/` in this order: `captioned-01-overview.png`, `captioned-02-search.png`, `captioned-03-windows.png`.
- [ ] **Small promo tile**: replace with `store-assets/promo-small-440x280.png`.
- [ ] **Marquee promo tile** (if you set one): replace with `store-assets/promo-marquee-1400x560.png`.

## 3. Privacy
- [ ] **`storage` permission justification: replace** with the new text in `store-listing.md` (previews are now saved on disk for 7 days, not memory-only).
- Everything else is unchanged: single purpose, the other permission justifications, remote code ("No"), data usage ticks (Web history + Website content), the three certifications. No new permissions.
- Privacy policy URL: **unchanged** (`https://github.com/Vajrayu/tabatha/blob/main/PRIVACY.md`), but its content must be pushed first (see above).

## 4. Distribution
- **No changes** (Free, Public, all regions).

## 5. Test instructions
- [ ] Replace with the Test instructions block in `store-listing.md`. Changed:
  - Step 2: "press Alt+Q and let go … stays open" (was "hold Alt and tap Q … release Alt")
  - New step 6: the coffee button opens buymeacoffee.com in a new tab
  - Last line: "The extension itself makes no network requests."

## Then
- [ ] **Submit for review.** Optional: tick "publish manually after approval" if you want to choose when it goes live.
- [ ] After submitting, tell Claude so it can tag `v1.3.1` and update PROJECTS.md / Projects.xlsx.
