"use strict";
const ppro=require("premierepro"),P=require("../core/paths"),State=require("./marker-state"),Markers=require("./markers");
const stamp=values=>JSON.stringify(values.map(v=>JSON.stringify(v)).sort());
function tx(project,label,actions) {
  let ok=false;project.lockedAccess(()=>{ok=project.executeTransaction(c=>{for(const action of actions())c.addAction(action);},label);});
  if(!ok)throw new Error(label+" failed.");
}
async function apply(project,item,source,mode="append",expected) {
  if(!["append","replace","skip"].includes(mode))throw new Error("Choose Replace, Add to existing, or Skip TXT.");
  const projectPath=P.key(project.path),projectId=String(project.guid),clip=ppro.ClipProjectItem.cast(item);
  if(!clip||await clip.isSequence()||await clip.isOffline())throw new Error("Choose online source footage for clip markers.");
  const owner=await clip.getProject();if(P.key(owner.path)!==projectPath||String(owner.guid)!==projectId)throw new Error("Source clip belongs to another project.");
  const collection=await ppro.Markers.getMarkers(clip),current=(await State.read(item)).ledger;
  const guard=async()=>{const active=await ppro.Project.getActiveProject();if(!active||P.key(active.path)!==projectPath||String(active.guid)!==projectId)throw new Error("The active project changed before importing clip markers.");};
  const descriptor=m=>Markers.describe(m),snapshot=()=>collection.getMarkers().map(descriptor);
  if(expected&&stamp(snapshot())!==expected)throw new Error("Clip markers changed after review. Review them again.");
  const record={sourceKey:P.key(source.path),signature:source.signature,revision:source.revision||0,skipped:mode==="skip"};
  const same=r=>r.sourceKey===record.sourceKey&&r.signature===record.signature&&r.revision===record.revision;
  if(!current.pending&&current.imports.length&&same(current.imports[current.imports.length-1]))return {added:0,ledger:current};
  await guard();
  if(mode==="skip") {
    const pending=current.pending,temps=pending?collection.getMarkers().filter(m=>pending.names.includes(m.getName())):[];
    const intact=pending&&temps.length===pending.names.length&&pending.names.every((name,i)=>temps.filter(m=>m.getName()===name).length===1&&temps.find(m=>m.getName()===name).getStart().seconds===pending.rows[i].seconds)&&temps.every(m=>m.getDuration().seconds===0&&m.getComments()===""&&m.getColorIndex()===0&&m.getType()==="Comment");
    const next={version:1,imports:[...current.imports,record]},metadata=await State.prepare(item,next);await guard();
    // Source marker Undo is not reliable in 25.6.2. Skip can reconcile an undone
    // receipt without guessing which edited/finalized markers belong to it.
    tx(project,"Footage Sync: skip marker TXT",()=>[...(intact?temps.map(m=>collection.createRemoveMarkerAction(m)):[]),metadata()]);
    if(!await State.verify(item,next))throw new Error("Could not verify the skipped TXT state.");
    return {added:0,ledger:next};
  }
  const timing=await State.timing(item);
  if(!source.markers?.length||source.markers.some(r=>!Number.isSafeInteger(r.seconds)||r.seconds<0||r.seconds>=timing.duration||!Number.isInteger(r.color)||r.color<0||r.color>7))throw new Error("Marker TXT contains a time outside the source duration or an invalid color. No markers applied.");
  let pending=current.pending;
  if(pending) {
    if(pending.sourceKey!==record.sourceKey||pending.signature!==record.signature||pending.mode!==mode)throw new Error("Finish or skip the interrupted marker import before choosing another TXT.");
  }else{
    const token="Footage Sync pending "+Date.now()+"-"+Math.random().toString(36).slice(2);
    pending={...record,mode,names:source.markers.map((_,i)=>token+":"+i),rows:source.markers.map(r=>({seconds:r.seconds,color:r.color})),baseline:snapshot()};
    const staged={...current,pending},metadata=await State.prepare(item,staged);await guard();
    // Verify the intent before adding markers; mixed source-marker/metadata
    // transactions must not be assumed atomic or jointly undoable on baseline.
    tx(project,"Footage Sync: prepare marker import",()=>[metadata()]);
    if(!await State.verify(item,staged))throw new Error("Could not store the marker import state. No markers added.");
    await guard();
    tx(project,"Footage Sync: stage clip markers",()=>source.markers.map((r,i)=>collection.createAddMarkerAction(pending.names[i],"Comment",ppro.TickTime.createWithSeconds(r.seconds),ppro.TickTime.createWithSeconds(0),"")));
  }
  const all=collection.getMarkers(),temps=pending.names.map(name=>all.filter(m=>m.getName()===name));
  if(temps.some(a=>a.length!==1))throw new Error("Interrupted or undone marker import is ambiguous. Choose Skip TXT to preserve current markers, then select TXT again if needed.");
  const temporary=temps.map(a=>a[0]),baseline=all.filter(m=>!pending.names.includes(m.getName()));
  if(stamp(baseline.map(descriptor))!==stamp(pending.baseline)||temporary.some((m,i)=>m.getStart().seconds!==source.markers[i].seconds||m.getComments()!==""||m.getDuration().seconds!==0||m.getType()!=="Comment"||m.getColorIndex()!==0))throw new Error("Markers were edited during import. Existing markers were preserved.");
  const next={version:1,imports:[...current.imports.filter(r=>!same(r)),record]},metadata=await State.prepare(item,next);await guard();
  const expectedMarkers=[...(mode==="replace"?[]:baseline.map(descriptor)),...temporary.map((m,i)=>({...descriptor(m),color:source.markers[i].color,name:""}))];
  // Existing markers are removed only in the final, explicitly confirmed Replace transaction.
  tx(project,"Footage Sync: "+(mode==="replace"?"replace":"add")+" clip markers",()=>[...temporary.flatMap((m,i)=>[m.createSetColorByIndexAction(source.markers[i].color),m.createSetNameAction("")]),...(mode==="replace"?baseline.map(m=>collection.createRemoveMarkerAction(m)):[]),metadata()]);
  // Premiere may invalidate Marker wrappers after a compound transaction. Reacquire.
  const verified=(await ppro.Markers.getMarkers(clip)).getMarkers().map(descriptor);
  if(!await State.verify(item,next)||stamp(verified)!==stamp(expectedMarkers))throw new Error("Could not verify the imported clip markers.");
  return {added:source.markers.length,ledger:next};
}
module.exports={apply,stamp};
