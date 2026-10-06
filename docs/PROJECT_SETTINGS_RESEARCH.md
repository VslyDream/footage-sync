# Project-contained sync suggestions — 2026-10-06

## Current storage

[VALIDATED — implementation] `plugin/host/store.js` reads and atomically replaces `<project>.prproj.footage-sync.json` next to the saved project. It contains links (bin IDs/paths, folder paths, relative/subfolder flags and pause), settings, reconciliation records, marker selections/observations and history. Opening that project loads these settings as active; there is no per-editor adoption step. This sidecar is therefore unsuitable as optional collaboration suggestions without changing the behavior.

Marker import receipts already use private **project metadata** on source clips (`plugin/host/marker-state.js`), rather than source-file XMP. Saved/reopened host fixtures from the previous validation contain the custom schema and receipt payload inside the gzip-compressed `.prproj`; a read-only inspection on 2026-10-06 confirmed both. The inspection did not rewrite project files.

## Can settings be inside .prproj?

[VALIDATED — documentation] Adobe's [Metadata API](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/metadata) provides `getProjectMetadata`, `addPropertyToProjectMetadataSchema` and `createSetProjectMetadataAction(ProjectItem, metadata, updatedFields)` since 25.6. Adobe confirms [project clip data resides only inside the project file](https://helpx.adobe.com/premiere/desktop/organize-media/edit-metadata/view-clip-data-in-the-metadata-panel.html). Existing local marker receipts demonstrate persistence for **clip** metadata.

Conclusion: storing a versioned JSON payload inside the project is technically supported for a Project Item. It does not require an extra Production file. There is no documented generic `Project.setPluginSettings` API in the checked Project reference; use metadata APIs rather than editing compressed project XML.

[SPIKE] The appropriate invisible anchor is not fully validated: test the cast root ProjectItem first, then a linked existing bin. Verify write/read, ordinary Save, close/reopen, Undo, a second editor without the custom schema preinstalled, and a locked/read-only Production project. A clip anchor works in the previous receipts but is fragile when clips are removed; creating a dummy clip/bin just for settings would clutter the project and needs a product decision. Do not infer root/bin acceptance merely from the `ProjectItem` parameter type.

## Proposed collaboration behavior

[LOCKED — requested direction] Saved mappings should be offered to colleagues, never imposed; avoid extra files in the Production.

[OPEN — proposal, not yet implemented]

1. Store only a versioned shared suggestion profile in project metadata: mapping IDs, bin IDs/path fallback, folder paths, relative/subfolder flags and optional preferred global settings. Do not share runtime history, filesystem identity caches, marker observations or local machine tokens.
2. Keep each editor's adopted configuration and operation checkpoints in the plugin's local data directory, keyed by project GUID. Existing sidecars need an explicit migration path; preserve them until migration is accepted and verified.
3. Offer the saved profile through Links with review of bin/path availability. Apply only after explicit adoption and existing Initial Sync preview. Do not turn on AUTO or start imports because a colleague saved a profile.
4. Local settings take priority. A changed shared revision appears as an optional update. Dismissal/adoption is local; it should not dirty the shared project.
5. Prefer already-approved relative paths for portable mappings; allow the editor to remap unavailable absolute paths. Different Windows drive letters/UNC mounts must be reviewed, not guessed.
6. Publishing the shared profile changes the project and is committed by ordinary Premiere Save. Read-only collaborators can read and adopt locally; publishing requires write access. Never write the .prproj directly or bypass Production locks.

[VALIDATED — documentation] Adobe [Production project locking](https://helpx.adobe.com/ca/premiere/desktop/organize-media/create-projects/project-locking-with-multiple-open-projects.html) protects another editor's changes. A UXP `lockedAccess` transaction is a synchronous API lock and must not be treated as proof of Production write ownership.

The v0.1 release preserves sidecar storage. Shared suggestions, local migration and new Links controls need the anchor/lock spike and approval of the proposal before implementation. No automatic takeover is added.

