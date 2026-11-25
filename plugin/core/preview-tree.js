"use strict";
const P = require("./paths");
const {timeline, needs} = require("./changes-view");

// Index disk folders separately from Premiere bin paths. Multiple disk branches
// can contain an "Assets" folder and a bin may have been renamed in Premiere.
function previewTree(batch, preview) {
  const links = [...new Map([...(batch.links || []), ...preview.drafts].map(link => [link.id,link])).values()];
  const linkRoots = new Map(links.map(link => [
    link.id, P.resolve(P.dirname(batch.projectPath), link.folderPath)
  ]));
  const roots = [], nodes = new Map(), binPaths = new Map();
  const folder = path => {
    const key = P.key(path);
    if (nodes.has(key)) return nodes.get(key);
    const root = [...linkRoots.values()].find(base => P.within(path, base));
    const parent = root && key !== P.key(root) ? folder(P.dirname(path)) : null;
    const node = {path, key, children:[], items:[], decisions:[], reused:[], warnings:0};
    nodes.set(key, node);
    (parent ? parent.children : roots).push(node);
    return node;
  };
  const reusedBins = new Map((batch.reused || []).filter(r => r.kind === "folder").map(r => [r.path,r.itemId]));
  for (const link of links) {
    const dirs = new Map();
    binPaths.set(link.id, dirs);
    const root = linkRoots.get(link.id);
    const binRoot = batch.inventory?.bins?.find(bin => bin.id === link.binId)?.path ?? link.binPath;
    // Blocking bin conflicts are absent from next.dirs. Resolve them from
    // the scan, without deriving disk paths from previously managed bins.
    for (const dir of batch.scans?.[link.id]?.dirs || []) {
      dirs.set(P.join(binRoot, dir.rel), dir.path || P.join(root, dir.rel));
    }
    const recorded = new Set();
    for (const dir of batch.next?.[link.id]?.dirs || []) {
      // The first record is the current scan; old paths can follow as tombstones.
      if (recorded.has(dir.binPath)) continue;
      recorded.add(dir.binPath);
      const path = dir.path || P.join(root, dir.rel);
      if (!P.within(path, root)) continue;
      if (reusedBins.has(dir.binPath) && reusedBins.get(dir.binPath) === dir.binId) folder(path).reusedBin = true;
      dirs.set(dir.binPath, path);
    }
  }
  for (const file of batch.reused || []) {
    if (file.kind === "file") folder(P.dirname(file.path)).reused.push(file);
  }
  for (const c of batch.changes) {
    if (timeline(c) || c.kind === "unavailable") continue;
    const isBin = !P.isAbsolute(c.path);
    const path = isBin ? binPaths.get(c.linkId)?.get(c.path) || linkRoots.get(c.linkId) : P.dirname(c.path);
    if (!path) continue;
    const node = folder(path);
    (needs(c) ? node.decisions : node.items).push(c);
  }
  for (const w of batch.warnings || []) {
    if (w.path || w.txtPath) folder(P.dirname(w.path || w.txtPath)).warnings++;
  }
  for (const path of preview.excluded || []) folder(path).excluded = true;
  function summarize(node) {
    node.children.sort((a,b) => a.path.localeCompare(b.path));
    node.actionCount = node.items.length;
    node.renamed = node.items.filter(c => c.kind === "rename-file").length;
    node.moved = node.items.filter(c => ["move-file","folder-move","reconcile-item"].includes(c.kind)).length;
    node.decisionCount = node.decisions.length;
    node.reuseCount = node.reused.length;
    node.fileCount = new Set([...node.items, ...node.decisions].filter(c => P.isAbsolute(c.path)).map(c => P.key(c.path))).size;
    node.hasReuse = Boolean(node.reusedBin || node.reused.length);
    node.hasChanges = Boolean(node.excluded || node.actionCount || node.decisionCount || node.warnings);
    node.bytes = node.items.reduce((total, c) => total + (c.file?.size || 0), 0);
    for (const child of node.children) {
      summarize(child);
      node.actionCount += child.actionCount;
      node.renamed += child.renamed;
      node.moved += child.moved;
      node.decisionCount += child.decisionCount;
      node.reuseCount += child.reuseCount;
      node.fileCount += child.fileCount;
      node.bytes += child.bytes;
      node.hasReuse ||= child.hasReuse;
      node.hasChanges ||= child.hasChanges;
    }
  }
  roots.sort((a,b) => a.path.localeCompare(b.path));
  roots.forEach(summarize);
  return roots;
}
function* branchItems(node, decisions) {
  yield* node.items;
  for (const change of node.decisions) if (decisions.has(change.id)) yield change;
  for (const child of node.children) yield* branchItems(child, decisions);
}
module.exports = {previewTree, branchItems};
