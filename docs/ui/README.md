# UI golden images

This directory stores the visual references listed in [`../UI_SPEC.md`](../UI_SPEC.md).

## Current target — `redesign-2026-11/`

The UI redesign approved by the user on 2026-11-06. Each screen has two files with the same name:

- `*.png` — golden composition and density (headless Chrome, 1×);
- `*.html` — the static markup/CSS the PNG was rendered from. Open it in a browser to read exact copy, structure and style values. No runtime or network is needed. It is a design artifact, not production code.

Content is mock data. `UI_SPEC.md` lists which screen each image covers. Every screen of the redesign has an image; only the Add markers TXT/clip chooser, project/sequence pickers and generic error details remain text-defined.

## Previous references

Files directly in this directory describe the pre-redesign UI and are no longer the target layout:

- 2026-10-02 user-supplied screenshots: [Main Panel](main-panel.png), [Links](links.png), [Settings](settings.png), [Status](status.png);
- FUT-002 runtime captures of the current panel: [vertical](main-panel-vertical.jpg), [horizontal](main-panel-horizontal.jpg), [compact docked](main-panel-docked.jpg);
- implementation captures: [compact targets](links-targets-compact.png), [previous targets card](links-targets.png), [Settings ignore entry](settings-ignore.png), [ignore list](ignored-paths.png), [ignore scope](ignore-path.png);
- [workflow-refresh.html](workflow-refresh.html) — browser fixture of the current runtime UI.

They stay as history and as a picture of the current implementation until the redesign ships.

The `reference/` subdirectory contains the original Watchtower examples. Those files are visual inspiration only and are not Footage Sync golden screens.
