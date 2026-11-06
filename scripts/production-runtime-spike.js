"use strict";
module.exports=async function run(fixtures){
 const H=require("./runtime/host/premiere"),P=require("./runtime/core/paths"),fs=require("./runtime/host/io"),{Controller}=require("./runtime/controller"),Sequence=require("./runtime/host/sequence"),result={status:"waiting for fixture Production to be opened"};
 const write=()=>fs.writeFile(fixtures+"/result.json",JSON.stringify(result,null,2),{encoding:"utf-8"});await write();
 for(let i=0;i<1800;i++){try{await fs.lstat(fixtures+"/run-production.txt");break;}catch(e){if(i===1799)return;await new Promise(r=>setTimeout(r,1000));}}
 try{
  result.status="opening fixture members";await write();
  const source=await H.ppro.Project.open(P.native(fixtures+"/FS_Production/01_Test_Footage.prproj"),new H.ppro.OpenProjectOptions());
  const target=await H.ppro.Project.open(P.native(fixtures+"/FS_Production/02_Test_Selects.prproj"),new H.ppro.OpenProjectOptions());
  result.source=source.path;result.target=target.path;
  const sequences=await target.getSequences(),sequence=sequences.find(s=>s.name==="Footage"),c=new Controller();
  await c.selectProject({path:source.path});c.data.links=[{id:"production",binPath:"",binId:null,folderPath:fixtures+"/Media",relative:false,subfolders:true,paused:false}];c.data.records={};c.data.settings.autoMarkers=false;
  c.data.settings.sequenceTarget={projectPath:P.clean(target.path),projectName:target.name,sequenceId:String(sequence.guid),sequenceName:sequence.name};await c.persist();
  result.active=(await H.ppro.Project.getActiveProject()).path;result.plan=(await c.scan()).changes.map(v=>({kind:v.kind,path:v.path,blocking:v.blocking,message:v.message}));await write();
  await c.apply(await c.scan());const after=await Sequence.snapshot(c.data.settings.sequenceTarget);
  result.video=after.video.map(({item,...v})=>v);result.titles=after.titles.map(({item,...v})=>v);result.repeat=(await c.scan()).changes;result.sourceClips=(await H.inventory(source)).clips.length;
  result.saved=[await source.save(),await target.save()];result.status="complete";
  await target.openSequence(sequence);await sequence.setPlayerPosition(H.ppro.TickTime.createWithSeconds(15));
 }catch(e){result.status="failed";result.error=e.message;result.stack=e.stack;}
 await write();return result;
};
