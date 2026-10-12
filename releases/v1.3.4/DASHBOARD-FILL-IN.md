# Chrome Web Store dashboard: fill-in sheet for Tabatha 1.3.4

A small update: fixes only. **No permission changes and no change to what is collected**, so the Privacy tab and the listing text stay as they are (from 1.3.3). Submit once, after the steps below.

## 0. Before you open the dashboard
- [ ] You loaded `extension/` unpacked once (chrome://extensions → Load unpacked) and tried: close a tab from the first card (Tabatha reopens next door), the actions bar at the top, More / Settings close on a second click.
- [ ] `PRIVACY.md` (12 Oct) is on GitHub (pushed with 1.3.4; the Privacy tab links to it).
- [ ] The website loads: https://tabatha-vert.vercel.app (it was down on 12 Oct; fixed).
- [ ] Known and accepted: the Russian and Spanish text is still the first draft (native check planned after release).

## 1. Package
- **Upload new package** → `tabatha-1.3.4.zip` (this folder).
- Check: version **1.3.4**; name and summary unchanged; languages English, Russian, Spanish.
- There should be **no permission warning**: the permissions are exactly 1.3.3's (`tabGroups` and `bookmarks` stay optional).

## 2. Store listing tab
- Descriptions (English, Russian, Spanish): **unchanged** (they are in `../v1.3.3/store-listing.md` if you need them).
- Screenshots (optional but recommended: the actions bar moved to the top): replace them with `store-assets/screenshots/captioned-01-overview.png`, `-02-search`, `-03-actions`, `-04-bookmarks`, in that order (1280×800, no alpha). Same promo tiles (`store-assets/promo-small-440x280.png`, `promo-marquee-1400x560.png`).

## 3. Privacy tab
- **Nothing to change.** Same single purpose, same permission justifications, same data-use answers as 1.3.3. (1.3.4 adds one locally stored setting: the date you pressed "Not now" on the Alt+Q note. It's a preference, not user data, never leaves the computer, and is listed in PRIVACY.md.)

## 4. Submit
- Submit for review. Then tell Claude, so the commit gets the `v1.3.4` tag and the trackers say "submitted".
