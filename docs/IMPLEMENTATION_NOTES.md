# Footage Sync — technical findings

Environment: Windows, Premiere Pro 2025 **25.6.2**. Tests use the user's `01_PoldenBridgeTest_Production`, project `00_Footage/01_PoldenBridgeTest_Footage.prproj`, and generated fixtures in this repository. Findings below distinguish documentation from observed behavior; they do not change SPEC.

## Premiere API

[VALIDATED — documentation + local host]

- [Project](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/project): active project, root traversal and `importFiles` into a selected FolderItem work on 25.6.2.
- [FolderItem](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/folderitem): bin creation, rename and moving Project Items use actions inside synchronous `lockedAccess` / `executeTransaction` callbacks. FolderItem is a wrapper; retain the underlying [ProjectItem](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/projectitem) for IDs and parent access. Calling ProjectItem methods directly on FolderItem failed in the local spike.
- [ClipProjectItem](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/clipprojectitem): `canChangeMediaPath` and `changeMediaFilePath` preserve the existing item. Local Windows finding: forward-slash paths returned `false`; native backslash paths succeeded. Import accepted forward-slash paths. Relink results are verified by reading the path back.
- Relink is not an undoable API action. Each completed action checkpoints verified IDs/paths in the sidecar. A later failure does not imply rollback of earlier project actions; reconciliation must recover from the recorded state.

## Source clip markers — FUT-001

[VALIDATED — official documentation]

[Markers](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/markers) accepts `ClipProjectItem` as owner on baseline 25.6. `Markers.getMarkers(clip)` is asynchronous; the returned collection's `getMarkers()` and action creators are synchronous. [Marker](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/marker) exposes color/name/start/comments/duration and `createSetColorByIndexAction` on 25.6. `Marker.guid` is marked 26.3 and is not used. Actions are constructed inside synchronous project locked transactions, matching the [official marker sample](https://github.com/AdobeDocs/uxp-premiere-pro-samples/blob/main/sample-panels/premiere-api/src/markers.ts). Unfiltered readback avoids depending on filters for identity.

[VALIDATED — official documentation and local baseline]

Receipts use [Metadata](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/metadata) private project metadata (`getProjectMetadata`, `addPropertyToProjectMetadataSchema`, `createSetProjectMetadataAction`), parsed/serialized with [UXP XMPMeta](https://developer.adobe.com/premiere-pro/uxp/uxp-api/reference-js/Modules/uxp/XMP/). Namespace `http://ns.adobe.com/premierePrivateProjectMetaData/1.0/`, plain field `FootageSyncMarkerImports`: adding a `Column.PropertyText.` prefix silently failed the local probe. Existing schema `false` is not a write failure; verify readback. No source XMP metadata API is called. The controller persists sidecar observation **before** each attempt so an unsaved/undone/missing project receipt requires Review. Pending metadata is committed and verified separately before marker staging; do not assume mixed transactions are jointly atomic. No production autosave is introduced.

Baseline timing uses JSON `getProjectColumnsMetadata` raw `Column.Intrinsic.MediaStart` / `MediaDuration` values, divided by 254016000000 ticks/second. Formatted project metadata values are unsuitable for this calculation. `Media.getStart/getDuration` are 26.5 APIs. Fresh WAV `getOutPoint(AUDIO)` returned -400000 seconds and is not media duration. Source marker action times are relative seconds even when native source timecode starts at 01:00:00:00. Missing timing skips TXT with a warning.

[VALIDATED — local Premiere 25.6.2, generated WAV/MP4, 2026-10-03]

Isolated `artifacts/marker-host-test/ClipMarkers.prproj`, no sequences: `spike-result.json` confirms all 8 colors and seven example times; `import-result.json` confirms repeat zero and manual edits preserved. MP4 with source timecode 01:00:00:00 and duration 300 s confirms relative 53/72/90/112/214/246/267 s; native Markers panel shows first 01:00:53:00 (`video-result.json`, `source-markers.png`). `integration-result.json` confirms Controller Sync: 2 imports, automatic substring TXT / 7 markers, invalid TXT skipped while media imported, manual choice and explicit Append / Skip / Replace, repeat zero. Reacquire Marker collection after finalization: old Marker wrappers were stale in a compound color/name transaction and produced an incorrect readback failure. Verification compares a fresh full snapshot without 26.3 GUIDs.

WAV SHA256 unchanged; 3 MP4 SHA256 values unchanged (`36EA03D63A3DDCA14D951A58A21A870ADA6F9001A6A886F132E79204AF4AD94A`), no adjacent XMP. Generated fixtures only; no existing user footage or production project changed in these checks. Dedicated test plugin saves only its explicitly guarded test project. Initial `Project.createProject` forward-slash path failed; native backslashes succeeded (local path finding).

[LIMITATION — local native Undo]

`undo-result.json`: Edit → Undo after Replace restored the private metadata pending receipt, **but final source markers remained and the original markers were not restored**. Therefore baseline native source marker rollback is not guaranteed. Pending/observed mismatch requires Review, never automatic re-add. Resume checks staged names, times, color, duration, comments and unchanged baseline. Skip removes staged markers only if all remain intact; missing/edited/finalized markers are preserved while the pending receipt is reconciled. Crash/partial host failures and Productions still need acceptance beyond fake-host tests.

[VALIDATED — native recovery / reopen] The undone pending project was saved, Premiere restarted and the project reopened. Updated Controller returned a blocking marker choice; Skip preserved both finalized source markers exactly, removed the pending receipt, and repeat scan returned zero changes. Test-project save succeeded, sequences stayed zero (`recovery-result.json`).

[VALIDATED — native metadata visibility] On 25.6.2, immediate project metadata readback after a separate receipt transaction returned the previous value although the write subsequently appeared. Verification now retries reads for at most one second, without replaying any writes, before staging source markers. The isolated Controller recovered the interrupted intent, appended two markers, verified the final receipt, and returned zero repeat changes (`visibility-result.json`). Native Review Add to existing also completed without warnings (`ui-manual-result.json`).

[VALIDATED — dialog lifetime regression] Status closing while Review opens could restore a stale boolean and leave polling paused after both dialogs closed. UI now counts outstanding modals; the regression test verifies both overlapping completion and polling release. Manual TXT selection and picker cancellation are also covered by UI tests.

[VALIDATED — final native AUTO] Cold restart with the main panel closed imported two newly added generated MP4s. Valid matching TXT created seven source markers; invalid color produced a line-1 warning and zero markers while its MP4 imported. Correcting the TXT subsequently created one marker automatically, with zero pending changes/warnings on repeat (`auto-invalid-result.json`, `auto-invalid-markers.json`, `auto-corrected-result.json`, `auto-corrected-markers.json`). Reopened existing clips retained 7 / 7 / 6 markers and completed receipts. All five MP4 and two WAV hashes remained unchanged with XMP preference OFF (`source-hashes-after.json`); no adjacent XMP appeared. Latest installed main plugin matches all 16 source files; existing Bridge hashes still match. 63 automated tests and 13-module syntax/manifest checks pass.

[LIMITATION — documented XMP preference, locally OFF]

Adobe [Media preferences](https://helpx.adobe.com/premiere/desktop/get-started/preferences-and-settings/media-preferences.html) states that Write clip markers to XMP ON saves markers with media; OFF saves them in the project. Native Preferences confirmed OFF during these tests; no setting was changed. [AppPreference](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/apppreference) with documented [PreferenceKey constants](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/constants/) exposes no XMP toggle on baseline. Private receipt storage does not prove source marker actions bypass the preference. Unchanged hashes are local OFF evidence, not a guarantee for ON. A release guard or any different preference/installation flow requires an explicit product decision; do not silently change global Premiere preferences.

## Filesystem and identity

[VALIDATED — local host, NTFS fixtures only]

UXP [fs](https://developer.adobe.com/premiere-pro/uxp/uxp-api/reference-js/modules/fs/fs) methods return promises when no callback is supplied. Extended Premiere Windows paths (`\\?\`) are normalized before comparing/writing sidecars. The UXP stat result exposed safe integer `dev`, `ino` and creation time for these fixtures; renaming/moving on the same volume retained identity.

No filename/size-only rename matching is used. A missing/unsafe identity produces a blocking ambiguity rather than speculative relink/import. Network/Lucid identity stability and macOS are still unverified. Files still being written and invalid/truncated MP4 containers are held for another scan. Sources are stat-checked again immediately before mutation; a changed review is invalidated before any action.

[VALIDATED — documentation + local host]

MP4 detection checks `moof` and `moov/mvex` box headers while seeking past payloads. The [FFmpeg fragmentation documentation](https://ffmpeg.org/ffmpeg-formats.html#Fragmentation) was used to generate a small `frag_keyframe` fixture. The scanner detected that fixture as fragmented. Neither scanner nor sync remuxes or overwrites source media.

## UXP lifecycle and UI

[VALIDATED — local host]

Monitoring continues when the panel is closed during an already loaded Premiere session. A new WAV imported automatically with the panel absent, and no success modal appeared. See `artifacts/auto-panel-closed.json`. Cold application startup also passed in this local External installation: the panel was closed before quitting; after restarting and opening the project, AUTO imported a new WAV and renamed/relinked the original clip with its ID retained, without opening the panel. Premiere's native missing-media dialog was dismissed with Offline All for the single generated renamed fixture, allowing project loading to finish. See `artifacts/cold-start-auto-rename.json`. Other installation methods/workspaces still require lifecycle validation.

[LIMITATION — documented]

Adobe's [panel tutorial](https://developer.adobe.com/premiere-pro/uxp/plugins/tutorials/add-panels/) states that the `hide()` hook is unreliable in Premiere. Therefore diagnostic `visible` is not evidence that the panel is actually shown; use the real UI screenshot. Watcher lifetime is independent of that flag. Adobe documents invisible launch-time plugins using `hostUIContext.hideFromMenu` in [the first-plugin tutorial](https://developer.adobe.com/premiere-pro/uxp/plugins/); that route has not been added to the current visible panel plugin.

[VALIDATED — local host]

The compact panel, Links / Settings, matching-folder selection, Initial Sync, Status and batch Review render in Premiere. Dialog dimensions must be set on the element as well as in `uxpShowModal`. Native HTML buttons imposed unsuitable minimum widths on dense row actions, so those controls use styled keyboard-activatable HTML elements; primary actions use Spectrum widgets. Golden visual acceptance, docked width and all keyboard flows are not yet complete.

## Real host acceptance evidence

| Case | Observed result | Evidence |
|---|---|---|
| Initial matching-folder link | Three bins and two WAV clips; no mutation until Initial Sync confirmed | `artifacts/initial-sync.json` |
| Repeat Sync | Same bin/item IDs, zero pending changes, no additional import | `artifacts/repeat-sync.json` |
| Folder rename | Existing bin ID retained; clip relinked to the renamed directory | `artifacts/folder-rename-sync.json` |
| File move into another subfolder | Original clip ID retained, parent bin/path updated | `artifacts/file-move-sync.json` |
| AUTO with closed panel | New WAV imported, original IDs retained, zero pending/error | `artifacts/auto-panel-closed.json` |
| Fragmented MP4 + safe WAV in AUTO | Entire two-item batch held; three clips stayed unchanged | `artifacts/fragmented-blocks-batch.json` |
| Main Sync with that batch | One Review contained both files; Later changed nothing | Computer-use observation + same runtime state |
| Review: Sync selected safe WAV | Only WAV imported; fragmented MP4 remained pending | `artifacts/review-selected-sync.json` |
| Cold start with panel closed, new source + filename rename | New WAV imported; original clip renamed/relinked with the same ID, zero pending/error | `artifacts/cold-start-auto-rename.json` |
| Unavailable source | Temporary link path to a nonexistent fixture folder: Sync disabled, Status showed unavailable, all five clips/three bins retained | `artifacts/unavailable-source.json` |
| Restore link source | Initial Sync reused all five clips, zero imports/duplicates needed | Computer-use observation; final runtime state |

## Installation and isolation

[VALIDATED — local development installation]

Only the dedicated `com.vsly.footage-sync_0.1.0` folder in user UXP External is updated by `scripts/install-dev.ps1`. The installation refuses updates while Premiere runs. No Adobe binaries, preferences, other plugin sources or existing media assets are installer targets. Original test projects are backed up in `artifacts/original-projects/`; SHA256 of the three pre-existing Polden OBS Bridge files is recorded in `docs/existing-plugins-before.json` for comparison after testing.

After host testing, all three pre-existing Bridge SHA256 hashes matched the original snapshot (`artifacts/existing-plugins-after.json`). The link was restored to its working fixture folder and mode returned to ASK.

Release packaging should use Adobe's [distribution installation workflow](https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/install/). The current copied External layout is not release-installer validation.

## FUT-002 — adaptive Main Panel

[VALIDATED — docs + local Premiere 25.6.2 / UXP 8.1] [`ResizeObserver`](https://developer.adobe.com/premiere-pro/uxp/uxp-api/reference-js/global-members/html-dom/resize-observer) is available in the target host. The implementation observes only `#main-panel`; resizing a modal does not change Main Panel geometry. A feature-detected 300 ms fallback is disposed on destruction. Explicit button/SVG sizes avoid requiring CSS transforms, animation support flags or a new runtime. Busy animation updates eight SVG fills every 100 ms and stops on completion/error, zero size or destruction.

Pure `core/panel-layout.js` uses a 160 content-pixel width threshold and available width/height to fit all three actions; maximum button/icon size is 56/32 px. The numeric Status badge is fitted separately from the attention indicator. The plugin-owned header and persistent labels are removed; title tooltips and existing keyboard handlers remain. Controller and modal flows are unchanged.

[VALIDATED locally] Probe content 52 × 262 fits without overflow, row/column changes work in both directions, busy fills advance and stop, and production compact docking plus separate Links/Settings/Status and zero-change Sync work. [LIMITATION locally] Host initially chose content 40 × 48 instead of preferred 50 × 250; mathematical fit at that size does not make tiny controls comfortable. [Manifest documentation](https://developer.adobe.com/premiere-pro/uxp/plugins/concepts/manifest/) explicitly treats requested sizes as potentially ignored by the host.

Native tab remains under the approved fallback; no supported Tools registration/native-header control was found in reviewed official sources. This does not establish universal impossibility. Detailed evidence, installation hashes and remaining keyboard/nonzero-state/DPI/workspace checks: [panel acceptance](../artifacts/panel-host-test/ACCEPTANCE.md). Capture automation failed during the remaining matrix and was stopped after one recovery attempt. Automated suite: 67 passed; syntax/manifest: 15 modules validated. Installed production: 18/18 hashes match; Bridge/project hashes unchanged.
