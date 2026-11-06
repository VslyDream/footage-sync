"use strict";
// Fresh end-to-end import compared with saved native Fill reference values/frames.
module.exports=async function(root,referenceRoot){
 const H=require("./runtime/host/premiere"),P=require("./runtime/core/paths"),fs=require("./runtime/host/io"),S=require("./runtime/host/sequence"),Fill=require("./runtime/host/fill-frame"),{Controller}=require("./runtime/controller"),ppro=H.ppro;
 const result={status:"starting",cases:[]},write=()=>fs.writeFile(root+"/result.json",JSON.stringify(result,null,2),{encoding:"utf-8"}),assert=(v,m)=>{if(!v)throw Error(m);};await write();
 try{
  const reference=JSON.parse(await fs.readFile(referenceRoot+"/result.json",{encoding:"utf-8"}));assert(reference.cases.length===7&&reference.cases.every(v=>v.native&&v.exports.every(e=>e.ok)),"Native reference incomplete");
  const source=await ppro.Project.createProject(P.native(root+"/Fill-"+Date.now()+"_Footage.prproj")),target=await ppro.Project.createProject(P.native(root+"/Fill-"+Date.now()+"_Selects.prproj"));result.source=P.clean(source.path);result.target=P.clean(target.path);
  assert(await target.importFiles([root+"/seed.mp4"],true,await target.getRootItem(),false),"Seed import failed");const inventory=await H.inventory(target),seed=inventory.clips.find(v=>/seed.mp4$/.test(v.mediaPath));
  const auto=await target.createSequenceFromMedia("Automatic Fill final",[ppro.ClipProjectItem.cast(inventory.handles.get(seed.id))],await target.getRootItem()),binding={projectPath:P.clean(target.path),projectName:target.name,sequenceId:String(auto.guid),sequenceName:auto.name};result.binding=binding;
  const c=new Controller();await c.selectProject({path:source.path});c.data.links=[{id:"fixture",folderPath:root+"/Media",binPath:"",binId:null,subfolders:true}];c.data.settings.autoMarkers=false;await c.selectSequence(binding);await c.apply(await c.scan());
  const state=await S.snapshot(binding),audio=(await (await auto.getAudioTrack(0)).getTrackItems(ppro.Constants.TrackItemType.CLIP,false));
  assert(state.video.length===8&&audio.length===8&&state.titles.length===1&&state.titles[0].name==="2026-11-04-Fill"&&state.ledger.imports.length===7,"Incomplete footage/audio/title batch");
  result.auto={video:state.video.length,audio:audio.length,titles:state.titles.map(({item,...v})=>v),receipts:state.ledger.imports,repeat:(await c.scan()).changes};assert(!result.auto.repeat.length,"Repeat generated new work");
  for(let n=0;n<7;n++){
   const clip=state.video[n+1],row=reference.cases[n],component=await Fill.motion(clip.item),values=[];
   assert(P.basename(clip.path)===row.name&&clip.start===row.start&&clip.end===row.end,"Comparison media/timing differs");
   for(let i=0;i<component.getParamCount();i++)values.push({index:i,value:(await component.getParam(i).getValueAtTime(ppro.TickTime.createWithSeconds(0))).value});
   result.cases.push({name:row.name,automatic:values,native:row.native,motionExact:JSON.stringify(values)===JSON.stringify(row.native),automaticScale:values[1].value,nativeScale:row.native[1].value,referenceFrame:referenceRoot+"/frames/native-"+n+".png.png"});
  }
  result.saved=[await source.save(),await target.save()];await write();
  for(let n=0;n<7;n++){result.cases[n].exported=await ppro.Exporter.exportSequenceFrame(auto,ppro.TickTime.createWithSeconds(reference.cases[n].start+.5),"auto-"+n+".png",P.native(root+"/frames"),1920,1080);await write();}
  result.status=result.cases.every(v=>v.motionExact&&v.exported)?"complete":"mismatch";await write();await target.openSequence(auto);await auto.setPlayerPosition(ppro.TickTime.createWithSeconds(2.5));
 }catch(e){result.status="failed";result.error=String(e?.message||e);result.stack=e?.stack;await write();}return result;
};
