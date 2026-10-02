# Tabatha roadmap

Ideas Yuvaraj proposed on 27 Sep 2026, right after 1.3.0 went into Chrome Web Store review, plus Claude's assessment. Nothing here is built yet. Update this file as decisions get made.

## Guiding principles (don't break these)
- **Nothing leaves the computer.** This is the core promise in the store listing and PRIVACY.md. Any feature that sends page content or tab data to a server (e.g. a cloud AI) breaks it. Prefer on-device approaches. If something ever must go off-device, it has to be opt-in, clearly labelled, and disclosed in PRIVACY.md and on the store's Privacy tab.
- **No analytics / tracking.** That's part of the pitch. Signals come from store installs, reviews, and feedback people choose to give. → Add a "Suggest a feature / report a bug" link (GitHub issues) in the extension or listing before building much more.
- **Tabatha = never lose a tab.** Features should fit "find / switch / keep your tabs". Anything else is probably a separate extension.
- **Don't add permissions casually.** `<all_urls>` already triggers the slow in-depth review. Every new permission adds install warnings and review time.

## Order of work (set by Yuvaraj, 2 Oct 2026)
1. **Ship 1.3.2.** Built and documented (`releases/v1.3.2/`); waiting on the store submission.
2. **Store, then discoverability.** Submit 1.3.2 together with listing updates meant to rank better on the Chrome Web Store. After that, a **new website for Tabatha** for SEO and AEO (answer-engine) discoverability. *Priority only: not started, not designed.*
3. **Then discuss the new feature ideas below.** The older list further down still applies to the items it names; where these new ideas rank against the stash is still to be decided.

## New ideas (2 Oct 2026) and assessment
Not built. Assessment is Claude's; items marked "not verified" need a quick test before relying on them.

1. **"Power Search".** Chrome's address bar can't be extended for normal typing; only a keyword works (e.g. `tb` + Space) via the `omnibox` API, no new permission. Suggestions would come from open tabs plus the 7-day closed-tab list. Chrome reports which Enter was pressed (Ctrl/Cmd+Enter = background tab, Alt+Enter = foreground tab), so Ctrl+Enter = reopen a closed tab fits. Searching full browser history needs the `history` permission (install warning): avoid. **Open question:** did Yuvaraj mean Tabatha's own search box or Chrome's address bar?
2. **Shortcut for "Switch to tab".** Only possible inside Tabatha or the keyword mode above; extensions can't add buttons to Chrome's own dropdown. In Tabatha, Enter on an open tab already switches. Shift+Tab is taken (moves selection backwards).
3. **Tab groups as sections on top.** Needs the `tabGroups` permission (whether it adds an install warning: not verified; it does mean a slower review). Show group name + colour, ungrouped tabs below.
4. **Move tabs between machines.** Phase 0 (no new permission, no server): read Chrome's own "tabs from other devices" list with `sessions.getDevices` and reopen with `sessions.restore` (not verified; needs two synced machines). Only works if both machines use the same Google account with sync on, which managed browser profiles often don't. Phase 1: export/import a tab set as a file or code, no server. Phase 2 (own cloud sync) breaks "nothing leaves the computer": not recommended. Anything that moves browsing data between machines must be explicit and opt-in, and is a privacy decision to make deliberately.

## Priority order
1. **v1.4: Save window ("stash"). Build next, keep it free.**
2. **Later: Search by what a page is about. Best idea, highest risk. Validate first.**
3. **Parked: Search a page by meaning (smarter Ctrl+F).** Separate extension if ever.

---

## 1. Save window / stash (v1.4)
**Idea:** When windows get messy, one shortcut saves all tabs in the current window into a named group inside Tabatha, closes them, and leaves a clean window. It's like tab grouping, but stronger than what Chrome gives you.

**Why it's first:** it fits Tabatha best, turns it from a nice shortcut into something people rely on every day (retention), and needs no new permissions (`tabs` + `storage` already there).

**Competition:** crowded: OneTab (millions of users), Session Buddy, Toby, Workona, Tab Stash, and Chrome's own saved tab groups (now synced).
**Differentiator:** stashed tabs keep their **previews**, and they appear in the **Alt+Q switcher and its search** next to open and recently closed tabs. Nobody else does that. One keystroke to stash, one to find.

**Things to keep in mind**
- **Shortcut:** Chrome does **not allow Ctrl+Alt combinations** for extension commands (they clash with AltGr). Use something like **Alt+Shift+S**. Chrome allows at most 4 suggested shortcuts per extension. Currently 2 are used (Alt+Q, Alt+Shift+Q).
- **Storage moves to disk:** stashes must survive restarts, so they go in `chrome.storage.local` (the first thing Tabatha ever writes to disk). Screenshots are big, so consider the `unlimitedStorage` permission (no install warning), or store stashed previews smaller/fewer, or keep only URL + title + favicon for older stashes.
- **Privacy update required:** PRIVACY.md currently says "nothing saved to disk" and "wiped when Chrome closes". Rewrite those lines, and update the store's Privacy tab answers. Also offer a "delete all stashes" control.
- **Open questions to decide in the spec:** what exactly gets stashed (whole window vs selected tabs vs pinned tabs); naming (auto-name by date/top site, rename later); restore behaviour (new window vs current, restore one tab vs all, remove from stash on restore or keep); where stashes show in the switcher (own section? searchable always?); limits (how many stashes, how old); export/import (JSON) so people aren't locked in.
- **Next step:** write the v1.4 spec (behaviour, switcher UI, shortcuts, storage limits, privacy changes), then build.

## 2. Search by what a page is about ("super search")
**Idea:** Search tabs by their content, not just title/URL. E.g. "where I was working on the tracker" or "the blog about pasta recipes". Include a "don't track this window/site" option for banking etc.

**Assessment:** the best idea, but the biggest risk: to trust, to the product's promise, and to effort.
- **Permissions are already there:** Tabatha already has `<all_urls>` + a content script on every page, so reading page text adds **no new install warning**. (It does change what data is handled, so update PRIVACY.md and the store's data disclosures.)
- **Must stay on-device.** Use a small embedding model bundled in the extension (e.g. transformers.js in an offscreen document; the CSP would need `'wasm-unsafe-eval'`) or Chrome's built-in on-device AI. **Not** a cloud LLM.
- **Start without AI:** index each page's title, headings, meta description and main text, and use fuzzy (typo-tolerant) keyword search. That likely covers most of the value. Ship that, see if people use it, then add semantic search.
- **Sensitive sites excluded by default:** never index banking, email, health, etc. unless the user opts in. Plus the manual "don't track this site/window" toggle. Incognito is already excluded.
- **Check the competition first:** Chrome has been adding AI search over browsing history. See how good it is before investing. Tabatha's edge: it covers **open and stashed** tabs, with previews, in the switcher.
- **Possible paid feature** later, if proven.

## 3. Search a page by meaning ("super find", smarter Ctrl+F)
**Idea:** Find things in the current page by context: misspellings, close phrasings, whole sentences, not just exact keywords.

**Assessment:** useful, but it has nothing to do with switching tabs, and it competes with every "chat with this page" AI sidebar, including Chrome's own. Inside Tabatha it would blur what the product is. **Park it, or make it a separate extension** with its own pitch.

## Monetization notes
- People rarely pay for tab managers (OneTab is free). Keep the core features, including stash, **free**. They're what make people stay.
- The only realistic paid candidate is content search (#2), and only after usage shows people want it.
