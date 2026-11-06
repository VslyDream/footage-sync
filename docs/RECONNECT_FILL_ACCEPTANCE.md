# Project recovery, title names and Fill Frame — acceptance

2026-11-04 · Windows · Premiere Pro 2025 **25.6.2**. All mutations used generated fixture projects under `artifacts/`; production projects/media were not test targets. Main installation and native acceptance are separate checks.

## Approved behavior

[LOCKED] The user's November request adds periodic recovery of the saved import project, plain folder names for Type Tool clips, and automatic Fill Frame. The subsequent answer explicitly permits custom scaling **if compared with Premiere's native Fill Frame**. This supersedes the October manual-step decision. No native module, extra process, permission or compatibility change was introduced.

## Project recovery and Type Tool

[VALIDATED — native host] `scripts/reconnect-title-spike.js` created a Footage/Selects pair. Closing the fixture source made its old Project wrapper throw `A nullptr was dereferenced.` on `guid`. A scan while closed reported the selected project unavailable; opening that same source and running the background scan restored its path/GUID, zero changes, `error: null`, completed status, without selecting the import target again. A deliberately throwing previous wrapper also recovered to the real two-clip native inventory.

The controller compares cached primitive path/GUID with a freshly resolved wrapper. Each stale view/active wrapper is skipped independently; unrelated errors still propagate. Regular 5-second polling supplies retries outside running Sync/modal flows. Projects are never automatically closed/opened and another active project is never substituted. An identity change invalidates the previous analysis.

[VALIDATED — native host] A new Type Tool clip was named `2026-11-04-Developer`, span 2–4 s. After setting the fixture's name to the legacy `Footage Sync date 2026-11-04`, a late same-date import extended the same title to 2–6 s and renamed it to the plain folder name. Its date text remains unchanged. Existing arbitrary user titles are not mass-renamed.

Evidence: [native recovery/title result](../artifacts/reconnect-title-host-test/run1/result.json). The explicit source-close stress test also showed a native reference/deletion prompt and Player 62 toast; deletion was declined. That path is not used by runtime recovery. Rendering acceptance uses separate projects opened from a clean Premiere session.

## Fill Frame comparison

[VALIDATED — actual native command] The reference timeline contains identical media/timing and the same V2 Type Tool. Each reference footage Scale started at 47%, then **Fill frame** was selected from Premiere's clip context menu. Values were read back from Motion. The final implementation was exercised by a fresh complete Controller import into another generated project, rather than assigning expected values to the tested timeline.

| Source | Native / final automatic Scale | Motion values | PNG pixels |
|---|---:|---|---|
| 600×900 portrait | 320 | 11/11 exact | identical |
| 1280×720 HD | 150 | 11/11 exact | identical |
| 3840×2160 4K | 50 | 11/11 exact | identical |
| 800×800 square | 240.00001525878906 | 11/11 exact | identical |
| 2048×512 wide | 210.9375 | 11/11 exact | identical |
| 720×576, interpreted PAR 128/117 | 243.65481567382812 | 11/11 exact | identical |
| 1080×1920 vertical | 177.7777862548828 | 11/11 exact | identical |

The target was 1920×1080, PAR 1:1, 30 fps. For each case, Premiere exported one 1920×1080 PNG from the native reference and one from the final automatic timeline at the same source-relative time. All seven pairs have **0 changed pixels, maximum channel difference 0, and matching file SHA256**. Frames are non-flat and include the rendered Type Tool. The anamorphic output was visually inspected as well.

[VALIDATED — local implementation finding] Native Fill updates both Motion scale channels with Uniform Scale enabled. It uses rounded square-pixel widths and float32 ratio/percent arithmetic. Omitting either detail produced measurable mismatches during the spike; both were corrected before final acceptance. Source PAR comes from Premiere's interpreted footage, not the container's nominal SAR. This algorithm is an experimentally validated implementation detail, not a documented Adobe guarantee.

The host adapter finds Motion by match name, constructs documented ComponentParam actions inside locked transactions and verifies both scale values. Animated/non-uniform scale controls are rejected. Scaling applies only to the newly inserted V1 item. Titles, audio and prior edits are preserved.

Final end-to-end batch: **7 new footage clips + seed on V1, 8 A1 clips, 1 native Type Tool named `2026-11-04-Fill`, 7 receipts, repeat zero**. Both fixture projects saved successfully.

Evidence:

- [Final native import and Motion readback](../artifacts/fill-compare-host-test/final/result.json).
- [Pixel comparison and all pair hashes](../artifacts/fill-compare-host-test/final/pixel-comparison.json).
- [Native timeline screenshot](../artifacts/fill-compare-host-test/final/native-timeline.png).
- [Example automatic PNG](../artifacts/fill-compare-host-test/final/frames/auto-5.png.png) and [native reference PNG](../artifacts/fill-compare-host-test/run3/frames/native-5.png.png).
- Reproducers: `scripts/fill-compare-spike.js`, `scripts/fill-compare-resume-spike.js`, `scripts/fill-final-spike.js`. The first pass preserved its pre-correction mismatch in `run3/result.json`; the shipping-code result is `final/result.json`.

## Checks and installation

[VALIDATED] **146 automated tests pass**, 24 runtime JavaScript modules and manifest validate, `git diff --check` passes. New checks cover stale wrapper recovery, healthy project lookup despite another stale view, genuine lookup errors, target/dimension/PAR validation, native scale rounding and verification of both Motion channels. These supplement the native checks above.

[VALIDATED — installation] `scripts/install-dev.ps1` installed the final runtime with Premiere closed. **28/28 installed file SHA256 match source; no extras**: [installation report](../artifacts/reconnect-fill-installed.json). The temporary auto-running filesystem probe was removed with Premiere closed after testing. Other plugins were not installer/removal targets. Version/identity remains 0.1.0; release archives were not republished.

## Remaining scope

[SPIKE] Native comparison covers the seven formats above with unchanged imported Motion, default media scaling None, a landscape square-pixel target and the local 25.6.2 host. Rotation metadata, altered/default Scale-to-Frame preference, other target frame/PAR combinations, other Premiere builds/macOS, second-editor Production locks, native sequence Undo/interruption, complex audio/timecode and long-running/network operation require separate acceptance. Pure geometry tests cover vertical targets and target PAR but do not replace those native cases. Existing sequence interruption/receipt protections remain in effect.

Primary API references: [ProjectUtils](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/projectutils/), [ComponentParam](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/componentparam/), [FootageInterpretation](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/footageinterpretation/), [Exporter](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/exporter/), [official types](https://github.com/adobe/premierepro-types/blob/main/src/premierepro.d.ts). No direct native Fill/execute-command entry was found in that reviewed UXP surface; this is not a claim of universal impossibility.
