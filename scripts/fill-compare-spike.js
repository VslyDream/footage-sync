"use strict";
// Native-vs-plugin comparison. Only generated fixture projects under root change.
module.exports=async function run(root){
 const H=require("./runtime/host/premiere"),P=require("./runtime/core/paths"),fs=require("./runtime/host/io"),S=require("./runtime/host/sequence"),Fill=require("./runtime/host/fill-frame"),{Controller}=require("./runtime/controller"),ppro=H.ppro;
 const result={status:"starting",cases:[]},write=()=>fs.writeFile(root+"/result.json",JSON.stringify(result,null,2),{encoding:"utf-8"}),assert=(v,m)=>{if(!v)throw Error(m);};await write();
 const transact=(project,name,actions)=>project.lockedAccess(()=>assert(project.executeTransaction(a=>actions().forEach(x=>a.addAction(x)),name),name+" failed"));
 const params=async item=>{const c=await Fill.motion(item),values=[];for(let i=0;i<c.getParamCount();i++){const p=c.getParam(i);values.push({index:i,value:(await p.getValueAtTime(ppro.TickTime.createWithSeconds(0))).value});}return values;};
 const png=async(seq,seconds,name)=>assert(await ppro.Exporter.exportSequenceFrame(seq,ppro.TickTime.createWithSeconds(seconds),name,P.native(root+"/frames"),1920,1080),"PNG export failed: "+name);
 try{
  const source=await ppro.Project.createProject(P.native(root+"/Fill-"+Date.now()+"_Footage.prproj")),target=await ppro.Project.createProject(P.native(root+"/Fill-"+Date.now()+"_Selects.prproj"));result.source=P.clean(source.path);result.target=P.clean(target.path);
  assert(await target.importFiles([root+"/seed.mp4"],true,await target.getRootItem(),false),"Seed import failed");const seed=(await H.inventory(target)).clips.find(v=>/seed.mp4$/.test(v.mediaPath));
  const seedItem=(await H.inventory(target)).handles.get(seed.id),auto=await target.createSequenceFromMedia("Automatic Fill",[ppro.ClipProjectItem.cast(seedItem)],await target.getRootItem()),native=await target.createSequenceFromMedia("Native Fill reference",[ppro.ClipProjectItem.cast(seedItem)],await target.getRootItem());
  const binding={projectPath:P.clean(target.path),projectName:target.name,sequenceId:String(auto.guid),sequenceName:auto.name};
  const c=new Controller();await c.selectProject({path:source.path});c.data.links=[{id:"fixture",folderPath:root+"/Media",binPath:"",binId:null,subfolders:true}];c.data.settings.autoMarkers=false;await c.selectSequence(binding);await c.apply(await c.scan());
  let state=await S.snapshot(binding);assert(state.video.length===8&&state.titles.length===1&&state.titles[0].name==="2026-11-04-Fill","Automatic batch did not produce seven filled clips and one plain-named title");
  result.auto={video:state.video.length,titles:state.titles.map(({item,...v})=>v),receipts:state.ledger.imports,repeat:(await c.scan()).changes};assert(!result.auto.repeat.length,"Repeat generated new work");
  const inventory=await H.inventory(target);
  for(const clip of state.video.slice(1)){
   const media=inventory.clips.find(v=>P.key(v.mediaPath)===P.key(clip.path)),item=inventory.handles.get(media.id);
   transact(target,"Native comparison insert",()=>[ppro.SequenceEditor.getEditor(native).createInsertProjectItemAction(item,ppro.TickTime.createWithSeconds(clip.start),0,0,true)]);
   const refs=await (await native.getVideoTrack(0)).getTrackItems(ppro.Constants.TrackItemType.CLIP,false),ref=refs[refs.length-1],motion=await Fill.motion(ref),scale=motion.getParam(1);
   transact(target,"Native comparison baseline",()=>[scale.createSetValueAction(scale.createKeyframe(47),true)]);
   result.cases.push({name:P.basename(clip.path),start:clip.start,end:clip.end,geometry:await Fill.geometry(item,auto),automatic:await params(clip.item)});
  }
  transact(target,"Native comparison identical title",()=>[ppro.SequenceEditor.getEditor(native).createCloneTrackItemAction(state.titles[0].item,ppro.TickTime.createWithSeconds(0),0,0,true,false)]);
  await source.save();await target.save();let index=0,busy=false;
  const select=async()=>{await target.openSequence(native);await native.setPlayerPosition(ppro.TickTime.createWithSeconds(result.cases[index].start+.5));const refs=await (await native.getVideoTrack(0)).getTrackItems(ppro.Constants.TrackItemType.CLIP,false);let selected;ppro.TrackItemSelection.createEmptySelection(s=>{s.addItem(refs[index+1],false);selected=native.setSelection(s);});await selected;result.status="awaiting native Fill Frame";result.current=index;await write();};
  await select();
  const timer=setInterval(async()=>{if(busy)return;busy=true;try{
   const refs=await (await native.getVideoTrack(0)).getTrackItems(ppro.Constants.TrackItemType.CLIP,false),row=result.cases[index],values=await params(refs[index+1]);if(Math.abs(values[1].value-47)<.0001)return;
   row.native=values;row.motionMatch=values.every((v,i)=>Array.isArray(v.value)?JSON.stringify(v.value)===JSON.stringify(row.automatic[i].value):typeof v.value==="number"?Math.abs(v.value-row.automatic[i].value)<.0001:v.value===row.automatic[i].value);
   row.nativeScale=values[1].value;row.automaticScale=row.automatic[1].value;await png(auto,row.start+.5,"auto-"+index+".png");await png(native,row.start+.5,"native-"+index+".png");await write();
   if(++index<result.cases.length)await select();else{clearInterval(timer);result.status=result.cases.every(v=>v.motionMatch)?"complete":"mismatch";result.saved=[await source.save(),await target.save()];await write();await target.openSequence(auto);await auto.setPlayerPosition(ppro.TickTime.createWithSeconds(3));}
  }catch(e){clearInterval(timer);result.status="failed";result.error=String(e?.message||e);result.stack=e?.stack;await write();}finally{busy=false;}},300);
 }catch(e){result.status="failed";result.error=String(e?.message||e);result.stack=e?.stack;await write();}return result;
};
