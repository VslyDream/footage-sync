# UI golden images

This directory stores the approved PNG references listed in [`../UI_SPEC.md`](../UI_SPEC.md).

Four user-supplied screenshots were saved unchanged on 2026-10-02:

- [Main Panel](main-panel.png)
- [Links](links.png)
- [Settings](settings.png)
- [Status](status.png)

Links, Settings and Status retain their golden-reference role, subject to textual extensions in `UI_SPEC.md`. Main Panel is a preserved previous-design reference: FUT-002 was approved on 2026-10-06 and supersedes its header, labels and layout. Supplemental Premiere 25.6.2 implementation captures: [vertical](main-panel-vertical.jpg), [horizontal](main-panel-horizontal.jpg), [compact docked](main-panel-docked.jpg). These capture the default state and native chrome; they are not a new user-approved golden screenshot. Remaining state/keyboard/DPI checks are recorded in [acceptance](../../artifacts/panel-host-test/ACCEPTANCE.md). Other modals and state variants are described in `UI_SPEC.md`; they have no separate golden PNG.

Read the prototype-content caveats in `UI_SPEC.md` before implementing Settings or Status. Mock counts and stale helper copy do not override `SPEC.md`.

The `reference/` subdirectory contains the original Watchtower examples. Those files are visual inspiration only and are not Footage Sync golden screens.
