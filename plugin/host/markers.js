"use strict";
const ppro=require("premierepro"),P=require("../core/paths");
function describe(marker) {
  return {seconds:marker.getStart().seconds,ticks:marker.getStart().ticks,color:marker.getColorIndex(),name:marker.getName(),comments:marker.getComments(),duration:marker.getDuration().seconds,type:marker.getType()};
}
function transact(project,label,makeActions) {
  let ok=false;
  project.lockedAccess(()=>{ok=project.executeTransaction(compound=>{for(const action of makeActions())compound.addAction(action);},label);});
  if(!ok)throw new Error(label+" failed.");
}
async function collection(item) {
  const clip=ppro.ClipProjectItem.cast(item);
  if(!clip || await clip.isSequence())throw new Error("Select source footage. Sequence markers are not supported by this importer.");
  if(await clip.isOffline())throw new Error("Reconnect the source footage before importing clip markers.");
  return ppro.Markers.getMarkers(clip);
}
async function read(item) {return (await collection(item)).getMarkers().map(describe);}
// The caller owns the import policy and durable receipt storage. This adapter only
// appends requested source markers; it never removes or rewrites existing markers.
async function append(project,item,rows,receipts,checkpoint) {
  if(!Array.isArray(rows)||rows.some(r=>!Number.isSafeInteger(r.seconds)||r.seconds<0||!Number.isInteger(r.color)||r.color<0||r.color>7))throw new Error("Invalid clip marker data.");
  if(typeof checkpoint!=="function")throw new Error("A durable marker checkpoint is required.");
  const projectPath=project.path,projectId=String(project.guid),markers=await collection(item);
  async function guard() {
    const active=await ppro.Project.getActiveProject();
    if(!active||P.key(active.path)!==P.key(projectPath)||String(active.guid)!==projectId)throw new Error("The active project changed before importing clip markers.");
  }
  let added=0;const occurrences=new Map();
  for(const row of rows) {
    const base=row.seconds+":"+row.color,ordinal=occurrences.get(base)||0;occurrences.set(base,ordinal+1);
    const key=base+":"+ordinal;
    let receipt=receipts.find(r=>r.key===key);
    // Completed receipts preserve subsequent manual edits and deletions.
    if(receipt?.complete)continue;
    await guard();
    if(!receipt){receipt={key,seconds:row.seconds,color:row.color,token:"Footage Sync pending "+Date.now()+"-"+Math.random().toString(36).slice(2),complete:false};receipts.push(receipt);await checkpoint(receipts);}
    let pending=markers.getMarkers().filter(m=>m.getName()===receipt.token);
    if(pending.length>1)throw new Error("Ambiguous pending clip marker. No existing marker was changed.");
    if(!pending.length && receipt.created) {
      // A interrupted finalization must be reviewed; guessing could duplicate a
      // marker manually edited after the last durable checkpoint.
      throw new Error("An interrupted clip marker import needs review before it can continue.");
    }
    if(!pending.length) {
      await guard();
      transact(project,"Footage Sync: add clip marker",()=>[markers.createAddMarkerAction(receipt.token,"Comment",ppro.TickTime.createWithSeconds(row.seconds),ppro.TickTime.createWithSeconds(0),"")]);
      pending=markers.getMarkers().filter(m=>m.getName()===receipt.token);
      if(pending.length!==1)throw new Error("Could not verify the new source clip marker.");
      receipt.created=true;await checkpoint(receipts);added++;
    }
    const marker=pending[0];
    if(marker.getStart().seconds!==row.seconds||marker.getComments()!==""||marker.getDuration().seconds!==0)throw new Error("The pending marker was edited. Review the interrupted import.");
    await guard();
    transact(project,"Footage Sync: finalize clip marker",()=>[marker.createSetColorByIndexAction(row.color),marker.createSetNameAction("")]);
    if(marker.getColorIndex()!==row.color||marker.getName()!=="")throw new Error("Could not verify the clip marker color.");
    receipt.complete=true;await checkpoint(receipts);
  }
  return {added,receipts};
}
module.exports={describe,read,append};
