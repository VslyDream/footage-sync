# Import targets, sequence dates and filesystem fixes

Previous acceptance baseline: 2026-10-27. Windows, Premiere Pro **25.6.2**, local development External installation. Public v0.1 release assets have not been replaced. Current behavior and the 2026-10-28 checks supersede the strict missing-date rule and target card below: [sequence refinement acceptance](SEQUENCE_REFINEMENT_ACCEPTANCE.md).

## Accepted behavior

User decisions are recorded in SPEC §19: separate remembered import project and sequence target, dates from folder names, prefer one native title per date with a verified reuse path. Active tab changes do not redirect imports. The selected saved projects must remain open.

New video goes to the end of V1 with source audio starting at A1. Native editable Type Tool dates occupy V2. An adjacent same-date managed block is extended; a disjoint block or a title that cannot be identified reliably receives a new title. Existing edits are preserved. The implementation accepts `YYYY-MM-DD` in the folder or its ancestors, including a suffix such as `2026-10-27-Developer`. The user confirmed on 2026-10-27 that their folders use `YYYY-MM-DD`; no format extension is needed.

## Automated verification

117 tests passed; 21 runtime JavaScript modules and the manifest passed validation. Coverage includes literal `#`, `%`, Cyrillic and `%23` paths; filesystem cycle/depth protection; Browse suspension and restoration on selection/cancel/failure; pinned project behavior; full source ranges; generated native project integrity; date ordering/validation; deferred appends, interrupted attempts, Undo/missing receipts and a completed receipt left behind by an interrupted sidecar checkpoint.

Tests use ignored workspace TEMP/TMP fixtures. Fake-host recovery coverage does not establish native Undo atomicity or simulated process-crash recovery.

## Native Premiere evidence

All fixtures below are generated test media/projects under ignored `artifacts/`. Existing working projects and footage were not edited for these checks.

| Check | Observed result | Local evidence |
|---|---|---|
| Reported repeating `#5.mp4` scan | Raw UXP path returns the parent directory; encoded literal file URL returns the real file. Fixed scan terminates, 12 ms on the small fixture. | `artifacts/filesystem-host-test/baseline-result.json`, `probe-result.json` |
| Two separate open projects, Selects active | Media imported into pinned Footage; target sequence receives full video, stereo A1 audio and native V2 dates. | `artifacts/sequence-host-test/runtime-sequence-result.json` |
| Same-date late packet | Third date-27 clip extends the same title from 2–6 s to 2–8 s. | Same result file, `late` |
| New date, then old date after it | Date 28 has its own block; a later date-27 clip creates a separate title without stretching across date 28. | Same result file, `next`, `final` |
| Save, cold restart and reopen | Target settings/receipts survive. Six V1 clips, three titles, one sequence and zero repeat changes before the next fixture mutation. Temporary title source sequences are absent. | `artifacts/sequence-host-test/reopen-result.json` |
| Renamed title fallback | Renaming the last managed title makes it unavailable for reliable reuse; the next same-date clip receives a fresh native title. Repeat scan returns zero changes. | Same reopen result |
| Native editable text | Saved-project inspection decodes the expected native Type Tool strings. Program monitor shows the complete date within frame. | `artifacts/sequence-host-test/native-date.png` |
| Browse in Edit existing link | OS picker opens after plugin dialogs close. Cancel and repeat selection restore the form, Project root and both flags. Analyze receives the retained draft. | `artifacts/sequence-host-test/browse.png`, `browse-draft-result.json` |
| Real Production | Native UI opens isolated `FS_Production` with two fixture members. While Selects is active, import goes to Footage and new footage/date 30 append at 14–16 s in Selects. Both fixture saves succeed; repeat is empty. Native Production panel shows both members owned by the local editor. | `artifacts/production-host-test/result.json`, `production-native-date.png`, `timeline.png` |
| New target controls | Links renders explicit import and sequence choices in Premiere. | `docs/ui/links-targets.png` |
| Installed main plugin cold start | After removing the test probe, the main plugin opens Links with no import target selected and zero links. No test target is adopted implicitly; the explanation and both chooser controls render. | `artifacts/main-installed-startup.png` |

The test Production settings were reset to native defaults through Premiere after the prepared fixture settings were rejected. This was a fixture preparation issue before the controller run; the resulting native Production was used for the accepted test.

## Installation and remaining checks

The final source is installed with `scripts/install-dev.ps1` while Premiere is closed and checked file-for-file by SHA256. Installation evidence is `artifacts/new-version-installed.json`; it is separate from the native acceptance above. The temporary auto-running filesystem/sequence probe is removed after testing. No new shipping runtime, helper, permission or background service is introduced.

Still open: another editor's Production locks/read-only members; native Undo and forced termination during a sequence append; varied source channel layouts/frame rates and mixed timebases; long-running AUTO with the new timeline destination; large/network/Lucid scans; macOS and other Premiere versions. The plugin does not bypass locks or autosave user projects. Existing helper, shared-profile adoption and source-marker XMP/Undo limitations remain as documented in STATE.md.

Next acceptance should use a copy of a representative project with the user's real folder conventions and audio layouts, then the second-editor lock matrix. New release packaging/publication is a separate action.
