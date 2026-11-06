"use strict";
// Mutates only projects and media created for this fixture root.
module.exports=async function run(root){
 const H=require("./runtime/host/premiere"),P=require("./runtime/core/paths"),fs=require("./runtime/host/io"),ppro=H.ppro,S=require("./runtime/host/sequence"),{Controller}=require("./runtime/controller"),result={status:"starting"};
 const write=()=>fs.writeFile(root+"/result.json",JSON.stringify(result,null,2),{encoding:"utf-8"});await write();
 try{
  const source=await ppro.Project.createProject(P.native(root+"/Refine-"+Date.now()+"_Footage.prproj"));
  const target=await ppro.Project.createProject(P.native(root+"/Refine-"+Date.now()+"_Selects.prproj"));
  result.source=source.path;result.target=target.path;
  await target.importFiles([root+"/seed.mp4"],true,await target.getRootItem(),false);
  const seed=(await (await target.getRootItem()).getItems()).find(i=>i.name==="seed.mp4"),sequence=await target.createSequenceFromMedia("Footage",[ppro.ClipProjectItem.cast(seed)],await target.getRootItem());
  const c=new Controller();await c.selectProject({path:source.path});c.data.links=[{id:"fixture",binPath:"",binId:null,folderPath:root+"/Media",subfolders:true,relative:false}];c.data.settings.autoMarkers=false;
  const binding={projectPath:P.clean(target.path),projectName:target.name,sequenceId:String(sequence.guid),sequenceName:sequence.name};await c.selectSequence(binding);
  const initial=await c.scan();result.initial=initial.changes.map(v=>({kind:v.kind,path:v.path,date:v.date,blocking:v.blocking,message:v.message}));await write();
  await c.apply(initial);const first=await S.snapshot(binding);result.first={video:first.video.length,titles:first.titles.map(({item,...v})=>v),repeat:(await c.scan()).changes};
  const data=await fs.readFile(root+"/seed.mp4");await c.setSequenceEnabled(false);await fs.writeFile(root+"/Media/Developer Footage/off.mp4",data);await new Promise(r=>setTimeout(r,2100));await c.apply(await c.scan());
  result.off={video:(await S.snapshot(binding)).video.length,sourceClips:(await H.inventory(source)).clips.length,target:c.data.settings.sequenceTarget};await c.setSequenceEnabled(true);result.reenabled=(await c.scan()).changes;
  c.data.settings.sequenceTarget={...binding,projectPath:root+"/Closed_Selects.prproj"};await c.persist();await fs.writeFile(root+"/Media/Developer Footage/files-only.mp4",data);await new Promise(r=>setTimeout(r,2100));
  const unavailable=await c.scan();result.unavailable=unavailable.changes.map(v=>({kind:v.kind,blocking:v.blocking,path:v.path}));await c.apply(unavailable,undefined,{}, {filesOnly:true});
  result.filesOnly={sourceClips:(await H.inventory(source)).clips.length,queue:c.data.sequenceQueue,skipped:c.data.sequenceSkipped,repeat:(await c.scan()).changes};
  c.data.settings.sequenceTarget=binding;await c.persist();result.restored=(await c.scan()).changes;result.sequence=String(sequence.guid);result.saved=[await source.save(),await target.save()];
  const candidates=["executeCommand","findMenuCommandId","fillFrame","createFillFrameAction","createSetFillFrameAction"];
  result.commandProbe={};for(const [label,object] of [["root",ppro],["application",ppro.Application],["utils",ppro.Utils],["clip",(await S.snapshot(binding)).video[0].item]]){const values={};for(const name of candidates)try{values[name]=typeof object?.[name];}catch(e){values[name]="not exposed";}result.commandProbe[label]=values;}
  result.status="complete";await write();await target.openSequence(sequence);await sequence.setPlayerPosition(ppro.TickTime.createWithSeconds(9));
  const ui=new (require("./runtime/ui").UI)(c);ui.management().catch(async e=>{result.uiError=e.message;await write();});
 }catch(e){result.status="failed";result.error=e.message;result.stack=e.stack;await write();}
 return result;
};
