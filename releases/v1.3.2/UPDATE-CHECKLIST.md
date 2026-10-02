# Tabatha 1.3.2: what to change in the Chrome Web Store dashboard

Compared with 1.3.1 (the build before this one). Anything not listed here stays exactly as it is.
The text to paste is in `store-listing.md` in this folder.

> If 1.3.1 was never submitted, this checklist still works on its own: the Description and `storage` text below include everything from 1.3.1. Also upload the 1.3.1 screenshots from `../v1.3.1/store-assets/` (see `../v1.3.1/UPDATE-CHECKLIST.md`).

## Before you open the dashboard
- [ ] The updated `PRIVACY.md` is pushed to GitHub. The Privacy tab links to it there, and it now says previews are kept while a tab is open.
- [ ] Windows check from `../v1.3.1/audit.md` (tap Alt+Q stays open on Windows), if not done yet.

## 1. Package
- [ ] **Upload new package** → `tabatha-1.3.2.zip` (this folder). The dashboard should then show version **1.3.2**.

## 2. Store listing
- [ ] **Description**: replace with the Description block in `store-listing.md`. Changed lines:
  - "Sleeping tabs": only tabs Chrome put to sleep while you browse are Sleeping; after a restart tabs keep their saved preview
  - "Private by design": previews are kept while the tab is open, and 7 days after you close it
- Screenshots, promo tiles, summary, category, URLs: **unchanged**.

## 3. Privacy
- [ ] **`storage` permission justification: replace** with the new text in `store-listing.md` (previews are kept while a tab with that page is open, otherwise 7 days).
- Everything else is unchanged: single purpose, other permission justifications, remote code ("No"), data usage ticks, certifications. No new permissions.

## 4. Distribution
- **No changes.**

## 5. Test instructions
- **No changes.**

## Then
- [ ] **Submit for review.**
- [ ] After submitting, tell Claude so it can tag `v1.3.2` and update PROJECTS.md / Projects.xlsx.
