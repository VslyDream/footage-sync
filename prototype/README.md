# Footage Sync UI Prototype

Interactive visual prototype for the Footage Sync Adobe Premiere Pro plugin.

The prototype covers the approved screen-level flows:

- minimal Main Panel with Links, Sync and Status actions;
- direct Sync without confirmation when no blocking items are present;
- one shared Links / Settings window and a separate Status window;
- linking an existing Premiere bin;
- creating matching bins from a filesystem tree;
- Links Manager with Relative path and Subfolders flags;
- Initial Sync;
- Review Changes;
- Settings;
- error, conflict and unavailable-folder handling.

Controls update mock browser state only. The prototype does not read media, modify Premiere projects, or implement synchronization.

## Local commands

- `npm run dev` — local interactive preview
- `npm run build` — production build
- `npm test` — build and verify the server-rendered prototype
- `npm run lint` — static checks
