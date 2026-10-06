"use strict";
const ppro = require("premierepro");
const P = require("../core/paths");
function folder(item) { try { return ppro.FolderItem.cast(item); } catch (_) { return null; } }
function clip(item) { try { return ppro.ClipProjectItem.cast(item); } catch (_) { return null; } }
async function inventory(project) {
  const root = await project.getRootItem(), bins=[], clips=[], handles=new Map();
  async function walk(parent,parentPath) {
    for(const item of await parent.getItems()) {
      const id=String(await item.getId()), name=String(item.name); handles.set(id,item);
      const bin=folder(item);
      if(bin) { const path=P.join(parentPath,name); bins.push({id,name,path,parentPath}); await walk(bin,path); }
      else { const media=clip(item); if(!media) continue; const mediaPath=await media.getMediaFilePath(); if(mediaPath) clips.push({id,name,mediaPath:P.clean(mediaPath),parentPath}); }
    }
  }
  await walk(root,""); return {root,bins,clips,handles};
}
function transact(project,label,makeAction) {
  let result=false;
  // API actions must be created synchronously inside lockedAccess; no await in either callback.
  project.lockedAccess(()=>{ result=project.executeTransaction(c=>c.addAction(makeAction()),label); });
  if(!result) throw new Error(label + " failed.");
}
async function ensureBin(project,path) {
  let parent=await project.getRootItem();
  for(const name of P.clean(path).split("/").filter(Boolean)) {
    let found=(await parent.getItems()).filter(i=>i.name===name && folder(i));
    if(found.length>1) throw new Error("Ambiguous bin: " + path);
    if(!found.length) {
      const target=parent; transact(project,"Footage Sync: create bin",()=>target.createBinAction(name,false));
      found=(await parent.getItems()).filter(i=>i.name===name && folder(i));
      if(found.length!==1) throw new Error("Could not verify newly created bin: " + name);
    }
    parent=folder(found[0]);
  }
  return parent;
}
async function applyChange(project,change,inv) {
  if(change.kind==="new-folder") { await ensureBin(project,change.path); return; }
  if(change.kind==="folder-move") {
    const base=inv.handles.get(change.itemId), item=folder(base); if(!item) throw new Error("Managed bin disappeared.");
    const target=await ensureBin(project,P.dirname(change.path)), source=await base.getParentBin();
    const targetId=String(ppro.ProjectItem.cast(target).getId()), sourceId=String(ppro.ProjectItem.cast(source).getId());
    if(targetId!==sourceId) transact(project,"Footage Sync: move bin",()=>source.createMoveItemAction(base,target));
    if(item.name!==P.basename(change.path)) transact(project,"Footage Sync: rename bin",()=>item.createRenameBinAction(P.basename(change.path)));
    return;
  }
  const target=await ensureBin(project,change.target);
  if(change.kind==="new-file" || change.kind==="fragmented") {
    const fresh=await inventory(project);
    if(fresh.clips.some(c=>P.key(c.mediaPath)===P.key(change.path))) throw new Error("Source was imported after analysis. Scan again to reconcile it.");
    if(!await project.importFiles([change.path],true,target,false)) throw new Error("Premiere could not import " + change.path);
    const after=await inventory(project);
    if(after.clips.filter(c=>P.key(c.mediaPath)===P.key(change.path)).length!==1) throw new Error("Import result could not be verified.");
    return;
  }
  const item=inv.handles.get(change.itemId); if(!item) throw new Error("Project Item disappeared.");
  const media=clip(item);
  if(change.kind==="rename-file" || change.kind==="move-file") {
    if(!await media.canChangeMediaPath()) throw new Error("Premiere cannot relink this Project Item.");
    if(!await media.changeMediaFilePath(P.native(change.path),false)) throw new Error("Premiere rejected the new media path.");
    if(P.key(await media.getMediaFilePath())!==P.key(change.path)) throw new Error("Relink result could not be verified.");
    if(item.name!==change.name) transact(project,"Footage Sync: rename item",()=>media.createSetNameAction(change.name));
  }
  const source=await item.getParentBin();
  if(String(ppro.ProjectItem.cast(source).getId())!==String(ppro.ProjectItem.cast(target).getId())) transact(project,"Footage Sync: reconcile item",()=>source.createMoveItemAction(item,target));
}
module.exports={ppro,inventory,ensureBin,applyChange};
