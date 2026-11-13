# UI redesign — implementation and acceptance

Current source: `fill-frame-recovery-ui-redesign`, 2026-11-06. Contracts: [SPEC](../SPEC.md), [UI_SPEC](UI_SPEC.md). Approved boards remain unchanged in `docs/ui/redesign-2026-11/`.

## Implemented

- One Footage Sync window with Changes, History, Links and Settings; focused dialogs close/rebuild that window while preserving its tab, decisions, unchecked items, expanded groups and scroll. Main Panel remains separate.
- Changes has Needs you / Ready to apply, grouped fragmented decisions, Type / Folder grouping, group/folder/file selection, row menus, persistent Ignore, marker assignment and per-file/batch timeline opt-out. Deferred imports withhold dependent appends. Deselected parent bins withhold child imports. Decisions use source identities/signatures rather than regenerated planner IDs.
- Counts fold a new video's timeline append into its import. A standalone interrupted append still represents its existing video. The blue badge stays separate from the amber count; Sync has an attention dot. Buttons stop shrinking at 28 content px and scroll.
- Links uses mapping / option tags / derived state and row menus. Remove confirms. Add/edit is one form with an expandable bin dropdown, explicit Project root, folder validation/summary and preserved Browse state. New-link preview uses the same change selection model; staged folder exclusions are not saved on Cancel.
- Exclude subfolders scans metadata on demand, exposes the tree before totals finish, cancels further traversal on close and saves folder ignore rules atomically. Restore and exclusion updates retain file rules, mappings and existing Premiere content.
- Settings autosaves two sync modes; MANUAL is read as ASK. Repair is disabled while the helper is absent. Warnings cannot be disabled. Ignore and manual marker assignment moved into menus.
- History records actual completed changes, source-marker TXT operations, timeline tags, trigger, duration and failure stage; pending/warnings remain in Changes. Existing records without file details are identified as older records. Ignored paths are filtered from History.
- Live process card uses observed stages and measured durations, known operation counters and planned amounts. Unknown totals do not produce a progress bar. Closing the window does not cancel work.

## Automated and browser evidence

`npm run check`: 28 runtime JavaScript modules and unchanged UXP manifest baseline 25.6.

`npm test`: 155 tests. The temporary fixture directory is inside `artifacts/test-temp`: this avoids the sandbox TEMP rename EPERM observed in the existing fragmented-MP4 replacement test.

`scripts/check-redesign-ui.js` exercises the real UI source in isolated headless Edge with a fake Controller/host. It covers tabs, autosave, grouped decisions, row/window menus, picker restoration, nested bins, saved exclusions, timeline toggle, single active modal, successful/failed History, New-link preview and live progress. No browser errors. This is browser evidence, not Premiere mutation acceptance.

Local outputs: [result](../artifacts/ui-redesign/browser-result.json), [Changes](../artifacts/ui-redesign/changes.png), [expanded](../artifacts/ui-redesign/changes-expanded.png), [Links](../artifacts/ui-redesign/links.png), [Settings](../artifacts/ui-redesign/settings.png), [History](../artifacts/ui-redesign/history.png), [failure](../artifacts/ui-redesign/history-failed.png), [preview](../artifacts/ui-redesign/new-link-preview.png), [process](../artifacts/ui-redesign/changes-syncing.png), [exclusions](../artifacts/ui-redesign/exclude-subfolders.png). Screenshots use simulated data and approximate browser Spectrum widgets; they are not replacement golden boards.

## Native mechanism probe — Premiere 25.6.2, Windows

`scripts/build-redesign-probe.js` builds a separate plugin from the real UI source with fake Controller/host and no project mutations, persistence or polling. Premiere opened with no project. The following were observed through the native UI:

- Main Panel loaded at the small host startup size and retained usable buttons/scroll.
- Links opened the wide Footage Sync window; switching to Settings and Changes reused it.
- Window ⋯ displayed a positioned menu inside UXP. Ignored files and folders opened and returned to Settings.
- Import original highlighted the decision and changed Apply from 1 to 2 without applying anything.
- Add link opened; the bin dropdown initially showed top-level bins. Expanding Footage exposed Video/Audio; selecting Video chose `Footage/Video`.
- Browse opened the real Windows folder picker after closing the UXP form. Cancel returned to the form with `Footage/Video` preserved. The initial Escape was sent to the parent window and did not cancel the picker; targeting the actual picker confirmed restoration.
- All forms were closed without saving a link. Premiere was closed normally; no user project was opened or edited.

This probe preceded the final cosmetic corrections (remove duplicate focused-dialog heading; prevent Add path wrapping), custom timeline switch and final process/preview refinements. Those final changes have browser/check coverage. Full final-source native acceptance is still required. Actual per-monitor Windows scale and keyboard/DPI/workspace transitions were not recorded/accepted.

## Installation

The final source is installed using `scripts/install-dev.ps1` with Premiere closed, then compared by SHA256 against every source file. [Installed-file result](../artifacts/ui-redesign/installed.json). Installation identity/version and manifest permissions are unchanged. The temporary redesign probe is removed after testing; other plugins are left intact. Installation and native acceptance are separate outcomes.

## Remaining work / temporarily skipped

- **Copy full path is disabled.** Adobe documents a required clipboard manifest permission; this project currently declares none. Adding a new user-facing permission requires a product decision under AGENTS.md. No permission was silently added. Source: [Adobe clipboard recipe](https://developer.adobe.com/premiere-pro/uxp/resources/recipes/clipboard/).
- Full final-source native mutation matrix: healthy new/edit links, initial preview, exclusion Save/Restore, partial apply, real marker picker, History/progress on a fixture project, keyboard and monitor transitions. Previous reconciliation/Fill Frame/marker native evidence remains valid for the underlying core, not as acceptance of the new UI.
- Large/network/Lucid summary cost is unmeasured. Summaries read directory/stat metadata only and stop scheduling reads after cancellation; an already pending filesystem call cannot be aborted.
- History long-folder `Show N more` composition and the full nested reuse/move presentation in initial preview need a further visual pass against the boards. The current views expose the actual applied/pending data and decisions.
- Last-available observations persist at the next explicit settings/link/sync checkpoint, not on every idle poll. After restart the saved observation may therefore be older than the last in-memory successful scan.
- AUTO success/hidden-panel notification delivery, bundled media helper, Production lock/Undo/crash matrix and macOS remain the pre-existing open work; displaying their settings does not imply their acceptance.

Adobe documents one active modal at a time: [modal dialogs](https://developer.adobe.com/premiere-pro/uxp/plugins/tutorials/add-modal-dialogs/). The implemented restoration path follows the fallback already permitted by UI_SPEC; it adds no dependency, process, permission or compatibility change.
