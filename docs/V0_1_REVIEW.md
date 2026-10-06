# v0.1 file decisions — 2026-10-06

This is an audit of the existing behavior, not a change to the product contract.

## Verified decision matrix

| Scenario | Current result | Evidence |
| --- | --- | --- |
| Ask before fixing; fragmented MP4 + safe media | Whole batch waits for Review; no mutation before confirmation | Controller regression tests; previous Premiere 25.6.2 fixture acceptance |
| Later closes Review | No batch is applied; files remain pending | Review UI regression test |
| MP4 deferred; safe file selected | Only safe selection imports; MP4 returns on next scan | Controller regression test; previous real host selected-WAV acceptance |
| Import original + Sync selected | Explicitly reviewed MP4 imports as original; repeat reuses it | Controller regression test |
| Don't fix | Fragmented original can import without a repair decision | Controller regression test |
| Fix automatically | Fragmented MP4 still blocks the whole batch because helper is absent | Controller regression test; implementation inspection |
| Ignore / Repackage supplied to controller | Rejected before any batch mutation; neither decision is implemented | Controller regression test |
| Source/project changes after Review | Confirmation invalidated before mutation | Controller regression tests |
| MP4 replaced at same path, same size/mtime | Container classification recomputed using identity | New scanner regression test; fixed in v0.1 |
| Reliable identity unavailable | MP4 headers are checked again rather than reusing their classification | New scanner regression test |
| Truncated MP4 | Held for retry; not imported as a healthy file | Header detector regression test |

**Later is deferral, not persistent Ignore.** There is no ignored-file ledger. Marker `Skip TXT` is a separate, implemented source-marker decision; it does not ignore video.

## Repair feasibility

[VALIDATED — documentation] Premiere 25.6's [external-process recipe](https://developer.adobe.com/premiere-pro/uxp/resources/recipes/external-process/) documents user consent and no command parameters/output capture via `shell.openPath`. This is insufficient evidence for the locked invisible bundled helper workflow. There is no hidden-helper implementation in this build.

[VALIDATED — documentation] [Premiere Hybrid plugins](https://developer.adobe.com/premiere-pro/uxp/plugins/hybrid-plugins/) require Premiere 26.2 and manifest v6; switching to that mechanism changes the supported baseline and installation permissions.

[OPEN — product decision before implementation] Viable directions:

1. Keep 25.6 and perform an isolated helper/IPC launch spike. Job files may supply parameters, but consent, invisible launch and cleanup must be verified; no assumption of support.
2. Approve a 26.2+ Hybrid implementation for native process control, accepting changed compatibility and installation permissions.
3. Keep this v0.1 preview without repair and finish the helper in a subsequent version.

For a persistent Ignore action, decide whether it ignores the current file revision (changes require review again) or the path indefinitely, and where the user restores an ignored item. Neither policy is silently added to SPEC.

## Verification limits

Current tests exercise controller policy and the scanner's UXP filesystem interface with Node adapters. Tiny generated MP4 box fixtures verify detection, not video decoding or remuxing. Existing real Premiere evidence is retained locally in `artifacts/` and is excluded from GitHub because it contains projects and machine paths. No new native Premiere session, helper job or two-editor Production session was run for this audit.

