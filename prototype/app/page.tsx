"use client";

import { useMemo, useState } from "react";

type MainState = "uptodate" | "pending" | "offline" | "conflict";
type ModalKind =
  | null
  | "links"
  | "settings"
  | "status"
  | "add-link"
  | "existing-bin"
  | "folder-tree"
  | "initial-sync"
  | "review"
  | "conflict";

type LinkRow = {
  id: number;
  bin: string;
  folder: string;
  relative: boolean;
  subfolders: boolean;
  paused: boolean;
};

const initialLinks: LinkRow[] = [
  {
    id: 1,
    bin: "Footage / 01_VIDEO",
    folder: "L:\\Timber Truck\\02_Assets\\01_VIDEO",
    relative: false,
    subfolders: true,
    paused: false,
  },
  {
    id: 2,
    bin: "Footage / 02_AUDIO",
    folder: ".\\02_Assets\\02_AUDIO",
    relative: true,
    subfolders: true,
    paused: false,
  },
  {
    id: 3,
    bin: "Footage / 03_GFX",
    folder: "L:\\Timber Truck\\02_Assets\\03_GFX",
    relative: false,
    subfolders: false,
    paused: true,
  },
];

const folders = [
  { id: "video", label: "01_VIDEO", depth: 2, checked: true },
  { id: "announce", label: "2026-07-22-Announce", depth: 3, checked: true },
  { id: "interviews", label: "Interviews", depth: 3, checked: false },
  { id: "audio", label: "02_AUDIO", depth: 2, checked: true },
  { id: "music", label: "Music", depth: 3, checked: true },
  { id: "sfx", label: "Sound Effects", depth: 3, checked: true },
  { id: "gfx", label: "03_GFX", depth: 2, checked: false },
];

const changes = [
  { icon: "+", tone: "blue", title: "14 new files", meta: "01_VIDEO / 2026-08-07-Interview" },
  { icon: "+", tone: "blue", title: "2 new folders", meta: "Bins will be created" },
  { icon: "↪", tone: "purple", title: "1 renamed file", meta: "A002_old.mp4 → A002.mp4" },
  { icon: "!", tone: "amber", title: "2 fragmented MP4 files", meta: "Confirmation required before import" },
];

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="toggle-row">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`switch ${checked ? "is-on" : ""}`}
        onClick={onChange}
      >
        <span />
      </button>
      <span>{label}</span>
    </label>
  );
}

function Check({ checked, onChange, label, compact = false }: { checked: boolean; onChange: () => void; label: string; compact?: boolean }) {
  return (
    <label className={`check-row ${compact ? "compact" : ""}`}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="custom-check" aria-hidden="true">{checked ? "✓" : ""}</span>
      {label && <span>{label}</span>}
    </label>
  );
}

function Radio({ checked, onChange, title, description }: { checked: boolean; onChange: () => void; title: string; description: string }) {
  return (
    <label className={`radio-card ${checked ? "selected" : ""}`}>
      <input type="radio" checked={checked} onChange={onChange} />
      <span className="custom-radio" />
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </label>
  );
}

function PanelHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <div className="panel-header">
      {onBack ? <button className="icon-button" onClick={onBack} aria-label="Back">‹</button> : <span className="brand-mark">FS</span>}
      <h2>{title}</h2>
      <button className="icon-button dots" aria-label="Panel menu">•••</button>
    </div>
  );
}

function WorkspaceHeader({ active, onNavigate, onClose }: { active: "links" | "settings"; onNavigate: (target: "links" | "settings") => void; onClose: () => void }) {
  return (
    <div className="workspace-window-header">
      <span className="brand-mark">FS</span>
      <strong>Footage Sync</strong>
      <nav aria-label="Footage Sync sections">
        <button className={active === "links" ? "active" : ""} onClick={() => onNavigate("links")}>Links</button>
        <button className={active === "settings" ? "active" : ""} onClick={() => onNavigate("settings")}>Settings</button>
      </nav>
      <button className="window-close" onClick={onClose} aria-label="Close">×</button>
    </div>
  );
}

export default function Home() {
  const [modal, setModal] = useState<ModalKind>(null);
  const [mainState, setMainState] = useState<MainState>("pending");
  const [links, setLinks] = useState<LinkRow[]>(initialLinks);
  const [selectedFolders, setSelectedFolders] = useState<Record<string, boolean>>(
    Object.fromEntries(folders.map((folder) => [folder.id, folder.checked])),
  );
  const [syncMode, setSyncMode] = useState("ask");
  const [mp4Mode, setMp4Mode] = useState("ask");
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [binPath, setBinPath] = useState("Footage / 04_STILLS");
  const [folderPath, setFolderPath] = useState("L:\\Timber Truck\\02_Assets\\04_STILLS");

  const selectedFolderCount = useMemo(
    () => Object.values(selectedFolders).filter(Boolean).length,
    [selectedFolders],
  );

  function openScreen(id: string) {
    setNotice(null);
    if (id === "main") {
      setMainState("pending");
      setModal(null);
    } else if (id === "existing-bin" || id === "folder-tree" || id === "initial-sync" || id === "review" || id === "conflict" || id === "links" || id === "settings" || id === "status") {
      setModal(id);
    } else if (id === "errors") {
      setMainState("offline");
      setModal("status");
    }
  }

  function runSync(message = "All selected changes were synced", destination: ModalKind = null) {
    setSyncing(true);
    window.setTimeout(() => {
      setSyncing(false);
      setMainState("uptodate");
      setModal(destination);
      setNotice(message);
    }, 700);
  }

  function updateLink(id: number, patch: Partial<LinkRow>) {
    setLinks((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addLinkAndSync() {
    const nextId = Math.max(...links.map((link) => link.id)) + 1;
    setLinks((rows) => [
      ...rows,
      {
        id: nextId,
        bin: binPath,
        folder: folderPath,
        relative: false,
        subfolders: true,
        paused: false,
      },
    ]);
    runSync("Link created and initial sync completed", "status");
  }

  return (
    <main className="prototype-shell">
      <aside className="prototype-nav">
        <div className="prototype-brand">
          <span className="prototype-logo">FS</span>
          <span><strong>Footage Sync</strong><small>UI prototype · v1</small></span>
        </div>

        <p className="nav-label">Screens</p>
        <nav>
          {[
            ["main", "01", "Main panel"],
            ["links", "02", "Links window"],
            ["status", "03", "Status window"],
            ["existing-bin", "04", "Link existing bin"],
            ["folder-tree", "05", "Create matching bins"],
            ["initial-sync", "06", "Initial sync"],
            ["review", "07", "Review changes"],
          ].map(([id, number, label]) => (
            <button key={id} onClick={() => openScreen(id)}>
              <span>{number}</span>{label}
            </button>
          ))}
        </nav>

        <div className="prototype-note">
          <span className="live-dot" /> Interactive prototype
          <small>Controls update the mock state. No files or Premiere projects are changed.</small>
        </div>
      </aside>

      <section className="premiere-stage">
        <header className="premiere-titlebar">
          <span className="pr-icon">Pr</span>
          <span>Adobe Premiere Pro</span>
          <span className="project-name">Timber Truck — Editing</span>
          <div className="window-controls"><i>—</i><i>□</i><i>×</i></div>
        </header>
        <div className="premiere-menubar">File&nbsp;&nbsp; Edit&nbsp;&nbsp; Clip&nbsp;&nbsp; Sequence&nbsp;&nbsp; Markers&nbsp;&nbsp; Graphics&nbsp;&nbsp; Window&nbsp;&nbsp; Help</div>
        <div className="workspace-tabs"><span>Assembly</span><span className="active">Editing</span><span>Color</span><span>Audio</span></div>

        <div className="workspace-body">
          <section className="plugin-panel">
            <PanelHeader title="Footage Sync" />
            <div className="main-action-grid">
              <button onClick={() => setModal("links")}>
                <span className="main-action-icon links-icon"><i /><i /></span>
                <strong>Links</strong>
              </button>
              <button
                disabled={syncing || mainState === "offline"}
                onClick={() => mainState === "conflict" ? setModal("review") : runSync("Sync completed — everything is up to date")}
              >
                <span className={`main-action-icon sync-icon ${syncing ? "is-syncing" : ""}`}>↻</span>
                <strong>{syncing ? "Syncing…" : "Sync"}</strong>
              </button>
              <button onClick={() => setModal("status")}>
                <span className={`main-action-icon status-eye ${mainState !== "uptodate" ? "attention" : ""}`}><i /></span>
                <strong>Status</strong>
                {mainState === "pending" && <b className="notification-dot">17</b>}
                {(mainState === "offline" || mainState === "conflict") && <b className="notification-dot warning">!</b>}
              </button>
            </div>
          </section>

          <section className="project-panel" aria-hidden="true">
            <div className="project-tabs"><span className="active">Project: Timber Truck</span><span>Media Browser</span><i>≡</i></div>
            <div className="project-toolbar"><span>⌕</span><span className="fake-search">Search</span><span>☷</span></div>
            <div className="project-columns"><span>Name</span><span>Media Start</span><span>Frame Rate</span></div>
            <div className="project-tree">
              <div><i>⌄</i><span className="bin" />Footage</div>
              <div className="indent"><i>⌄</i><span className="bin" />01_VIDEO</div>
              <div className="indent2"><i>›</i><span className="bin" />2026-07-22-Announce</div>
              <div className="indent"><i>›</i><span className="bin" />02_AUDIO</div>
              <div className="indent"><i>›</i><span className="bin" />03_GFX</div>
              <div><i>›</i><span className="bin" />Sequences</div>
            </div>
            <div className="project-empty"><span>Drag media here to import</span></div>
          </section>
        </div>

        {modal && (
          <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setModal(null); }}>
            <section className={`modal-window ${["folder-tree", "review", "links", "settings", "status"].includes(modal) ? "wide" : ""}`} role="dialog" aria-modal="true">
              {modal === "links" && (
                <>
                  <WorkspaceHeader active="links" onNavigate={setModal} onClose={() => setModal(null)} />
                  <div className="workspace-window-title">
                    <div><span className="eyebrow">Folder mappings</span><h2>Links</h2><p>{links.length} linked folders · Disk is the source of truth</p></div>
                    <button className="button primary" onClick={() => setModal("add-link")}>+ Add link</button>
                  </div>
                  <div className="links-table-wrap">
                    <label className="search-field links-search"><span>⌕</span><input aria-label="Search links" placeholder="Search bin or folder path" /></label>
                    <div className="links-table" role="table" aria-label="Linked folders">
                      <div className="links-table-head" role="row">
                        <span>Premiere bin</span><span>Relative</span><span>Subfolders</span><span>System folder</span><span>Status</span><span />
                      </div>
                      {links.map((link) => (
                        <div className={`links-table-row ${link.paused ? "paused" : ""}`} role="row" key={link.id}>
                          <button className="path-cell" onClick={() => { setBinPath(link.bin); setFolderPath(link.folder); setModal("existing-bin"); }}><span className="field-prefix">Pr</span><strong>{link.bin}</strong></button>
                          <Check checked={link.relative} onChange={() => updateLink(link.id, { relative: !link.relative })} label="" compact />
                          <Check checked={link.subfolders} onChange={() => updateLink(link.id, { subfolders: !link.subfolders })} label="" compact />
                          <button className="folder-path-cell" onClick={() => { setBinPath(link.bin); setFolderPath(link.folder); setModal("existing-bin"); }}>{link.folder}</button>
                          <span className={`status-pill ${link.paused ? "muted" : ""}`}>{link.paused ? "Paused" : "Active"}</span>
                          <button className="icon-button dots" aria-label={`Actions for ${link.bin}`} onClick={() => updateLink(link.id, { paused: !link.paused })}>•••</button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="modal-actions"><span className="action-hint">Relative path: Off by default · Subfolders: On by default</span><button className="button secondary" onClick={() => setModal(null)}>Close</button></div>
                </>
              )}

              {modal === "settings" && (
                <>
                  <WorkspaceHeader active="settings" onNavigate={setModal} onClose={() => setModal(null)} />
                  <div className="workspace-window-title compact-title"><div><span className="eyebrow">Project preferences</span><h2>Settings</h2><p>Global behavior for Footage Sync</p></div></div>
                  <div className="settings-window-content">
                    <section>
                      <div className="setting-title"><strong>Sync mode</strong><small>Global for this project</small></div>
                      <div className="radio-stack">
                        <Radio checked={syncMode === "auto"} onChange={() => setSyncMode("auto")} title="Auto" description="Apply safe changes automatically" />
                        <Radio checked={syncMode === "ask"} onChange={() => setSyncMode("ask")} title="Ask when needed" description="Sync safe batches directly; review blocking items" />
                        <Radio checked={syncMode === "manual"} onChange={() => setSyncMode("manual")} title="Manual" description="Only sync from the Status window" />
                      </div>
                    </section>
                    <section>
                      <div className="setting-title"><strong>Fragmented MP4</strong><small>Applied before import</small></div>
                      <div className="radio-stack">
                        <Radio checked={mp4Mode === "fix"} onChange={() => setMp4Mode("fix")} title="Fix automatically" description="Prepare media without asking" />
                        <Radio checked={mp4Mode === "ask"} onChange={() => setMp4Mode("ask")} title="Ask before fixing" description="Recommended default" />
                        <Radio checked={mp4Mode === "never"} onChange={() => setMp4Mode("never")} title="Don’t fix" description="Import original media only" />
                      </div>
                    </section>
                    <section className="settings-notifications">
                      <div className="setting-title"><strong>Notifications</strong><small>Auto mode stays quiet after success</small></div>
                      <Toggle checked={true} onChange={() => undefined} label="Show warnings and errors" />
                      <Toggle checked={false} onChange={() => undefined} label="Show successful syncs" />
                    </section>
                  </div>
                  <div className="modal-actions"><button className="button secondary" onClick={() => setModal(null)}>Cancel</button><button className="button primary" onClick={() => { setNotice("Settings saved"); setModal("status"); }}>Save settings</button></div>
                </>
              )}

              {modal === "status" && (
                <>
                  <div className="modal-title status-window-title"><div><small>Footage Sync</small><h2>Status</h2></div><button onClick={() => setModal(null)}>×</button></div>
                  <div className="status-window-content">
                    {notice && <div className="inline-notice success"><span>✓</span>{notice}<button onClick={() => setNotice(null)}>×</button></div>}
                    <div className={`status-overview ${mainState}`}>
                      <span className="status-icon">{mainState === "uptodate" ? "✓" : mainState === "pending" ? "17" : "!"}</span>
                      <div><span className="eyebrow">Current status</span><strong>{mainState === "uptodate" ? "Up to date" : mainState === "pending" ? "17 changes waiting" : mainState === "offline" ? "Folder unavailable" : "2 conflicts need review"}</strong><small>{mainState === "uptodate" ? "Last sync today at 13:14" : mainState === "pending" ? "Detected a few seconds ago" : mainState === "offline" ? "L:\\Timber Truck is not connected" : "Conflicting changes were not applied"}</small></div>
                      <div className="status-actions">
                        {(mainState === "pending" || mainState === "conflict") && <button className="button primary" onClick={() => setModal("review")}>Review changes</button>}
                        <button className="button secondary" disabled={syncing || mainState === "offline"} onClick={() => runSync("Scan completed — everything is up to date", "status")}>{syncing ? "Syncing…" : "Sync now"}</button>
                      </div>
                    </div>
                    <div className="status-metrics">
                      <button onClick={() => setModal("links")}><strong>{links.filter((link) => !link.paused).length}</strong><span>Active links</span></button>
                      <button onClick={() => setMainState("pending")}><strong>17</strong><span>Pending changes</span></button>
                      <button onClick={() => setMainState("conflict")}><strong>2</strong><span>Conflicts</span></button>
                    </div>
                    <div className="status-columns">
                      <section>
                        <div className="status-section-title"><strong>Sync history</strong><button className="text-button">View all</button></div>
                        <div className="history-list">
                          <div><span className="history-mark success">✓</span><p><strong>Sync completed</strong><small>Today, 13:14 · 8 files imported</small></p></div>
                          <div><span className="history-mark success">✓</span><p><strong>Folder structure updated</strong><small>Today, 12:48 · 2 bins created</small></p></div>
                          <div><span className="history-mark neutral">↪</span><p><strong>3 items reconciled</strong><small>Yesterday, 18:22 · No duplicates</small></p></div>
                        </div>
                      </section>
                      <section>
                        <div className="status-section-title"><strong>Needs attention</strong><span className="issue-count">2</span></div>
                        <button className="issue-card warning" onClick={() => { setMainState("offline"); setModal("conflict"); }}><span>!</span><p><strong>Folder unavailable</strong><small>L:\\Timber Truck</small></p><i>›</i></button>
                        <button className="issue-card" onClick={() => { setMainState("conflict"); setModal("review"); }}><span>!</span><p><strong>Rename conflict</strong><small>A002.mp4 · Decision required</small></p><i>›</i></button>
                      </section>
                    </div>
                  </div>
                  <div className="modal-actions"><span className="action-hint">No automatic deletes · Disk → Premiere</span><button className="button secondary" onClick={() => setModal(null)}>Close</button></div>
                </>
              )}

              {modal === "add-link" && (
                <>
                  <div className="modal-title"><div><small>New link</small><h2>How would you like to start?</h2></div><button onClick={() => setModal(null)}>×</button></div>
                  <div className="choice-grid">
                    <button className="choice-card" onClick={() => setModal("existing-bin")}><span className="choice-icon">Pr</span><strong>Link an existing bin</strong><small>Connect a bin that is already in your Premiere project.</small><i>Continue ›</i></button>
                    <button className="choice-card" onClick={() => setModal("folder-tree")}><span className="choice-icon disk">D</span><strong>Create matching bins</strong><small>Select disk folders and reproduce their structure in Premiere.</small><i>Continue ›</i></button>
                  </div>
                  <div className="modal-actions"><button className="button secondary" onClick={() => setModal(null)}>Cancel</button></div>
                </>
              )}

              {modal === "existing-bin" && (
                <>
                  <div className="modal-title"><div><small>Create link · Existing bin</small><h2>Connect a Premiere bin</h2></div><button onClick={() => setModal(null)}>×</button></div>
                  <div className="form-body">
                    <label className="field-label">Premiere bin<span>Required</span></label>
                    <div className="path-field"><span className="field-prefix">Pr</span><input value={binPath} onChange={(e) => setBinPath(e.target.value)} /><button>Choose…</button></div>
                    <small className="field-help">The existing bin will be reused. No duplicate bin will be created.</small>
                    <label className="field-label">System folder<span>Required</span></label>
                    <div className="path-field"><span className="field-prefix disk">D</span><input value={folderPath} onChange={(e) => setFolderPath(e.target.value)} /><button>Browse…</button></div>
                    <div className="form-options">
                      <Check checked={false} onChange={() => undefined} label="Relative path" />
                      <Check checked={true} onChange={() => undefined} label="Include subfolders" />
                    </div>
                    <div className="info-strip"><span>i</span><p>Disk is the source of truth. Existing matching media will be reused and moved to the correct bin when needed.</p></div>
                  </div>
                  <div className="modal-actions"><button className="button secondary" onClick={() => setModal(null)}>Cancel</button><button className="button primary" onClick={() => setModal("initial-sync")}>Analyze link</button></div>
                </>
              )}

              {modal === "folder-tree" && (
                <>
                  <div className="modal-title"><div><small>Create link · Matching bins</small><h2>Select folders</h2></div><button onClick={() => setModal(null)}>×</button></div>
                  <div className="folder-layout">
                    <div className="folder-source">
                      <label className="search-field"><span>⌕</span><input placeholder="Search folders" /></label>
                      <div className="drive-row"><span>⌄</span><span className="drive-icon">L:</span><strong>Timber Truck</strong><small>Lucid storage</small></div>
                      <div className="tree-row root"><span>⌄</span><span className="folder-icon" />02_Assets</div>
                      {folders.map((folder) => (
                        <div className="tree-row" style={{ paddingLeft: `${20 + folder.depth * 18}px` }} key={folder.id}>
                          <span>{folder.depth === 2 ? "⌄" : ""}</span>
                          <Check checked={Boolean(selectedFolders[folder.id])} onChange={() => setSelectedFolders((items) => ({ ...items, [folder.id]: !items[folder.id] }))} label="" compact />
                          <span className="folder-icon" /><strong>{folder.label}</strong>
                        </div>
                      ))}
                    </div>
                    <aside className="folder-summary">
                      <span className="eyebrow">Selection</span><strong>{selectedFolderCount} folders</strong><p>Matching bins will be created inside:</p><div className="destination"><span>Pr</span><b>Footage</b></div>
                      <div className="divider" />
                      <Check checked={false} onChange={() => undefined} label="Relative paths" />
                      <Check checked={true} onChange={() => undefined} label="Include subfolders" />
                      <small>Each selected top-level folder becomes an independent link.</small>
                    </aside>
                  </div>
                  <div className="modal-actions"><button className="button secondary" onClick={() => setModal(null)}>Cancel</button><span className="action-hint">Nothing changes until you confirm Initial Sync</span><button className="button primary" disabled={selectedFolderCount === 0} onClick={() => setModal("initial-sync")}>Analyze selection</button></div>
                </>
              )}

              {modal === "initial-sync" && (
                <>
                  <div className="modal-title"><div><small>Final step</small><h2>Initial Sync</h2></div><button onClick={() => setModal(null)}>×</button></div>
                  <div className="form-body initial-sync-body">
                    <div className="sync-mapping"><div><span>Premiere bin</span><strong>{binPath}</strong></div><i>↕</i><div><span>System folder</span><strong>{folderPath}</strong></div></div>
                    <div className="analysis-summary"><span className="success-mark">✓</span><div><strong>Ready to link</strong><small>Existing project structure was analyzed safely.</small></div></div>
                    <div className="reconcile-list">
                      <div><span className="success-mark small">✓</span><p><strong>Gameplay</strong><small>Existing bin matched</small></p><i>Reuse</i></div>
                      <div><span className="success-mark small">✓</span><p><strong>Announce</strong><small>Existing bin matched</small></p><i>Reuse</i></div>
                      <div><span className="add-mark">+</span><p><strong>Trailer</strong><small>No matching bin</small></p><i className="blue-text">Create bin</i></div>
                    </div>
                    <div className="count-grid"><div><strong>42</strong><span>files already imported</span></div><div><strong>7</strong><span>files will be imported</span></div><div><strong>0</strong><span>duplicates created</span></div></div>
                  </div>
                  <div className="modal-actions"><button className="button secondary" onClick={() => setModal(null)}>Cancel</button><button className="button primary" onClick={addLinkAndSync}>{syncing ? "Syncing…" : "Link & Sync"}</button></div>
                </>
              )}

              {modal === "review" && (
                <>
                  <div className="modal-title"><div><small>Ask mode · Blocking items</small><h2>Review 19 changes</h2></div><button onClick={() => setModal(null)}>×</button></div>
                  <div className="review-toolbar"><Check checked={true} onChange={() => undefined} label="Select all safe changes" /><span>17 safe · 2 need a decision</span></div>
                  <div className="review-layout">
                    <div className="change-list">
                      {changes.map((change, index) => (
                        <button className={`change-row ${index === 3 ? "selected" : ""}`} key={change.title}>
                          <Check checked={index !== 3} onChange={() => undefined} label="" compact />
                          <span className={`change-type ${change.tone}`}>{change.icon}</span>
                          <span><strong>{change.title}</strong><small>{change.meta}</small></span>
                          <i>›</i>
                        </button>
                      ))}
                    </div>
                    <aside className="review-detail">
                      <span className="eyebrow amber-text">Decision required</span><h3>Fragmented MP4</h3><p>These files may not import reliably without preparation:</p>
                      <div className="file-list"><span>A008_C001.mp4</span><span>A008_C002.mp4</span></div>
                      <div className="radio-stack simple">
                        <Radio checked={true} onChange={() => undefined} title="Fix before import" description="Original files are not modified" />
                        <Radio checked={false} onChange={() => undefined} title="Skip these files" description="Keep them pending" />
                      </div>
                    </aside>
                  </div>
                  <div className="modal-actions"><button className="button secondary" onClick={() => setModal(null)}>Later</button><span className="action-hint">17 safe changes selected</span><button className="button primary" onClick={() => runSync("All selected changes were synced", "status")}>Sync selected</button></div>
                </>
              )}

              {modal === "conflict" && (
                <>
                  <div className="modal-title"><div><small>Attention required</small><h2>Folder unavailable</h2></div><button onClick={() => setModal(null)}>×</button></div>
                  <div className="form-body error-body">
                    <div className="large-alert"><span>!</span><div><strong>L:\\Timber Truck cannot be reached</strong><small>Last available today at 13:06</small></div></div>
                    <p>Footage Sync paused this link. Nothing was removed from Premiere and other available links can continue syncing.</p>
                    <div className="detail-box"><span>Premiere bin</span><strong>Footage / 01_VIDEO</strong><span>System folder</span><strong>L:\\Timber Truck\\02_Assets\\01_VIDEO</strong></div>
                    <div className="info-strip"><span>i</span><p>Reconnect the drive, choose a replacement folder, or keep the link paused.</p></div>
                  </div>
                  <div className="modal-actions spread"><button className="button quiet danger-text" onClick={() => { setModal(null); setMainState("offline"); }}>Pause link</button><div><button className="button secondary" onClick={() => setModal(null)}>Close</button><button className="button primary" onClick={() => { setFolderPath("L:\\Timber Truck\\02_Assets\\01_VIDEO"); setModal("existing-bin"); }}>Choose folder…</button></div></div>
                </>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
