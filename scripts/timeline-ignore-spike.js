"use strict";
// Acceptance mutates only generated projects/media under the supplied fixture root.
module.exports=async function run(root,reopen=false){
 const H=require("./runtime/host/premiere"),P=require("./runtime/core/paths"),fs=require("./runtime/host/io"),S=require("./runtime/host/sequence"),{Controller}=require("./runtime/controller"),ppro=H.ppro;
 const result={status:"starting",stages:[]},output=root+(reopen?"/reopen.json":"/result.json");
 const write=()=>fs.writeFile(output,JSON.stringify(result,null,2),{encoding:"utf-8"}),stage=async s=>{result.stages.push(s);await write();};
 const assert=(value,message)=>{if(!value)throw Error(message);};
 try{
  if(reopen){
   const previous=JSON.parse(await fs.readFile(root+"/result.json",{encoding:"utf-8"}));
   await ppro.Project.open(P.native(previous.source),new ppro.OpenProjectOptions());await ppro.Project.open(P.native(previous.target),new ppro.OpenProjectOptions());
   const c=new Controller();await c.context();const batch=await c.scan(),state=await S.snapshot(c.data.settings.sequenceTarget);
   result.video=state.video.map(({item,...v})=>v);result.titles=state.titles.map(({item,...v})=>v);result.changes=batch.changes;result.ignored=c.data.ignored;result.sequenceCount=(await state.project.getSequences()).length;
   assert(state.video.length===8&&state.titles.length===4,"Reopen lost footage or native titles");assert(batch.changes.length===0&&!batch.warnings.length&&!batch.sequenceWarnings.length,"Ignored issue returned after cold reopen");assert(result.ignored.length===1,"Ignore rule was not persisted");
   result.status="complete";await write();await state.project.openSequence(state.sequence);await state.sequence.setPlayerPosition(ppro.TickTime.createWithSeconds(9));return result;
  }
  const source=await ppro.Project.createProject(P.native(root+"/Timeline-"+Date.now()+"_Footage.prproj")),target=await ppro.Project.createProject(P.native(root+"/Timeline-"+Date.now()+"_Selects.prproj"));
  result.source=source.path;result.target=target.path;
  assert(await target.importFiles([root+"/seed.mp4"],true,await target.getRootItem(),false),"Seed import failed");
  const seed=(await (await target.getRootItem()).getItems()).find(i=>i.name==="seed.mp4"),sequence=await target.createSequenceFromMedia("Footage",[ppro.ClipProjectItem.cast(seed)],await target.getRootItem());
  const c=new Controller();await c.selectProject({path:source.path});c.data.links=[{id:"fixture",binPath:"",binId:null,folderPath:root+"/Media",subfolders:true}];c.data.settings.autoMarkers=true;
  const binding={projectPath:P.clean(target.path),projectName:target.name,sequenceId:String(sequence.guid),sequenceName:sequence.name};await c.selectSequence(binding);
  const ui=new (require("./runtime/ui").UI)(c);globalThis.timelineIgnoreProbe={c,ui};
  const modal=ui.modal.bind(ui);ui.modal=(title,html,setup,options)=>modal(title,html,d=>{
   setup?.(d);if(title!=="Review Changes")return;
   const capture=async()=>{const fields={};for(const el of d.querySelectorAll("sp-checkbox"))fields[el.id]={checked:el.checked,disabled:el.disabled};await fs.writeFile(root+"/review-ui.json",JSON.stringify({time:Date.now(),fields,decisions:[...d.querySelectorAll('[id^="decision-text-"]')].map(e=>e.textContent)},null,2),{encoding:"utf-8"});};
   capture().catch(console.error);d.addEventListener("click",()=>setTimeout(()=>capture().catch(console.error),100));
  },options);
  const initial=await c.scan();result.initial=initial.changes.map(v=>({id:v.id,kind:v.kind,path:v.path,blocking:v.blocking}));await stage("Native Review: defer/original dependency, then Sync selected");
  await ui.review(initial);let state=await S.snapshot(binding);assert(state.video.length===2&&state.titles.length===1,"Native Review did not import both footage and Type Tool");
  result.first={video:state.video.length,titles:state.titles.map(({item,...v})=>v),queue:c.data.sequenceQueue};await stage("Same-date batch and Cyrillic folder title");
  const bytes=await fs.readFile(root+"/seed.mp4");
  for(const path of ["2026-10-28/clip1.mp4","2026-10-28/clip2.mp4","Съёмка & тест/#5.mp4"])await fs.writeFile(root+"/Media/"+path,bytes);
  await new Promise(r=>setTimeout(r,2100));await c.apply(await c.scan());state=await S.snapshot(binding);assert(state.video.length===5&&state.titles.length===3,"Mixed labels did not append as a group");
  result.grouped={video:state.video.length,titles:state.titles.map(({item,...v})=>v)};
  for(let i=3;i<6;i++){
   await fs.writeFile(root+"/Media/2026-10-28/clip"+i+".mp4",bytes);await new Promise(r=>setTimeout(r,2100));await c.apply(await c.scan());
   state=await S.snapshot(binding);assert(state.video.length===i+3&&state.titles.length===4,"Late batch lost a clip/title or duplicated the adjacent date title");
   assert((await c.scan()).changes.length===0,"Repeat sync generated duplicate work");
  }
  await stage("Ignore file through Review; restore through Settings");
  await fs.writeFile(root+"/Media/Blocked/bad.mp4","invalid MP4");await new Promise(r=>setTimeout(r,2100));const bad=await c.scan();assert(bad.hasBlocking,"Invalid fixture was not detected");
  await ui.review(bad);assert(c.data.ignored.length===1&&c.data.ignored[0].kind==="file","Native Ignore did not save file rule");assert((await c.scan()).changes.length===0,"Ignored file still appears in pending changes");
  await stage("Open Settings → Manage ignored paths → Restore, then close Links");await ui.management();assert(c.data.ignored.length===0,"Settings Restore did not remove the rule");assert((await c.scan()).hasBlocking,"Restoring did not resume source analysis");
  await c.setIgnored({kind:"folder",path:root+"/Media/Blocked"});
  await fs.writeFile(root+"/Media/Blocked/future.mp4","new invalid media");await fs.writeFile(root+"/Media/Blocked/bad.txt","invalid marker text");
  const hidden=await c.scan();assert(hidden.changes.length===0&&!hidden.warnings.length&&!hidden.sequenceWarnings.length,"Folder ignore leaked changes or warnings");
  await stage("Repeated Sync, final tracks, save");for(let i=0;i<3;i++)await c.apply(await c.scan());state=await S.snapshot(binding);
  result.video=state.video.map(({item,...v})=>v);result.titles=state.titles.map(({item,...v})=>v);result.receipts=state.ledger.imports;result.ignored=c.data.ignored;result.audio=[];
  for(let i=0;i<await sequence.getAudioTrackCount();i++)result.audio.push((await (await sequence.getAudioTrack(i)).getTrackItems(ppro.Constants.TrackItemType.CLIP,false)).length);
  assert(state.video.length===8&&state.titles.length===4&&state.ledger.imports.length===7,"Final track/receipt counts differ");assert(result.audio.reduce((a,b)=>a+b,0)===8,"Source audio missing");assert((await c.scan()).changes.length===0,"Final repeat is not empty");
  result.saved=[await source.save(),await target.save()];result.status="complete";await write();await target.openSequence(sequence);await sequence.setPlayerPosition(ppro.TickTime.createWithSeconds(9));
 }catch(e){result.status="failed";result.error=e.message;result.stack=e.stack;await write();}
 return result;
};
