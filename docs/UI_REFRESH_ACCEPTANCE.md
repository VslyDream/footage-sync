# Workflow refresh — acceptance and technical findings

User decisions: 2026-10-15. Contracts: SPEC §7/§10/§15.8/§16; UI_SPEC §9.

## Verified in source tests

- Collapsed bin picker hides descendants; every ancestor must be expanded. Disclosure and selection are separate keyboard-activatable actions. Root is an explicit choice.
- Root-link preview proposes root-level media and child bins without an empty bin. Repeat reconciliation produces no duplicate imports. A blank, unselected bin is invalid.
- TXT picker runs before clip selection. A unique best name match is suggested; ties require selection; the user can override the suggestion. Cancelling either step saves no assignment. No marker mutations occur during selection.
- Status opens while the import promise remains pending, identifies the current file/stage, displays elapsed/waiting time and current warnings, updates to failure, and restores actions. Clicking busy Sync routes to details. Dialog/picker lifetime keeps background polling paused during marker selection.
- Fresh duplicate guard and actual post-import inventory verification remain. The verified result feeds the checkpoint, removing two redundant full project walks per imported file. Successful API return without the expected clip still fails verification.
- Completed unchanged TXT skips native marker enumeration. Fresh project receipt/timing checks remain; Undo and changed TXT still take the marker snapshot required for Review.
- First scan uses settings loaded from the active project. Initial Sync drafts do not replace the live batch or persist before confirmation.

These are synthetic host/UI tests, not a native Premiere rendering or performance result.

## API research

[VALIDATED — official documentation, checked 2026-10-15] Adobe documents [Project.getRootItem and importFiles](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/project) on baseline 25.6; import supports the root/target bin. [FolderItem.getItems](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/folderitem) returns child Project Items. This implementation retains the previously host-validated APIs; no new UXP permission, external process or dependency is added.

[VALIDATED — code inspection and tests] Old import path made four full walks per file: controller before mutation, import duplicate guard, import result verification, controller checkpoint. Current path retains the latter two authoritative checks and shares the verified inventory. Fixed preflight/final reconciliation walks remain. Two walks per file can still be expensive in a large project; real host timings are needed before attributing the reported delay to this alone.

## Review fixture

[Standalone visual/interaction reference](ui/workflow-refresh.html): actual UI source with simulated Premiere inventory, TXT picker and Spectrum widgets. Buttons open the bin tree, existing-bin form, marker target chooser and running Status. It cannot import media, read user folders or modify a Premiere project. It is an implementation reference, not a new golden screenshot or user approval.

Regenerate with `node scripts/preview-ui.js --write docs/ui/workflow-refresh.html`, or serve the current source using `node scripts/preview-ui.js` at `http://127.0.0.1:4318`. Stop the server with Ctrl+C. Browser automation could not reach the local preview in this session; visual rendering remains unverified. The preview server was stopped.

## Native host checks still required

Current source was installed on 2026-10-15 using the existing development installer while Premiere was closed. All 20/20 installed runtime files match source SHA256, with no extra files (`artifacts/workflow-refresh-installed.json`). Release assets were not changed. Native launch/rendering/performance acceptance is still pending; use a copy of a saved project and disposable media for the checks below.

1. Open Choose Premiere bin with at least three nested levels. Expand/collapse by mouse and keyboard; select a parent and a child independently. Check long paths and duplicate bin names.
2. Choose Project root in Link existing bin. Initial Sync must precede every mutation. Import media from the folder root and a subfolder; repeat Sync; verify IDs/counts and no extra containing bin. Reopen/edit the root link and cancel an unconfirmed new link.
3. Add markers from Status for existing media with automatic matching, no match, duplicate names and an overridden suggestion. Cancel the TXT picker and clip chooser. Repeat from Initial Sync and Review. Check source-only markers and existing Replace/Append/Skip safeguards.
4. During scan/import click the working circle and Status. Confirm immediate details, stage/path/counters, warnings and elapsed time; second Sync stays guarded. Close/reopen Status while work continues. Confirm the spinner stops after completion/failure and progress controls remain usable while updates arrive.
5. Exercise a bad TXT, unavailable folder and rejected media import. Verify the precise warning/error/current path survives completion and quiet polling. Check that source media, existing items and bins remain intact.
6. Measure a small folder in a large existing project: inventory stage, filesystem/MP4 inspection, importFiles wait, verification/checkpoint and marker analysis. Compare total time, CPU/UI response and idle polling; do not treat synthetic call-count savings as a measured host speedup.

Previously documented XMP preference, Undo, helper/remux, Productions and macOS acceptance gaps remain in STATE.md.
