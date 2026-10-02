# Tabatha 1.3.2

_Fixes from testing 1.3.1. No new permissions. This release changes how previews are stored, so the privacy policy and the store's `storage` justification change (see `UPDATE-CHECKLIST.md`)._

## What changed
- **Previews survive a browser restart, and stay as long as the tab does.** Previews are now saved on disk (`chrome.storage.local`), keyed by page address. A preview is kept for as long as any open tab has that page, however old it is. Once no open tab has it, it is deleted 7 days after it was last captured or used. Limits: 300 previews / about 6 MB; when over, previews no open tab uses go first, previews of open tabs last.
- **"Sleeping" now means Chrome really put the tab to sleep.** A tab shows as Sleeping (faded preview, "Sleeping" pill) only if Tabatha saw Chrome discard it during this browser session. Tabs that Chrome merely restores lazily after you reopen the browser show their saved preview normally, instead of every tab turning to "inactive/sleeping".
- **Closed-tab history goes back 7 days.** Tabatha keeps its own list of closed tabs (up to 200), so search finds tabs that Chrome's 25-item recently-closed list has forgotten. The default "Recently closed" row still shows only the last few hours.

## Bug fixes
- Closed windows (and any entry Chrome gives no time for) no longer show "20000 d ago" / "NaN d ago".
- Awake tabs that simply have no preview yet say "No preview yet" (with their domain), never "Inactive".
- Previews could be hidden after 7 days even for tabs still open, and the cleanup could run while Chrome was still restoring tabs after a restart. Both fixed: previews are no longer expired when read, and the cleanup waits a minute after browser start.

## Still true
- A tab you have never looked at has no preview: Chrome only lets extensions screenshot the tab that is on screen.

## Tested
Real Chrome: Chrome's discard event reaches Tabatha and the tab keeps its id; reactivating clears the flag; closing a discarded tab removes it; previews survive a restart with session restore; open-tab previews are never expired and are evicted last; cleanup is skipped in the first minute after start and runs at most every 6 hours.
Not tested: Chrome's lazy tab restore on a desktop browser (headless Chrome restores eagerly). The rendering rule for that case was tested with the flags faked.
