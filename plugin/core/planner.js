"use strict";
const P = require("./paths");
function groupBy(values, fn) {
  const map = new Map(); for (const v of values) { const k = fn(v); if (!map.has(k)) map.set(k, []); map.get(k).push(v); } return map;
}
function planSync({ links, scans, inventory, records = {} }) {
  const changes = [], reused = [], next = {}, claimed = new Set();
  const clipsByPath = groupBy(inventory.clips, c => P.key(c.mediaPath));
  const binsByPath = groupBy(inventory.bins, b => b.path);
  const clipById = new Map(inventory.clips.map(c => [c.id, c]));
  const binById = new Map(inventory.bins.map(b => [b.id, b]));
  const activeLinks=links.filter(l=>!l.paused && scans[l.id] && !scans[l.id].error);
  const allFiles=activeLinks.flatMap(l=>scans[l.id].files);
  const allPaths=new Set(allFiles.map(f=>P.key(f.path)));
  const allIdentities=groupBy(allFiles.filter(f=>f.identity),f=>f.identity);
  const oldFiles=[...new Map(activeLinks.flatMap(l=>records[l.id]?.files||[]).filter(f=>f.itemId).map(f=>[f.itemId,f])).values()];
  const oldIdentities=groupBy(oldFiles.filter(f=>f.identity),f=>f.identity);
  const missingFiles=oldFiles.filter(f=>!allPaths.has(P.key(f.path)) && clipById.has(f.itemId));
  const owners=new Map();
  function add(change) { changes.push({ id: String(changes.length), blocking: false, ...change }); }
  for (const link of links) {
    if (link.paused) continue;
    const scan = scans[link.id]; const old = records[link.id] || { files: [], dirs: [] };
    if (!scan || scan.error) { add({ kind: "unavailable", blocking: true, linkId: link.id, path: link.folderPath, message: scan?.error || "Source unavailable" }); continue; }
    next[link.id] = { files: [], dirs: [] };
    const rootBin = link.binId && binById.get(link.binId);
    if (link.binId && !rootBin) { add({ kind: "conflict", blocking: true, linkId: link.id, path: link.binPath, message: "Linked bin is missing. Choose a bin in Links." }); continue; }
    const rootPath = rootBin ? rootBin.path : link.binPath;
    const dirsByIdentity = groupBy(scan.dirs.filter(d => d.identity), d => d.identity);
    const oldDirIdentities = groupBy(old.dirs.filter(d => d.identity), d => d.identity);
    const nowDirs = new Set(scan.dirs.map(d => d.rel));
    const missingDirs=old.dirs.filter(d=>!nowDirs.has(d.rel) && binById.has(d.binId));
    const targets = new Set();
    // Parent folders are planned before child folders. No transaction happens here.
    const dirs = scan.dirs.slice().sort((a,b)=>a.rel.split("/").length-b.rel.split("/").length);
    const managedPaths = new Map();
    const blockedDirs=new Set();
    for (const dir of dirs) {
      const target = P.join(rootPath, dir.rel); let matches = binsByPath.get(target) || [];
      if([...blockedDirs].some(rel=>dir.rel===rel || dir.rel.startsWith(rel+"/"))) { blockedDirs.add(dir.rel); continue; }
      let oldDir;
      if (dir.identity && (dirsByIdentity.get(dir.identity)||[]).length === 1 && (oldDirIdentities.get(dir.identity)||[]).length === 1) {
        oldDir = oldDirIdentities.get(dir.identity)[0];
        if (oldDir.rel !== dir.rel && nowDirs.has(oldDir.rel)) oldDir = null;
      }
      const previousBin = oldDir && binById.get(oldDir.binId);
      if (previousBin && previousBin.path !== target) {
        if (matches.length && matches[0].id !== previousBin.id) {
          add({ kind:"conflict", blocking:true, linkId:link.id, path:target, message:"Folder rename/move collides with an existing bin." }); blockedDirs.add(dir.rel); continue;
        }
        add({kind:"folder-move",linkId:link.id,path:target,from:previousBin.path,itemId:previousBin.id});
        matches = [previousBin];
      }
      if (matches.length > 1) { add({kind:"conflict",blocking:true,linkId:link.id,path:target,message:"More than one bin has this path."}); blockedDirs.add(dir.rel); continue; }
      if (!matches.length) {
        if(missingDirs.some(d=>!d.identity || !dir.identity || d.identity===dir.identity)) {
          add({kind:"conflict",blocking:true,linkId:link.id,path:target,message:"A managed folder disappeared and its identity cannot be resolved safely."}); blockedDirs.add(dir.rel); continue;
        }
        const parts = target.split("/");
        for (let i=1;i<=parts.length;i++) { const path=parts.slice(0,i).join("/"); if (!binsByPath.has(path) && !targets.has(path)) { add({kind:"new-folder",linkId:link.id,path}); targets.add(path); } }
      } else reused.push({ kind:"folder", path:target, itemId:matches[0].id });
      managedPaths.set(dir.rel,target);
      next[link.id].dirs.push({...dir,binId:matches[0]?.id||null,binPath:target});
    }
    for (const file of scan.files) {
      if([...blockedDirs].some(rel=>P.dirname(file.rel)===rel || file.rel.startsWith(rel+"/"))) { add({kind:"conflict",blocking:true,linkId:link.id,path:file.path,message:"Resolve the parent folder conflict before importing this file."}); continue; }
      const target = managedPaths.get(P.dirname(file.rel)) || rootPath;
      const exact = clipsByPath.get(P.key(file.path)) || [];
      if (exact.length > 1) { add({kind:"conflict",blocking:true,linkId:link.id,path:file.path,message:"Multiple existing Project Items reference this file. No additional item will be imported."}); continue; }
      let item = exact[0], rename = false;
      if (!item && file.identity && (allIdentities.get(file.identity)||[]).length === 1 && (oldIdentities.get(file.identity)||[]).length === 1) {
        const prev = oldIdentities.get(file.identity)[0];
        if (!allPaths.has(P.key(prev.path)) && prev.size === file.size) { item = clipById.get(prev.itemId); rename = Boolean(item); }
      }
      if(file.issue && (!item || rename || item.parentPath!==target)) { add({kind:"media-error",blocking:true,linkId:link.id,path:file.path,message:file.issue,file,target}); continue; }
      if (item) {
        if (claimed.has(item.id)) { add({kind:"conflict",blocking:true,linkId:link.id,path:file.path,message:"Overlapping links target the same Project Item."}); continue; }
        claimed.add(item.id);
        owners.set(item.id,link.id);
        if (rename) add({kind: P.dirname(item.mediaPath) === P.dirname(file.path) ? "rename-file" : "move-file",linkId:link.id,path:file.path,from:item.mediaPath,itemId:item.id,target,name:P.basename(file.path),file});
        else if (item.parentPath !== target) add({kind:"reconcile-item",linkId:link.id,path:file.path,itemId:item.id,target,file});
        else reused.push({kind:"file",path:file.path,itemId:item.id});
      } else {
        const possible = missingFiles.filter(m=>!m.identity || !file.identity || m.identity===file.identity);
        if (possible.length) { add({kind:"conflict",blocking:true,linkId:link.id,path:file.path,message:"A managed source disappeared and this file cannot be identified reliably. Reconnect the existing item before importing."}); continue; }
        if (file.issue) add({kind:"media-error",blocking:true,linkId:link.id,path:file.path,message:file.issue,file,target});
        else add({kind:file.fragmented ? "fragmented" : "new-file",blocking:Boolean(file.fragmented),linkId:link.id,path:file.path,target,file,message:file.fragmented ? "Fragmented MP4 requires a decision before import." : ""});
      }
      next[link.id].files.push({...file,itemId:item?.id||null,target});
    }
    // Retain tombstones: a deleted source can reappear or be renamed after a later scan.
    for (const previous of old.files) if (!next[link.id].files.some(f=>f.itemId && f.itemId===previous.itemId)) next[link.id].files.push(previous);
    for (const previous of old.dirs) if (!next[link.id].dirs.some(d=>d.binId && d.binId===previous.binId)) next[link.id].dirs.push(previous);
  }
  for(const [linkId,record] of Object.entries(next)) record.files=record.files.filter(f=>!owners.has(f.itemId) || owners.get(f.itemId)===linkId);
  return {changes,reused,next,hasBlocking:changes.some(c=>c.blocking)};
}
module.exports = { planSync };
