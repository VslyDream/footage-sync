"use strict";
const P=require("../core/paths"),Core=require("../core/markers"),State=require("./marker-state"),Markers=require("./markers"),Import=require("./marker-import");
async function analyze({inventory,scans,plan,data,scanner}) {
  const media=new Map(),warnings=[],changes=[];
  for(const [linkId,scan] of Object.entries(scans))for(const file of scan.files) {
    const matches=inventory.clips.filter(c=>P.key(c.mediaPath)===P.key(file.path));
    media.set(P.key(file.path),{path:file.path,itemId:matches.length===1?matches[0].id:null,file,linkId,txts:scan.txts||[]});
  }
  for(const clip of inventory.clips)if(!media.has(P.key(clip.mediaPath)))media.set(P.key(clip.mediaPath),{path:clip.mediaPath,itemId:clip.id,txts:[]});
  for(const entry of media.values()) {
    const manual=data.markerSources?.[entry.itemId]||data.markerSources?.[P.key(entry.path)];
    let source;
    if(manual)source={...await scanner.txt(manual.path),revision:manual.revision};
    else if(data.settings.autoMarkers!==false) {
      const matches=Core.candidates(entry.path,entry.txts);
      if(matches.length>1){entry.markerIssue="Multiple matching TXT files. Choose a marker TXT manually.";warnings.push({...entry,message:entry.markerIssue});continue;}
      source=matches[0];
    }
    if(!source)continue;
    entry.markerSource=source;
    if(source.error){entry.markerIssue=source.error;warnings.push({path:entry.path,txtPath:source.path,message:source.error});continue;}
    // A source blocked by media/folder reconciliation cannot receive clip markers yet.
    if(plan.changes.some(c=>c.blocking&&P.key(c.path)===P.key(entry.path)))continue;
    let ledger={version:1,imports:[]},expected=null;
    if(entry.itemId)try{
      const item=inventory.handles.get(entry.itemId);ledger=(await State.read(item)).ledger;
      const timing=await State.timing(item),bad=source.markers.find(m=>m.seconds>=timing.duration);
      if(bad)throw new Error("Line "+bad.line+": time "+bad.seconds+"s is outside the source duration ("+timing.duration+"s).");
      expected=Import.stamp(await Markers.read(item));
    }catch(e){entry.markerIssue=e.message;warnings.push({path:entry.path,txtPath:source.path,message:e.message});continue;}
    const key=P.key(source.path),revision=source.revision||0;
    const last=ledger.imports[ledger.imports.length-1],done=last&&last.sourceKey===key&&last.signature===source.signature&&last.revision===revision;
    if(done&&!ledger.pending){entry.markerState="applied";continue;}
    const observed=data.markerObserved?.[entry.itemId];
    const choice=Boolean(ledger.pending||ledger.imports.length||observed);
    entry.markerState=choice?"review":"pending";
    changes.push({kind:choice?"marker-choice":"clip-markers",path:entry.path,itemId:entry.itemId,linkId:entry.linkId,source,file:entry.file,expected,blocking:choice,pendingMode:ledger.pending?.mode,message:ledger.pending?"An interrupted or undone marker import needs review.":choice?"Choose Replace, Add to existing, or Skip TXT. Replace removes all markers on this source clip.":source.markers.length+" markers from "+P.basename(source.path)});
  }
  return {media:[...media.values()],warnings,changes};
}
module.exports={analyze,apply:Import.apply};
