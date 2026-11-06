"use strict";
const H=require("./premiere"),P=require("../core/paths"),fs=require("./io"),Native=require("../core/native-date"),{XMPMeta}=require("uxp").xmp;
const ppro=H.ppro,NS="http://ns.adobe.com/premierePrivateProjectMetaData/1.0/",FIELD="FootageSyncSequenceImports";
const Fill=require("./fill-frame");
const tick=value=>ppro.TickTime.createWithSeconds(value);
async function context(target){
  const project=await H.resolveProject({path:target.projectPath},"sequence");
  const sequence=await project.getSequence(ppro.Guid.fromString(target.sequenceId));
  if(!sequence)throw new Error("The selected Footage sequence is unavailable. Choose it again in Links.");
  return {project,sequence};
}
async function items(sequence,index){if(await sequence.getVideoTrackCount()<=index)return [];return (await sequence.getVideoTrack(index)).getTrackItems(ppro.Constants.TrackItemType.CLIP,false);}
async function describe(item){
  const base=await item.getProjectItem();let path="";try{path=await ppro.ClipProjectItem.cast(base).getMediaFilePath()||"";}catch(_){}
  return {item,name:await item.getName(),path:P.clean(path),id:base?String(await base.getId()):null,start:(await item.getStartTime()).seconds,end:(await item.getEndTime()).seconds};
}
async function snapshot(target){
  const {project,sequence}=await context(target),item=await sequence.getProjectItem();
  const meta=new XMPMeta(await ppro.Metadata.getProjectMetadata(item)),raw=meta.getProperty(NS,FIELD)?.value;
  const ledger=raw?JSON.parse(String(raw)):{version:1,imports:[]};
  if(ledger.version!==1||!Array.isArray(ledger.imports)||ledger.imports.some(r=>typeof r.key!=="string"))throw new Error("Sequence import receipts are invalid. Existing edits were preserved.");
  const video=[],titles=[];
  for(const value of await items(sequence,0))video.push(await describe(value));
  for(const value of await items(sequence,1))titles.push(await describe(value));
  const end=(await sequence.getEndTime()).seconds;
  const fingerprint=JSON.stringify([String(project.guid),String(sequence.guid),end,[...video,...titles].map(({item,...v})=>v),ledger]);
  return {project,sequence,item,ledger,video,titles,end,fingerprint};
}
async function receiptAction(item,ledger){
  await ppro.Metadata.addPropertyToProjectMetadataSchema(FIELD,"Footage Sync sequence imports",ppro.Constants.MetadataType.TEXT);
  const meta=new XMPMeta(await ppro.Metadata.getProjectMetadata(item));meta.setProperty(NS,FIELD,JSON.stringify(ledger));
  const xml=meta.serialize();return ()=>ppro.Metadata.createSetProjectMetadataAction(item,xml,[FIELD]);
}
function transact(project,label,actions){let ok=false;project.lockedAccess(()=>{ok=project.executeTransaction(c=>{for(const a of actions())c.addAction(a);},label);});if(!ok)throw new Error(label+" failed. No retry is performed automatically.");}
async function nativeTitle(state,date){
  const frame=await state.sequence.getFrameSize(),height=Number(frame.height||frame.bottom-frame.top),width=Number(frame.width||frame.right-frame.left);
  const generated=Native.generate(date,height,width),temp=await require("uxp").storage.localFileSystem.getTemporaryFolder();
  const path=P.join(temp.nativePath,"date-"+generated.sequenceId+".prproj");
  await fs.writeFile(path,generated.bytes.buffer);
  if(!await state.project.importSequences(P.native(path),[ppro.Guid.fromString(generated.sequenceId)]))throw new Error("Premiere could not import the native date title.");
  const source=await state.project.getSequence(ppro.Guid.fromString(generated.sequenceId));
  const title=(await items(source,1))[0];if(!title)throw new Error("Imported native title is missing.");
  return {source,title};
}
async function apply(entry,sourceItem,saveAttempt){
  let state=await snapshot(entry.target);
  if(state.ledger.imports.some(r=>r.key===entry.key))return {reused:true};
  if(entry.attempt)throw new Error("An interrupted sequence append needs review. Existing edits were preserved; automatic retry is disabled.");
  const media=ppro.ClipProjectItem.cast(sourceItem);if(!media||await media.isSequence()||await media.isOffline())throw new Error("Sequence append needs online source video.");
  const timing=await require("./marker-state").timing(sourceItem),fps=(await media.getFootageInterpretation()).getFrameRate();
  if(!require("../core/footage-dates").fullRange({...timing,inPoint:(await media.getInPoint(ppro.Constants.MediaType.VIDEO)).seconds,outPoint:(await media.getOutPoint(ppro.Constants.MediaType.VIDEO)).seconds,fps}))throw new Error("Source In/Out points changed. Clear them before appending the whole footage clip.");
  if(state.video.some(v=>P.key(v.path)===P.key(entry.path)))throw new Error("This source already appears on V1 without a Footage Sync receipt. Review the sequence before appending it.");
  const fillGeometry=await Fill.geometry(sourceItem,state.sequence);
  const requestedName=P.basename(P.dirname(entry.path))||entry.date,legacy="Footage Sync date "+entry.date;
  const managedNames=new Set([requestedName,legacy,...state.ledger.imports.filter(r=>r.date===entry.date&&Math.abs(r.end-state.end)<0.000001).map(r=>r.titleName).filter(Boolean)]);
  const adjacent=state.titles.filter(t=>managedNames.has(t.name)&&Math.abs(t.end-state.end)<0.000001&&state.ledger.imports.some(r=>r.date===entry.date&&Math.abs(r.end-t.end)<0.000001));
  const name=adjacent.length===1&&adjacent[0].name!==legacy?adjacent[0].name:requestedName;
  if(state.titles.some(t=>t.start>=state.end&&t.end>state.end))throw new Error("V2 contains an edit beyond the footage end.");
  let generated;
  try{
    if(adjacent.length!==1)generated=await nativeTitle(state,entry.date);
    // Importing a temporary sequence must not change the user's target timeline.
    const fresh=await snapshot(entry.target);if(fresh.fingerprint!==state.fingerprint)throw new Error("The target sequence changed while preparing its title. Scan again.");state=fresh;
    entry.attempt={start:state.end,fingerprint:state.fingerprint};await saveAttempt();
    transact(state.project,"Footage Sync: append footage",()=>[ppro.SequenceEditor.getEditor(state.sequence).createInsertProjectItemAction(sourceItem,tick(state.end),0,0,true)]);
    const afterVideo=await snapshot(entry.target),placed=afterVideo.video.filter(v=>P.key(v.path)===P.key(entry.path)&&Math.abs(v.start-state.end)<0.000001);
    if(placed.length!==1||placed[0].end<=placed[0].start)throw new Error("Appended footage could not be verified. No automatic retry will run.");
    const frameDuration=Number(await state.sequence.getTimebase())/254016000000;
    if(!Number.isFinite(frameDuration)||Math.abs(placed[0].end-placed[0].start-timing.duration)>frameDuration+0.000001)throw new Error("Premiere did not append the full source duration. Review the sequence before retrying.");
    const fill=await Fill.prepare(placed[0].item,fillGeometry.scale);
    const end=placed[0].end,record={key:entry.key,path:entry.path,date:entry.date,titleName:name,fillScale:fillGeometry.scale,start:state.end,end};
    const ledger={version:1,imports:[...state.ledger.imports,record]},receipt=await receiptAction(state.item,ledger);
    if(adjacent.length===1){
      transact(state.project,"Footage Sync: extend date",()=>[...fill.actions(),adjacent[0].item.createSetEndAction(tick(end)),adjacent[0].item.createSetNameAction(name),receipt()]);
    }else{
      transact(state.project,"Footage Sync: add date",()=>[ppro.SequenceEditor.getEditor(state.sequence).createCloneTrackItemAction(generated.title,tick(state.end),0,0,true,false)]);
      const titles=(await snapshot(entry.target)).titles.filter(t=>Math.abs(t.start-state.end)<0.000001);
      if(titles.length!==1)throw new Error("Native date title could not be verified.");
      transact(state.project,"Footage Sync: finalize date",()=>[...fill.actions(),titles[0].item.createSetEndAction(tick(end)),titles[0].item.createSetNameAction(name),receipt()]);
    }
    for(let attempt=0;attempt<11;attempt++){
      const verified=await snapshot(entry.target);
      if(verified.ledger.imports.some(r=>r.key===entry.key)&&verified.titles.some(t=>t.name===name&&t.start<=state.end&&Math.abs(t.end-end)<0.000001)&&await fill.verified())return {appended:true};
      if(attempt<10)await new Promise(r=>setTimeout(r,100));
    }
    throw new Error("Sequence append receipt was not confirmed. Automatic retry is disabled.");
  }finally{
    // Only the just-generated, media-free source sequence is eligible for removal.
    if(generated?.source){const id=String(generated.source.guid);if(!await state.project.deleteSequence(generated.source)||(await state.project.getSequences()).some(s=>String(s.guid)===id))throw new Error("The generated title's temporary sequence could not be removed. The appended footage will not be replayed automatically.");}
  }
}
async function keep(entry){
  const state=await snapshot(entry.target);if(state.ledger.imports.some(r=>r.key===entry.key))return;
  const receipt=await receiptAction(state.item,{version:1,imports:[...state.ledger.imports,{key:entry.key,path:entry.path,date:entry.date,kept:true}]});transact(state.project,"Footage Sync: keep current sequence",()=>[receipt()]);
  for(let i=0;i<11;i++){if((await snapshot(entry.target)).ledger.imports.some(r=>r.key===entry.key))return;if(i<10)await new Promise(r=>setTimeout(r,100));}
  throw new Error("The sequence receipt could not be verified. Existing edits were preserved.");
}
module.exports={context,snapshot,apply,keep};
