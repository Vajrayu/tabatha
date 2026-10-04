# Tabatha 1.3.2: what to change in the Chrome Web Store dashboard

Compared with 1.3.1 (the build before this one). Anything not listed here stays exactly as it is.
The text to paste is in `store-listing.md` in this folder.

> If 1.3.1 was never submitted, this checklist still works on its own: the Description and `storage` text below include everything from 1.3.1. Also upload the 1.3.1 screenshots from `../v1.3.1/store-assets/` (see `../v1.3.1/UPDATE-CHECKLIST.md`).

## Before you open the dashboard
- [ ] The updated `PRIVACY.md` is pushed to GitHub. The Privacy tab links to it there, and it now says previews are kept while a tab is open.
- [ ] Windows check from `../v1.3.1/audit.md` (tap Alt+Q stays open on Windows), if not done yet.

## 1. Package
- [ ] **Upload new package** → `tabatha-1.3.2.zip` (this folder). The dashboard should then show version **1.3.2**, name **Tabatha: Visual Tab Switcher with Live Previews** and the new summary (both come from the zip: check them on the Store listing tab).

## 2. Store listing
- [ ] **Description**: replace with the Description block in `store-listing.md`. Changed lines:
  - New opening paragraph (problem-led, with the words tab switcher, tab manager and Alt+Tab) and a new QUESTIONS section; "FEATURES" is now "WHAT YOU GET"
  - "Sleeping tabs": only tabs Chrome put to sleep while you browse are Sleeping; after a restart tabs keep their saved preview
  - "Private by design": previews are kept while the tab is open, and 7 days after you close it; saved tab groups stay until you remove them
  - New bullets under WHAT YOU GET: Tab groups (optional) and the first-run tour; one new question about the optional permission
- Screenshots, promo tiles, category, URLs: **unchanged**. (Name and summary change via the zip; see step 1.)

## 3. Privacy
- [ ] **`storage` permission justification: replace** with the new text in `store-listing.md` (adds saved tab groups and the tour/review counters).
- [ ] **`scripting` justification: replace** (adds the one-time "Press Alt+Q" notice).
- [ ] **Host permission justification: replace** (it no longer says screenshots are "kept in memory only").
- [ ] **`tabGroups`**: it is an *optional* permission (`optional_permissions` in the manifest), so users are not asked at install and existing users are not disabled on update. If the dashboard lists it, paste the `tabGroups` justification from `store-listing.md`.
- Unchanged: single purpose, other permission justifications, remote code ("No"), data usage ticks, certifications.

## 4. Distribution
- **No changes.**

## 5. Test instructions
- [ ] **Replace** with the block in `store-listing.md` (454 of 500 characters): it now mentions the first-run tour and the tab-groups link.

## Then
- [ ] **Submit for review.**
- [ ] After submitting, tell Claude so it can tag `v1.3.2` and update PROJECTS.md / Projects.xlsx.
