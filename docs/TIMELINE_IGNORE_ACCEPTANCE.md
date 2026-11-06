# Timeline dependency and permanent ignore — 2026-10-28

Current development source, Windows / Premiere Pro **25.6.2**. Public release packages have not been replaced. Fill Frame remains the approved manual Premiere step after import.

## Failure and fix

The reported Review showed an unresolved fragmented MP4 beside a selected safe append for the same source. Previously that append could be confirmed without importing its media. The controller silently continued when the source was absent, producing no footage/title and misleading feedback. The user's sidecar was inspected read-only: the append queue was empty, with no observed append receipts. No user project/media/sidecar was changed during diagnosis.

Review now disables and clears dependent appends until their media import is selected/resolved. Import original enables both; Later clears both and explicitly says Deferred for this sync. The controller independently rejects an append with an unselected required import before persisting/mutating anything. A source unexpectedly absent or ambiguous after import produces a durable sequence error instead of a silent continue. Existing imported sources and completed receipt checkpoints do not require another media import.

Permanent Ignore is separate from Later. Review offers Ignore on files, managed disk folders and marker TXT warnings. The scope dialog shows an absolute path and File / Folder and subfolders. Settings → Manage ignored paths opens Add path / Restore. Rules save per import project and survive file replacement, future folder children and reopen. Matching paths are pruned before filesystem stat/read/TXT parsing; ignored records are excluded from identity matching without erasing their saved mappings. Pending sequence intents and observed receipts are paused, not discarded. Marker discovery also excludes already imported ignored sources and manually assigned ignored TXT. Restoring resumes ordinary reconciliation/Review. Nothing is deleted from Premiere or disk.

Current batch lists/counts/attention and retained operation warning/error cards omit ignored paths. Historical summary records remain history. Unsaved Settings options are carried across the separate manager and still require Save settings.

## Automated verification

**139 tests passed**; **22 runtime modules** and manifest validated; diff whitespace and standalone preview script checked. New coverage includes the exact unresolved-media/selected-append combination, native checkpoint exemption, Later feedback, Ignore cancellation/scope, Settings draft/Restore, persistence rollback, failed append suppression/restoration, folder boundaries/case/replacement, ignored unavailable roots, scanner no-access pruning and retained rename tombstones.

## Native acceptance

All mutations used generated fixtures in `artifacts/timeline-ignore-host-test/run1/`, through the isolated test plugin. Source/Selects projects were separate, and Selects was active while media imported to Footage.

| Case | Observed result |
|---|---|
| Genuine fragmented MP4, native Review | Initially source/append unchecked and disabled. Later shows Deferred and keeps both disabled. Import original checks/enables both; Sync selected produces footage + V2 native text, queue empty. UI states saved in `later-ui.json` / `original-ui.json`. |
| Mixed next batch | Two ISO-date clips plus `Съёмка & тест/#5.mp4`: five V1 clips including seed, three V2 titles. One date title spans both dated clips. |
| Three late batches | One more clip per batch. Eight V1 clips including seed, four V2 titles. The returning date starts a separate block after the other folder; subsequent same-date batches extend that title to six seconds. |
| Source audio | Eight clips on A1; no source audio missing in this stereo fixture. |
| Three further Sync confirmations | No duplicate clip/title/receipt, zero pending changes. Seven append receipts for seven imported source videos. |
| Broken MP4 → native Ignore | Review offers one media error. Ignore file saves the rule and returns a zero-change / zero-blocking Review immediately. |
| Settings → Restore | Rule is listed with its full path. Restore removes it, reanalysis finds the source problem again, and manager returns to Settings. |
| Folder rule + future files | Invalid MP4 and TXT created under ignored folder produce no changes, marker or sequence warnings. |
| Save and cold process restart | Both projects save. Reopened target retains eight V1 / four V2 items and one sequence (temporary title sequences removed). Folder rule survives; pending changes and warnings stay empty. |
| Independent saved-file read | All four graphics decode as native Type Tool: Overview, 2026-10-28, Съёмка & тест, 2026-10-28; LucidaConsole. Program renders the Cyrillic label before and after restart. |

Evidence: `result.json`, `reopen.json`, `timeline.png`, `native-title.png`, `reopen-timeline.png`, `reopen-title.png` in the fixture directory. Native scope/list/Settings captures: [Ignore dialog](ui/ignore-path.png), [list](ui/ignored-paths.png), [Settings entry](ui/settings-ignore.png). These are development captures rather than separate visual approval.

## Installation and limits

Main source installed using `scripts/install-dev.ps1` with Premiere closed. All **26/26** installed files match source SHA256, no extra files; evidence `artifacts/timeline-ignore-installed.json`. Native acceptance above ran via a separate copy of the same adapters/UI, not a live user Production. The auto-running test plugin is removed after testing. The install identity remains 0.1.0; no native helper, permission or background service added.

Real Production edits were not replayed, existing media is not backfilled automatically, and this fix does not authorize original fragmented media without the existing user decision. The runtime still protects uncertain/interrupted insertions from automatic retry. Second-editor locks, native Undo/crash recovery, representative audio/timecode layouts, large/network trees, long-running AUTO and other Premiere/OS builds remain separate acceptance work.
