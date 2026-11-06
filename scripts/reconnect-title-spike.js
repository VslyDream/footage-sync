"use strict";
// Only generated fixture projects beneath root are changed or closed.
module.exports=async function run(root){
 const H=require("./runtime/host/premiere"),P=require("./runtime/core/paths"),fs=require("./runtime/host/io"),S=require("./runtime/host/sequence"),{Controller}=require("./runtime/controller"),ppro=H.ppro,result={status:"starting"};
 const write=()=>fs.writeFile(root+"/result.json",JSON.stringify(result,null,2),{encoding:"utf-8"}),assert=(v,m)=>{if(!v)throw Error(m);};await write();
 try{
  const source=await ppro.Project.createProject(P.native(root+"/Reconnect-"+Date.now()+"_Footage.prproj")),target=await ppro.Project.createProject(P.native(root+"/Reconnect-"+Date.now()+"_Selects.prproj"));result.source=P.clean(source.path);result.target=P.clean(target.path);
  assert(await target.importFiles([root+"/seed.mp4"],true,await target.getRootItem(),false),"Seed import failed");
  const seed=(await (await target.getRootItem()).getItems()).find(i=>i.name==="seed.mp4"),sequence=await target.createSequenceFromMedia("Footage",[ppro.ClipProjectItem.cast(seed)],await target.getRootItem());
  const c=new Controller();await c.selectProject({path:source.path});c.data.links=[{id:"fixture",folderPath:root+"/Media",binPath:"",binId:null,subfolders:true}];c.data.settings.autoMarkers=false;
  const binding={projectPath:P.clean(target.path),projectName:target.name,sequenceId:String(sequence.guid),sequenceName:sequence.name};await c.selectSequence(binding);await c.apply(await c.scan());
  let state=await S.snapshot(binding);result.first=state.titles.map(({item,...v})=>v);assert(state.video.length===2&&state.titles.length===1&&state.titles[0].name==="2026-11-04-Developer","New graphic clip name is not the plain folder name");
  target.lockedAccess(()=>assert(target.executeTransaction(a=>a.addAction(state.titles[0].item.createSetNameAction("Footage Sync date 2026-11-04")),"Fixture legacy name"),"Legacy fixture rename failed"));
  await fs.writeFile(root+"/Media/2026-11-04-Developer/cam2.mp4",await fs.readFile(root+"/Media/2026-11-04-Developer/portrait.mp4"));await new Promise(r=>setTimeout(r,2100));await c.apply(await c.scan());
  state=await S.snapshot(binding);result.extended=state.titles.map(({item,...v})=>v);assert(state.video.length===3&&state.titles.length===1&&state.titles[0].name==="2026-11-04-Developer","Legacy title did not extend and lose its prefix");
  assert(await source.save()&&await target.save(),"Fixture save failed");const stale=c.project;result.oldId=c.projectId;
  assert(await source.close(new ppro.CloseProjectOptions()),"Fixture source close failed");try{result.oldNativeGuid=String(stale.guid);}catch(e){result.oldNativeError=e.message;}
  try{await c.scan(undefined,true);throw Error("Closed source was unexpectedly available");}catch(e){result.closedError=e.message;assert(/Open the selected import project/.test(e.message),"Wrong closed-project error");}
  await ppro.Project.open(P.native(result.source),new ppro.OpenProjectOptions());const recovered=await c.scan(undefined,true);result.recovered={path:c.path,id:c.projectId,changes:recovered.changes,error:c.error,operation:c.operation.status};
  assert(P.key(c.path)===P.key(result.source)&&!recovered.changes.length&&!c.error&&c.operation.status==="completed","Automatic reacquisition failed");
  // A stale wrapper whose accessors throw reproduces the reported failure even
  // on hosts which keep a closed Project's plain properties readable.
  c.project={get guid(){throw Error("a null ptr was detected");}};await c.context();await c.assertContext(c.path);assert((await H.inventory(c.project)).clips.length===2,"Reacquired source inventory is invalid");
  state=await S.snapshot(binding);result.video=state.video.map(({item,...v})=>v);result.titles=state.titles.map(({item,...v})=>v);result.receipts=state.ledger.imports.length;result.status="complete";await write();
  const clip=state.video.find(v=>/portrait.mp4$/i.test(v.path));const components=async()=>{const chain=await clip.item.getComponentChain(),values=[];for(let i=0;i<chain.getComponentCount();i++){const component=chain.getComponentAtIndex(i);if(await component.getMatchName()!=="AE.ADBE Motion")continue;for(let j=0;j<component.getParamCount();j++){const p=component.getParam(j);values.push({index:j,name:p.displayName,value:await p.getValueAtTime(ppro.TickTime.createWithSeconds(0))});}}return values;};
  result.nativeFillBefore=await components();await write();await target.openSequence(sequence);await sequence.setPlayerPosition(ppro.TickTime.createWithSeconds(3));
  let last=JSON.stringify(result.nativeFillBefore),count=0;const timer=setInterval(async()=>{try{const values=await components(),key=JSON.stringify(values);if(key!==last){last=key;result.nativeFillAfter=values;await write();await target.save();}if(++count>600)clearInterval(timer);}catch(_){clearInterval(timer);}},500);
 }catch(e){result.status="failed";result.error=e.message;result.stack=e.stack;await write();}return result;
};
