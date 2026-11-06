"use strict";
module.exports=async function run(root){
 const H=require("./runtime/host/premiere"),P=require("./runtime/core/paths"),fs=require("./runtime/host/io"),ppro=H.ppro,result={status:"starting"};
 const write=()=>fs.writeFile(root+"/fill-probe.json",JSON.stringify(result,null,2),{encoding:"utf-8"});await write();
 try{
  const project=await ppro.Project.createProject(P.native(root+"/Fill-"+Date.now()+".prproj"));result.project=project.path;
  const base=await project.getRootItem();await project.importFiles([root+"/target.mp4",root+"/portrait.mp4"],true,base,false);
  const all=await base.getItems(),seed=all.find(i=>i.name==="target.mp4"),source=all.find(i=>i.name==="portrait.mp4");
  const sequence=await project.createSequenceFromMedia("Fill check",[ppro.ClipProjectItem.cast(seed)],base);
  project.lockedAccess(()=>project.executeTransaction(c=>c.addAction(ppro.SequenceEditor.getEditor(sequence).createInsertProjectItemAction(source,ppro.TickTime.createWithSeconds(2),0,0,true)),"Fixture insert"));
  const track=await sequence.getVideoTrack(0),clips=await track.getTrackItems(ppro.Constants.TrackItemType.CLIP,false),clip=clips[1];
  const methods=value=>{const names=new Set();for(let o=value;o;o=Object.getPrototypeOf(o))for(const n of Object.getOwnPropertyNames(o))names.add(n);return [...names].filter(n=>/fill|fit|scale|command|menu/i.test(n));};
  result.nativeCommands={clip:methods(clip),project:methods(project),app:methods(ppro.Application||{}),root:methods(ppro)};
  result.columns=JSON.parse(await ppro.Metadata.getProjectColumnsMetadata(source));
  result.sequencePAR=await (await sequence.getSettings()).getVideoPixelAspectRatio();
  result.sourcePAR=(await ppro.ClipProjectItem.cast(source).getFootageInterpretation()).getPixelAspectRatio();
  result.components=[];const chain=await clip.getComponentChain();
  for(let i=0;i<chain.getComponentCount();i++){
   const c=chain.getComponentAtIndex(i),entry={name:await c.getDisplayName(),match:await c.getMatchName(),params:[]};
   for(let j=0;j<c.getParamCount();j++){const p=c.getParam(j);entry.params.push({index:j,name:p.displayName,value:await p.getValueAtTime(ppro.TickTime.createWithSeconds(0))});}
   result.components.push(entry);
  }
  result.sequence=String(sequence.guid);result.saved=await project.save();result.status="complete";
  await project.openSequence(sequence);await sequence.setPlayerPosition(ppro.TickTime.createWithSeconds(3));
 }catch(e){result.status="failed";result.error=e.message;result.stack=e.stack;}
 await write();return result;
};
