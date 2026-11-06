"use strict";
// Executed only by the isolated development probe, against generated fixture projects.
module.exports=async function sequenceSpike(fixtures){
 const ppro=require("premierepro"),fs=require("./runtime/host/io"),H=require("./runtime/host/premiere");
 const result={stages:[]};
 const write=()=>fs.writeFile(fixtures+"/sequence-result.json",JSON.stringify(result,null,2),{encoding:"utf-8"});
 try{
  result.stages.push("create fixture project");await write();
  const p=await ppro.Project.createProject((fixtures+"/SequenceSpike-"+Date.now()+".prproj").replace(/\//g,"\\"));
  result.project=p.path;result.stages.push("import generated media");await write();
  if(!await p.importFiles([fixtures+"/valid.mp4"],true,await p.getRootItem(),false))throw new Error("Fixture import failed");
  const items=await (await p.getRootItem()).getItems(),clip=items.find(i=>i.name==="valid.mp4");
  result.stages.push("create footage sequence");await write();
  const s=await p.createSequenceFromMedia("Footage",[ppro.ClipProjectItem.cast(clip)],await p.getRootItem());
  result.targetSequence=String(s.guid);result.stages.push("import native date sequence");await write();
  const id=ppro.Guid.fromString("dc724771-7e18-467d-a32d-540a4c64626e");
  result.importSequences=await p.importSequences((fixtures+"/DateTemplate.prproj").replace(/\//g,"\\"),[id]);
  const seqs=await p.getSequences();result.sequences=seqs.map(q=>({name:q.name,guid:String(q.guid)}));
  const src=seqs.find(q=>q.name==="FootageDates Spike");if(!src)throw new Error("Imported title sequence missing");
  const title=(await (await src.getVideoTrack(1)).getTrackItems(ppro.Constants.TrackItemType.CLIP,false))[0];
  result.stages.push("clone native title between sequences");await write();
  const end=await s.getEndTime();
  H.ppro.Project; // Keep production transaction behavior in the probe.
  let ok=false;p.lockedAccess(()=>{ok=p.executeTransaction(c=>c.addAction(ppro.SequenceEditor.getEditor(s).createCloneTrackItemAction(title,ppro.TickTime.createWithSeconds(0),0,0,true,false)),"Date title spike");});
  result.clone=ok;
  const placed=await (await s.getVideoTrack(1)).getTrackItems(ppro.Constants.TrackItemType.CLIP,false);
  result.titles=[];
  for(const t of placed){
   const chain=await t.getComponentChain(),components=[];for(let i=0;i<await chain.getComponentCount();i++){const component=await chain.getComponentAtIndex(i);components.push(component.matchName);}
   result.titles.push({name:await t.getName(),start:(await t.getStartTime()).seconds,end:(await t.getEndTime()).seconds,components});
  }
  result.stages.push("extend title to footage duration");await write();
  if(placed.length!==1)throw new Error("Expected exactly one title on V2");
  p.lockedAccess(()=>{result.extend=p.executeTransaction(c=>c.addAction(placed[0].createSetEndAction(end)),"Extend date title spike");});
  await p.openSequence(s);await s.setPlayerPosition(ppro.TickTime.createWithSeconds(1));
  result.end=(await placed[0].getEndTime()).seconds;
  result.saved=await p.save();result.status="complete";
 }catch(e){result.error=e.message;result.stack=e.stack;}
 await write();return result;
};
