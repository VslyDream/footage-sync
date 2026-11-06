"use strict";
// Isolated two-project acceptance. All media/projects/settings are generated fixtures.
module.exports=async function run(fixtures){
 const H=require("./runtime/host/premiere"),P=require("./runtime/core/paths"),fs=require("./runtime/host/io"),ppro=H.ppro,Sequence=require("./runtime/host/sequence"),{Controller}=require("./runtime/controller");
 const result={stages:[]},write=()=>fs.writeFile(fixtures+"/runtime-sequence-result.json",JSON.stringify(result,null,2),{encoding:"utf-8"});
 const stage=async value=>{result.stages.push(value);await write();};
 try{
  await stage("create Footage project");const source=await ppro.Project.createProject(P.native(fixtures+"/Runtime-"+Date.now()+"_Footage.prproj"));result.source=source.path;
  await stage("create Selects project");const target=await ppro.Project.createProject(P.native(fixtures+"/Runtime-"+Date.now()+"_Selects.prproj"));result.target=target.path;
  if(!await target.importFiles([fixtures+"/valid.mp4"],true,await target.getRootItem(),false))throw new Error("Seed import failed");
  const seed=(await (await target.getRootItem()).getItems()).find(i=>i.name==="valid.mp4");
  const sequence=await target.createSequenceFromMedia("Footage",[ppro.ClipProjectItem.cast(seed)],await target.getRootItem());
  const binding={projectPath:P.clean(target.path),projectName:target.name,sequenceId:String(sequence.guid),sequenceName:sequence.name};
  await stage("pin import target while Selects is active");
  const c=new Controller();await c.selectProject({path:source.path});c.data.links=[{id:"dated",binPath:"",binId:null,folderPath:fixtures+"/Media",subfolders:true,relative:false,paused:false}];c.data.settings.sequenceTarget=binding;c.data.settings.autoMarkers=false;await c.persist();
  const batch=await c.scan();result.plan=batch.changes.map(v=>({kind:v.kind,path:v.path,message:v.message,blocking:v.blocking}));result.timeline=batch.timeline;await write();
  await stage("controller import and append");await c.apply(batch);
  await stage("verify grouped date and repeat");
  const after=await Sequence.snapshot(binding);result.video=after.video.map(({item,...v})=>v);result.titles=after.titles.map(({item,...v})=>v);result.receipts=after.ledger;result.repeat=(await c.scan()).changes;result.sourceItems=(await H.inventory(source)).clips;result.active=(await ppro.Project.getActiveProject()).path;
  await stage("late same date including hash filename");
  const bytes=await fs.readFile(fixtures+"/valid.mp4");await fs.writeFile(fixtures+"/Media/2026-10-27-Developer/#5.mp4",bytes);await new Promise(r=>setTimeout(r,2100));await c.apply(await c.scan());
  const late=await Sequence.snapshot(binding);result.late={video:late.video.length,titles:late.titles.map(({item,...v})=>v)};
  await stage("new date");await fs.writeFile(fixtures+"/Media/2026-10-28-Developer/clip3.mp4",bytes);await new Promise(r=>setTimeout(r,2100));await c.apply(await c.scan());
  const next=await Sequence.snapshot(binding);result.next={video:next.video.length,titles:next.titles.map(({item,...v})=>v)};
  await stage("disjoint late old date");await fs.writeFile(fixtures+"/Media/2026-10-27-Developer/#6.mp4",bytes);await new Promise(r=>setTimeout(r,2100));await c.apply(await c.scan());
  const last=await Sequence.snapshot(binding);result.final={video:last.video.map(({item,...v})=>v),titles:last.titles.map(({item,...v})=>v),receiptCount:last.ledger.imports.length,repeat:(await c.scan()).changes};
  result.audio=[];for(let i=0;i<await sequence.getAudioTrackCount();i++){const track=await sequence.getAudioTrack(i),items=await track.getTrackItems(ppro.Constants.TrackItemType.CLIP,false);result.audio.push({index:i,clips:items.length});}
  result.sourceSaved=await source.save();result.targetSaved=await target.save();
  await target.openSequence(sequence);await sequence.setPlayerPosition(ppro.TickTime.createWithSeconds(3));result.status="complete";
 }catch(e){result.error=e.message;result.stack=e.stack;}
 await write();return result;
};
