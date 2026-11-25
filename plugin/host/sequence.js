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
async function readLedger(item){
  return parseLedger(new XMPMeta(await ppro.Metadata.getProjectMetadata(item)));
}
function parseLedger(meta){
  const raw=meta.getProperty(NS,FIELD)?.value;
  const ledger=raw?JSON.parse(String(raw)):{version:1,imports:[]};
  if(ledger.version!==1||!Array.isArray(ledger.imports)||ledger.imports.some(r=>typeof r.key!=="string"))throw new Error("Sequence import receipts are invalid. Existing edits were preserved.");
  return ledger;
}
async function readReceipts(target){
  const {sequence}=await context(target);
  return readLedger(await sequence.getProjectItem());
}
async function readTrack(sequence,index,predicate){
  const result=[];
  let nextYield=Date.now()+25;
  for(const item of await items(sequence,index)){
    if(!predicate || await predicate(item))result.push(await describe(item));
    if(Date.now()>=nextYield){
      await new Promise(resolve=>setTimeout(resolve,0));
      nextYield=Date.now()+25;
    }
  }
  return result;
}
const near=(a,b)=>Math.abs(a-b)<0.000001;
const trackSignature=clips=>clips.map(({item,...details})=>details);
function matchesLegacyTitle(title,state,entry){
  if(title.path||title.start>=title.end)return false;
  const receipts=state.ledger.imports.filter(r=>r.date===entry.date&&r.path&&!r.kept);
  const legacyName="Footage Sync date "+entry.date;
  const tail=receipts.filter(r=>near(r.end,title.end));
  if(tail.length!==1||tail[0].titleItemId||
    (title.name!==legacyName&&title.name!==(tail[0].titleName||P.basename(P.dirname(tail[0].path)))))return false;
  // Old receipts have no title identity. Require a unique continuous range
  // of those receipts, each backed by its original V1 placement.
  const block=state.video.filter(v=>v.end>title.start&&!near(v.end,title.start)&&v.start<title.end&&!near(v.start,title.end))
    .sort((a,b)=>a.start-b.start);
  let next=title.start;
  for(const clip of block){
    if(!near(clip.start,next)||clip.end<=clip.start||receipts.filter(r=>P.key(r.path)===P.key(clip.path)&&near(r.start,clip.start)&&near(r.end,clip.end)).length!==1)
      return false;
    next=clip.end;
  }
  return near(next,title.end);
}
function startingAt(sequence,index,start){
  return readTrack(sequence,index,async item=>near((await item.getStartTime()).seconds,start));
}
async function snapshot(target){
  const {project,sequence}=await context(target),item=await sequence.getProjectItem(),ledger=await readLedger(item);
  const video=await readTrack(sequence,0),titles=await readTrack(sequence,1);
  const end=(await sequence.getEndTime()).seconds;
  const fingerprint=JSON.stringify([String(project.guid),String(sequence.guid),end,trackSignature(video),trackSignature(titles),ledger]);
  return {project,sequence,item,ledger,video,titles,end,fingerprint};
}
async function receiptAction(item,ledger,expected){
  await ppro.Metadata.addPropertyToProjectMetadataSchema(FIELD,"Footage Sync sequence imports",ppro.Constants.MetadataType.TEXT);
  const meta=new XMPMeta(await ppro.Metadata.getProjectMetadata(item));
  if(expected && JSON.stringify(parseLedger(meta))!==JSON.stringify(expected))
    throw new Error("The sequence receipts changed during insertion. Review the timeline before continuing.");
  meta.setProperty(NS,FIELD,JSON.stringify(ledger));
  const xml=meta.serialize();return ()=>ppro.Metadata.createSetProjectMetadataAction(item,xml,[FIELD]);
}
function transact(project,label,actions){let ok=false;project.lockedAccess(()=>{ok=project.executeTransaction(c=>{for(const a of actions())c.addAction(a);},label);});if(!ok)throw new Error(label+" failed. No retry is performed automatically.");}
async function nativeTitle(state,date){
  const frame=await state.sequence.getFrameSize(),height=Number(frame.height||frame.bottom-frame.top),width=Number(frame.width||frame.right-frame.left);
  const generated=Native.generate(date,height,width),temp=await require("uxp").storage.localFileSystem.getTemporaryFolder();
  const path=P.join(temp.nativePath,"date-"+generated.sequenceId+".prproj");
  await fs.writeFile(path,generated.bytes.buffer);
  if(!await state.project.importSequences(P.native(path),[ppro.Guid.fromString(generated.sequenceId)]))throw new Error("Premiere could not import the native date title.");
  return state.project.getSequence(ppro.Guid.fromString(generated.sequenceId));
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
  const requestedName=P.basename(P.dirname(entry.path))||entry.date;
  const adjacent=state.titles.filter(t=>near(t.end,state.end)&&(
    t.id&&state.ledger.imports.some(r=>r.date===entry.date&&r.titleName===t.name&&r.titleItemId===t.id&&near(r.titleStart,t.start)&&near(r.end,t.end)) ||
    matchesLegacyTitle(t,state,entry)));
  const titleIndex=adjacent.length===1?state.titles.indexOf(adjacent[0]):-1;
  const name=titleIndex>=0&&adjacent[0].name!=="Footage Sync date "+entry.date?adjacent[0].name:requestedName;
  if(state.titles.some(t=>t.end>state.end&&!near(t.end,state.end)))throw new Error("V2 contains an edit beyond the footage end.");
  let source, failure;
  try{
    let generatedTitle;
    if(titleIndex<0){
      source=await nativeTitle(state,entry.date);
      generatedTitle=source&&(await items(source,1))[0];
      if(!generatedTitle)throw new Error("Imported native title is missing.");
    }
    entry.attempt={start:state.end,fingerprint:state.fingerprint};await saveAttempt();
    // Both title preparation and the durable write let the editor work. Check
    // the reviewed target again after both waits, immediately before insertion.
    const fresh=await snapshot(entry.target);
    if(fresh.fingerprint!==state.fingerprint)throw new Error("The target sequence changed before insertion. Review the sequence again.");
    state=fresh;
    transact(state.project,"Footage Sync: append footage",()=>[ppro.SequenceEditor.getEditor(state.sequence).createInsertProjectItemAction(sourceItem,tick(state.end),0,0,true)]);
    const placed=(await startingAt(state.sequence,0,state.end)).filter(v=>P.key(v.path)===P.key(entry.path));
    if(placed.length!==1||placed[0].end<=placed[0].start)throw new Error("Appended footage could not be verified. No automatic retry will run.");
    const frameDuration=Number(await state.sequence.getTimebase())/254016000000;
    if(!Number.isFinite(frameDuration)||Math.abs(placed[0].end-placed[0].start-timing.duration)>frameDuration+0.000001)throw new Error("Premiere did not append the full source duration. Review the sequence before retrying.");
    const fill=await Fill.prepare(placed[0].item,fillGeometry.scale);
    const end=placed[0].end;
    const titlesBefore=await readTrack(state.sequence,1);
    if(JSON.stringify(trackSignature(titlesBefore))!==JSON.stringify(trackSignature(state.titles))||
      !near((await state.sequence.getEndTime()).seconds,end))
      throw new Error("The target sequence changed after footage insertion. Review the timeline before continuing.");
    let title=titlesBefore[titleIndex];
    if(!title){
      transact(state.project,"Footage Sync: add date",()=>[ppro.SequenceEditor.getEditor(state.sequence).createCloneTrackItemAction(generatedTitle,tick(state.end),0,0,true,false)]);
      const titles=await startingAt(state.sequence,1,state.end);
      if(titles.length!==1)throw new Error("Native date title could not be verified.");
      title=titles[0];
    }
    const record={key:entry.key,path:entry.path,date:entry.date,titleName:name,titleItemId:title.id,titleStart:title.start,fillScale:fillGeometry.scale,start:state.end,end};
    const ledger={version:1,imports:[...state.ledger.imports,record]},receipt=await receiptAction(state.item,ledger,state.ledger);
    const currentTitles=await startingAt(state.sequence,1,title.start);
    if(currentTitles.length!==1||JSON.stringify(trackSignature(currentTitles))!==JSON.stringify(trackSignature([title])))
      throw new Error("The date title changed during insertion. Review the timeline before continuing.");
    const currentTitle=currentTitles[0].item;
    transact(state.project,titleIndex>=0?"Footage Sync: extend date":"Footage Sync: finalize date",()=>[...fill.actions(),currentTitle.createSetEndAction(tick(end)),currentTitle.createSetNameAction(name),receipt()]);
    for(let attempt=0;attempt<11;attempt++){
      if((await readLedger(state.item)).imports.some(r=>r.key===entry.key)){
        const titles=await readTrack(state.sequence,1,async item=>near((await item.getEndTime()).seconds,end));
        if(titles.some(t=>t.name===name&&t.start<=state.end)&&await fill.verified())return {appended:true};
      }
      if(attempt<10)await new Promise(r=>setTimeout(r,100));
    }
    throw new Error("Sequence append receipt was not confirmed. Automatic retry is disabled.");
  }catch(e){
    failure=e;
    throw e;
  }finally{
    // Only the just-generated, media-free source sequence is eligible for removal.
    if(source){
      try{
        const id=String(source.guid);
        if(!await state.project.deleteSequence(source)||(await state.project.getSequences()).some(s=>String(s.guid)===id))
          throw new Error("The generated title's temporary sequence could not be removed.");
      }catch(e){
        if(failure)throw new Error(failure.message+" Temporary title cleanup also failed: "+e.message,{cause:failure});
        throw e;
      }
    }
  }
}
async function keep(entry){
  const state=await snapshot(entry.target);if(state.ledger.imports.some(r=>r.key===entry.key))return;
  const receipt=await receiptAction(state.item,{version:1,imports:[...state.ledger.imports,{key:entry.key,path:entry.path,date:entry.date,kept:true}]});transact(state.project,"Footage Sync: keep current sequence",()=>[receipt()]);
  for(let i=0;i<11;i++){if((await readLedger(state.item)).imports.some(r=>r.key===entry.key))return;if(i<10)await new Promise(r=>setTimeout(r,100));}
  throw new Error("The sequence receipt could not be verified. Existing edits were preserved.");
}
module.exports={context,snapshot,readReceipts,apply,keep};
