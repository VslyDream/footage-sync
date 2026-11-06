"use strict";
module.exports=async function reopen(fixtures){
 const H=require("./runtime/host/premiere"),fs=require("./runtime/host/io"),P=require("./runtime/core/paths"),Sequence=require("./runtime/host/sequence"),{Controller}=require("./runtime/controller");
 const original=JSON.parse(await fs.readFile(fixtures+"/runtime-sequence-result.json",{encoding:"utf-8"})),result={};
 try{
  await H.ppro.Project.open(P.native(original.source),new H.ppro.OpenProjectOptions());
  await H.ppro.Project.open(P.native(original.target),new H.ppro.OpenProjectOptions());
  const c=new Controller();await c.context();const batch=await c.scan(),state=await Sequence.snapshot(c.data.settings.sequenceTarget);
  result.project=c.path;result.changes=batch.changes;result.titleCount=state.titles.length;result.videoCount=state.video.length;result.receipts=state.ledger.imports.length;result.sequenceCount=(await state.project.getSequences()).length;result.status="complete";
  const tail=state.titles.find(t=>t.end===state.end);let renamed=false;
  state.project.lockedAccess(()=>{renamed=state.project.executeTransaction(compound=>compound.addAction(tail.item.createSetNameAction("Renamed fixture title")),"Probe title lookup fallback");});if(!renamed)throw new Error("Fixture title rename failed");
  await fs.writeFile(fixtures+"/Media/2026-10-27-Developer/#7.mp4",await fs.readFile(fixtures+"/valid.mp4"));await new Promise(r=>setTimeout(r,2100));await c.apply(await c.scan());
  const fallback=await Sequence.snapshot(c.data.settings.sequenceTarget);result.lookupFallback={video:fallback.video.length,titles:fallback.titles.map(({item,...v})=>v),repeat:(await c.scan()).changes};
  await c.project.save();await state.project.save();await state.project.openSequence(state.sequence);await state.sequence.setPlayerPosition(H.ppro.TickTime.createWithSeconds(13));
  await fs.writeFile(fixtures+"/reopen-result.json",JSON.stringify(result,null,2),{encoding:"utf-8"});
  const ui=new (require("./runtime/ui").UI)(c);
  ui.initial=async drafts=>fs.writeFile(fixtures+"/browse-draft-result.json",JSON.stringify(drafts,null,2),{encoding:"utf-8"});
  globalThis.footageSyncProbe={c,ui};await ui.management();
 }catch(e){result.error=e.message;result.stack=e.stack;await fs.writeFile(fixtures+"/reopen-result.json",JSON.stringify(result,null,2),{encoding:"utf-8"});}
};
