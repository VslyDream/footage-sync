# Sequence import refinement — 2026-10-28

Acceptance baseline before the timeline-dependency/Ignore refinement, Windows / Premiere 25.6.2. Product changes were requested by the user on 2026-10-28. [Current acceptance](TIMELINE_IGNORE_ACCEPTANCE.md) extends these checks. Public release assets have not been replaced.

## Behavior and root cause

The old controller checked every new video inside one try/catch. An undated file caused all video imports in the batch to receive its date error, including valid `2026-10-15` / `2026-10-16` paths. Labels are now resolved per file. A missing, invalid or conflicting calendar date uses the literal immediate folder name as native Type Tool text and produces informational feedback. Source-file safety errors and MP4 decisions remain enforced.

The saved `To sequence` checkbox pauses appending without clearing the remembered destination. New media imported while off is not backfilled on re-enable. Existing pending sequence intents are paused. Existing profiles with a selected sequence retain their enabled behavior during migration.

Review's `Import files only` imports selected media/bin/marker changes, skipping sequence appends for that batch without changing the persistent switch or destination. Skipped entries are recorded locally and do not replay when the sequence is reopened. A runtime sequence failure leaves a durable Review item while other media imports can complete. It does not trigger automatic retries after a potentially partial mutation.

Links uses a compact toolbar and two footer rows for targets, with small Change controls and the sequence checkbox. Paths/errors are available in tooltips; missing/unavailable targets are red. The large target card and default-flags footer hint are removed. [Native capture](ui/links-targets-compact.png).

## Verification

125 automated tests passed. 21 runtime modules and the manifest pass syntax checks. Regression coverage includes the supplied date paths mixed with an undated file, folder fallback, variable-length UTF-8 native text and XML escaping, switch persistence, files-only import with an unavailable target, deferred/failed append recovery, the compact footer and Review confirmation.

Native Controller acceptance used only generated fixtures in `artifacts/sequence-refinement-host-test/`:

| Case | Observed result |
|---|---|
| Mixed folder labels | Four videos append after the seed; V2 has two ISO dates plus `Developer Footage` and `Съёмка & тест`. No blocking date error. |
| Native text persistence | Both fixture projects save successfully. Saved-project inspection decodes all four strings as native Type Tool, LucidaConsole. Program monitor renders Latin and Cyrillic folder names. |
| Checkbox off | Fifth source video imports into Footage; target remains five V1 clips including seed. Target selection is retained. |
| Re-enable | Zero changes; the off-period video is not appended retrospectively. |
| Missing sequence target | New media remains safe/selectable; only its sequence action needs a decision. Files-only import produces the sixth source clip, an empty append queue and a saved skipped key. |
| Restore destination | Zero changes; skipped footage is not replayed. |
| Real UXP checkbox | Clicking the compact footer checkbox saves `sequenceEnabled:false` and keeps the selected Footage sequence. |

Evidence: `result.json`, `native-checkbox.json`, `folder-title.png`, `cyrillic-title.png` in that fixture directory. The isolated auto-running probe is removed after acceptance. Installation of the main plugin is checked separately, file-for-file by SHA256: `artifacts/sequence-refinement-installed.json`.

The independent saved-project reader rejected the unsaved generated XML's empty-element formatting before inspecting text. The native-saved fixture passed inspection; the generated UTF-8 text payload was also independently decoded before host import. No malformed text was accepted as successful based on a JSON plan alone.

## Native Fill Frame — approved manual step

The user requires Premiere's built-in Fill Frame and explicitly does not want an independent scale calculation. Adobe's [official UXP type declarations](https://github.com/adobe/premierepro-types/blob/main/src/premierepro.d.ts) expose neither Fill Frame nor a general native menu-command runner. [Application](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/application) has no documented command method; the documented [ClipProjectItem Scale to Frame Size action](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/clipprojectitem) is a different operation. Adobe's [Properties panel help](https://helpx.adobe.com/premiere/desktop/edit-projects/intro-to-editing/edit-video-using-the-properties-panel.html) describes the native Fill Frame operation.

On local 25.6.2, direct probes of root/Application/Utils/VideoClipTrackItem return undefined for `executeCommand`, `findMenuCommandId`, `fillFrame`, `createFillFrameAction` and `createSetFillFrameAction` (`result.json → commandProbe`). This supports the limitation of the checked API surface, not a claim that every undocumented route is impossible. No substitute scaling code or additional runtime has been added.

[LOCKED — user decision 2026-10-28] Use Premiere's built-in Fill Frame manually after import for the current version. Automatic invocation is deferred; no additional module or independent scaling is part of this version. This item no longer blocks current acceptance. Remaining acceptance includes long-running AUTO, network storage, Production locks, other Premiere builds/macOS, and native sequence Undo/crash behavior.
