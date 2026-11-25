"use strict";
const H=require("./host/premiere"), Store=require("./host/store"), P=require("./core/paths"), {Scanner}=require("./host/filesystem"), {planSync,groupBy}=require("./core/planner"), Markers=require("./host/marker-service");
const {Progress}=require("./core/progress");
const {willAppend}=require("./core/process-view");
const Dates=require("./core/footage-dates");
const Ignore=require("./core/ignore");
const {countChanges}=require("./core/changes-view");
const sequenceChange=c=>["append-footage","sequence-review","sequence-error"].includes(c.kind);
function emptyMarkerReceipts(previous,warnings,inventory){
  const empty=(warnings||[]).filter(w=>w.emptyVersion);
  if(!empty.length)return previous;
  const clips=new Map();
  for(const clip of inventory.clips){
    const key=P.key(clip.mediaPath);
    clips.set(key,clips.has(key)?null:clip.id);
  }
  let receipts=previous;
  for(const warning of empty){
    const itemId=clips.get(P.key(warning.path));
    if(!itemId||(warning.itemId&&warning.itemId!==itemId)||receipts?.[itemId]===warning.emptyVersion)continue;
    if(receipts===previous)receipts={...previous};
    receipts[itemId]=warning.emptyVersion;
  }
  return receipts;
}
class Controller {
  constructor() { this.data=Store.defaults(); this.scanner=new Scanner(); this.project=null; this.path=""; this.busy=false; this.batch=null; this.error=null; this.listeners=[]; this.ticks=0; this.visible=false; this.dialogOpen=false; this.markerFailures=new Map(); }
  onChange(fn) { this.listeners.push(fn); }
  begin(label) { this.busy=true;this.operation=new Progress(label);this.lastProgressEmit=0;this.emit(); }
  progress(phase,detail) {
    if(!this.busy||!this.operation)return;
    const changed=this.operation.phase!==phase || (detail?.unit==="videos" && this.operation.completed!==detail.completed);this.operation.update(phase,detail);
    if(changed||Date.now()-this.lastProgressEmit>100){this.lastProgressEmit=Date.now();this.emit();}
  }
  warn(message,path) {
    if(Ignore.matches(path,this.data.ignored))return;
    if(!this.busy||!this.operation)return;
    const count=this.operation.warnings.length;this.operation.warn(message,path);
    if(this.operation.warnings.length!==count)this.emit();
  }
  async finish(error,background=false) {
    this.operation?.finish(error);this.busy=false;
    if(background&&!error&&this.lastOperation?.status==="failed"&&this.lastOperation.label==="Scan"&&this.lastOperation.phase==="Opening project")this.lastOperation=null;
    if(background&&!error&&!this.operation?.warnings.length)this.operation=this.lastOperation||this.operation;
    else this.lastOperation=this.operation;
    this.emit();await this.diagnostics();
  }
  emit() { this.listeners.forEach(f=>f()); }
  async context() {
    this.workspace??=await Store.loadWorkspace();
    const project=await H.resolveProject(this.workspace.importProject);
    if(!project || !project.path) { this.project=null;this.projectId="";this.path="";this.data=Store.defaults();this.batch=null;this.lastOperation=null;return null; }
    // Read identity only from the freshly resolved object; the previous native
    // wrapper may already be invalid and throw even when reading its guid.
    const id=String(project.guid),path=P.clean(project.path);
    if(P.key(path)!==P.key(this.path)||id!==this.projectId) { this.data=await Store.load(path);this.path=path;this.batch=null;this.error=null;this.lastOperation=null;this.markerFailures.clear(); }
    this.project=project;this.projectId=id;return project;
  }
  async selectProject(binding) {
    if(this.busy)throw new Error("Wait for the current sync to finish before choosing an import project.");
    const project=await H.resolveProject(binding),data=await Store.load(project.path);
    const workspace={version:1,importProject:{path:P.clean(project.path),name:project.name}};
    await Store.saveWorkspace(workspace);this.workspace=workspace;this.project=project;this.projectId=String(project.guid);this.path=P.clean(project.path);this.data=data;
    this.batch=null;this.error=null;this.lastOperation=null;this.operation=null;this.markerFailures.clear();this.emit();
  }
  async selectSequence(target){
    if(this.busy)throw new Error("Wait for the current sync to finish.");
    if(!await this.context())throw new Error("Choose an import project first.");
    if((this.data.sequenceQueue||[]).some(e=>!Ignore.matches(e.path,this.data.ignored)))throw new Error("Finish pending sequence appends before changing the destination.");
    if(target)await require("./host/sequence").context(target);
    const previous=this.data.settings.sequenceTarget,enabled=this.data.settings.sequenceEnabled;this.data.settings.sequenceTarget=target;
    if(enabled===undefined)this.data.settings.sequenceEnabled=Boolean(target);
    try{await this.persist();}catch(e){this.data.settings.sequenceTarget=previous;this.data.settings.sequenceEnabled=enabled;throw e;}
    this.batch=null;this.emit();
  }
  async setSequenceEnabled(enabled){
    if(this.busy)throw new Error("Wait for the current sync to finish.");
    if(!await this.context())throw new Error("Choose an import project first.");
    const previous=this.data.settings.sequenceEnabled;this.data.settings.sequenceEnabled=Boolean(enabled);
    try{await this.persist();}catch(e){this.data.settings.sequenceEnabled=previous;throw e;}
    this.batch=null;this.emit();
  }
  async setIgnored(value,remove=false){
    if(this.busy)throw new Error("Wait for the current sync to finish.");
    if(!await this.context())throw new Error("Choose an import project first.");
    const rule={...Ignore.rule(value),...(value.linkId?{linkId:value.linkId,origin:"excluded"}:{})},previous=this.data.ignored||[],same=r=>r.kind===rule.kind&&P.key(r.path)===P.key(rule.path);
    this.data.ignored=remove?previous.filter(r=>!same(r)):previous.some(same)?previous:[...previous,rule];
    try{await this.persist();}catch(e){this.data.ignored=previous;throw e;}
    if(!remove)for(const op of new Set([this.operation,this.lastOperation]))if(op){
      op.warnings=op.warnings.filter(w=>!Ignore.matches(w.path,this.data.ignored));
      op.errors=op.errors.filter(e=>!Ignore.matches(e.current,this.data.ignored));
      if(op.status==="warnings"&&!op.warnings.length)op.status="completed";
      if(op.status==="failed"&&!op.errors.length){op.status=op.warnings.length?"warnings":"completed";this.error=null;}
    }
    this.batch=null;this.emit();
  }
  async setExcluded(link,paths){
    if(this.busy)throw new Error("Wait for the current sync to finish.");
    if(!await this.context())throw new Error("Choose an import project first.");
    const root=P.resolve(P.dirname(this.path),link.folderPath),previous=this.data.ignored||[];
    const rules=paths.map(path=>({...Ignore.rule({kind:"folder",path}),linkId:link.id,origin:"excluded"}));
    if(rules.some(r=>P.key(r.path)===P.key(root)||!P.within(r.path,root)))throw new Error("Only subfolders of this link can be excluded.");
    this.data.ignored=[...previous.filter(r=>!(r.kind==="folder"&&P.key(r.path)!==P.key(root)&&P.within(r.path,root))),...rules];
    try{await this.persist();}catch(e){this.data.ignored=previous;throw e;}
    this.batch=null;this.emit();
  }
  async sequencePlan(plan,scans,path){
    const target=this.data.settings.sequenceTarget,enabled=Dates.enabled(this.data.settings);
    plan.sequenceWarnings=[];
    if(!enabled)return {enabled:false,target};
    const skipped=new Set(this.data.sequenceSkipped||[]),queued=new Map((this.data.sequenceQueue||[]).filter(e=>!skipped.has(e.key)&&!Ignore.matches(e.path,this.data.ignored)).map(e=>[e.key,e]));
    for(const change of plan.changes.filter(c=>["new-file","fragmented"].includes(c.kind)&&Dates.VIDEO.test(c.path))){
      const key=P.key(path)+"|"+P.key(change.path)+"|"+(change.file.identity||change.file.size+":"+change.file.mtime);
      if(skipped.has(key))continue;
      try{
        const label=Dates.folderLabel(change.path);
        queued.set(key,queued.get(key)||{key,path:change.path,date:label.text,labelKind:label.kind,target});
        if(label.warning){plan.sequenceWarnings.push({path:change.path,message:label.warning});this.warn(label.warning,change.path);}
      }catch(e){plan.changes.push({id:String(plan.changes.length),kind:"sequence-error",blocking:true,path:change.path,entry:{key,path:change.path,target},message:e.message});}
    }
    const observed=(this.data.sequenceObserved||[]).filter(entry=>!Ignore.matches(entry.path,this.data.ignored)&&!skipped.has(entry.key)&&JSON.stringify(entry.target)===JSON.stringify(target));
    let state,error;
    this.progress("Checking Footage sequence");
    try{
      if(!target)throw new Error("Choose the Footage sequence in Links, or import files only.");
      const Sequence=require("./host/sequence");
      // Idle polling only needs to detect Undo/lost receipts. Take the full
      // reviewed timeline fingerprint whenever an append decision is possible.
      if(!queued.size){
        const saved=new Set((await Sequence.readReceipts(target)).imports.map(r=>r.key));
        if(observed.every(entry=>saved.has(entry.key)))return {enabled:true,target};
      }
      state=await Sequence.snapshot(target);
    }catch(e){error=e.message;}
    const sourcesByPath=new Map();
    if(queued.size && !error){
      for(const [linkId,scan] of Object.entries(scans)){
        for(const file of scan.files||[]){
          const key=P.key(file.path);
          if(!sourcesByPath.has(key))sourcesByPath.set(key,{linkId,file});
        }
      }
    }
    for(const entry of [...queued.values()].sort(Dates.compare)){
      const fail=message=>{plan.changes.push({id:String(plan.changes.length),kind:"sequence-error",blocking:true,path:entry.path,entry,message});this.warn(message,entry.path);};
      if(error){fail(error);continue;}
      if(JSON.stringify(entry.target)!==JSON.stringify(target)){fail("This pending append belongs to another sequence target. Keep or skip it before changing destinations.");continue;}
      if(state.ledger.imports.some(r=>r.key===entry.key)){
        if((this.data.sequenceQueue||[]).some(e=>e.key===entry.key))plan.changes.push({id:String(plan.changes.length),kind:"append-footage",checkpoint:true,path:entry.path,date:entry.date,entry,message:"Confirm the completed sequence append. Existing edits are preserved."});
        continue;
      }
      const source=sourcesByPath.get(P.key(entry.path));
      if(!source){fail("The pending sequence source is unavailable. Import files only to skip its append: "+entry.path);continue;}
      const review=Boolean(entry.attempt||entry.failure);
      plan.changes.push({id:String(plan.changes.length),kind:review?"sequence-review":"append-footage",blocking:review,path:entry.path,date:entry.date,entry,...source,message:review?(entry.failure||"An interrupted append needs review. Existing edits will not be duplicated automatically."):"Append to "+target.sequenceName+" · "+entry.date+" on V2"});
    }
    if(state)for(const entry of observed)if(!state.ledger.imports.some(r=>r.key===entry.key)&&!queued.has(entry.key)){
      plan.changes.push({id:String(plan.changes.length),kind:"sequence-review",blocking:true,path:entry.path,date:entry.date,entry,message:"A previous sequence receipt was undone or not saved. Keep the current sequence, append again, or import files only."});
    }
    return {enabled:true,target,fingerprint:state?.fingerprint,error};
  }

  async assertContext(path,id=this.projectId) {
    const p=await H.resolveProject(this.workspace?.importProject);
    if(!p||P.key(p.path)!==P.key(path)||String(p.guid)!==id)throw new Error("The selected import project changed or was reopened. Scan again.");
    this.project=p;
  }
  async analyze(links) {
    this.progress("Opening project");
    const project=await this.context(); if(!project) throw new Error("Choose the import project in Links before syncing.");
    links??=this.data.links;
    this.progress("Reading Premiere project");
    const path=this.path,projectId=String(project.guid), inv=await H.inventory(project,detail=>this.progress("Reading Premiere project",detail)), scans={};
    for(const link of links) if(!link.paused) {
      this.progress("Scanning folders",{current:link.folderPath});
      const root=P.resolve(P.dirname(path),link.folderPath);
      scans[link.id]=Ignore.matches(root,this.data.ignored)?{root,files:[],dirs:[],txts:[],ignored:true}:Ignore.scan(await this.scanner.scan(link,path,detail=>this.progress("Scanning folders",detail),this.data.ignored),this.data.ignored);
      // Remember a successful observation without writing the sidecar every poll.
      // It is persisted with the next explicit settings/link/sync checkpoint.
      if(!scans[link.id].error&&!scans[link.id].ignored)link.lastAvailable=new Date().toISOString();
      if(scans[link.id].error)this.warn(scans[link.id].error,link.folderPath);
      for(const file of scans[link.id].files)if(file.issue)this.warn(file.issue,file.path);
    }
    await this.assertContext(path,projectId);
    this.progress("Comparing disk and Premiere");
    const plan=planSync({links,scans,inventory:inv,records:Ignore.records(this.data.records,links,path,this.data.ignored)});
    for(const change of plan.changes) if(change.kind==="fragmented" && this.data.settings.mp4==="NONE") change.blocking=false;
    this.progress("Checking marker TXT files");
    const markers=await Markers.analyze({inventory:inv,scans,plan,data:this.data,scanner:this.scanner,onProgress:detail=>this.progress("Checking marker TXT files",detail)});
    for(const change of markers.changes) {
      const failure=this.markerFailures.get(P.key(change.path)),signature=JSON.stringify([change.source.signature,change.source.revision]);
      if(failure?.signature===signature)markers.warnings.push({path:change.path,txtPath:change.source.path,message:failure.message});
      else plan.changes.push({...change,id:String(plan.changes.length)});
    }
    await this.assertContext(path,projectId);
    for(const change of plan.changes)if(["conflict","unavailable","media-error"].includes(change.kind))this.warn(change.message||change.kind,change.path);
    for(const warning of markers.warnings)this.warn(warning.message,warning.txtPath||warning.path);
    const timeline=await this.sequencePlan(plan,scans,path);
    plan.hasBlocking=plan.changes.some(c=>c.blocking);
    return {...plan,links,scans,inventory:inv,projectPath:path,projectId,timeline,media:markers.media.map(m=>({...m,projectPath:path,projectId})),warnings:markers.warnings};
  }
  async scan(links,background=false) {
    if(this.busy) {if(links)throw new Error("Wait for the current sync to finish before analyzing links.");return this.batch;}
    this.begin(links?"Analyze links":"Scan");let failure;
    try { const batch=await this.analyze(links);if(!links)this.batch=batch;this.error=null;return batch; }
    catch(e) { failure=e.message;this.error=e.message; throw e; }
    finally { await this.finish(failure,background); }
  }
  async persist(data=this.data) {
    const path=this.path;
    if(!path)throw new Error("No saved project is open.");
    await this.assertContext(path);
    await Store.save(path,data);
  }
  async acknowledgeMarkerWarnings(batch){
    if(this.busy||!batch||batch!==this.batch||batch.projectId!==this.projectId||P.key(batch.projectPath)!==P.key(this.path))return;
    const previous=this.data.emptyMarkerReceipts;
    const receipts=emptyMarkerReceipts(previous,batch.warnings,batch.inventory);
    if(receipts===previous)return;
    this.busy=true;
    try{
      await this.persist({...this.data,emptyMarkerReceipts:receipts});
      this.data.emptyMarkerReceipts=receipts;
      batch.warnings=batch.warnings.filter(w=>!w.emptyVersion||receipts[w.itemId]!==w.emptyVersion);
    }finally{this.busy=false;this.emit();}
  }
  async apply(batch,selected,decisions={},options={}) {
    if(this.busy) throw new Error("A sync is already running.");
    this.begin("Sync");let failure,run,historySaved=false,mutationStarted=false;const completedChanges=[];
    try {
      await this.assertContext(batch.projectPath,batch.projectId);
      // Reanalyze immediately before mutation. A review decision applies only to the reviewed plan.
      const fresh=await this.analyze(batch.links);
      run={time:new Date().toISOString(),trigger:options.trigger||"Sync",project:this.project.name,sequence:this.data.settings.sequenceTarget?.sequenceName,reused:(fresh.reused||[]).filter(r=>r.kind==="file").length};
      const filesOnly=options.filesOnly===true;
      const signature=b=>JSON.stringify([filesOnly?null:b.timeline,b.changes.filter(c=>!filesOnly||!sequenceChange(c)).map(c=>[c.kind,c.path,c.from,c.target,c.itemId,c.file?.size,c.file?.mtime,c.file?.identity,c.source?.path,c.source?.signature,c.source?.revision,c.source?.size,c.source?.mtime,c.source?.identity,c.expected,c.pendingMode,c.entry?.key,c.entry?.attempt,c.entry?.failure,c.checkpoint])]);
      if(signature(fresh)!==signature(batch)) throw new Error("Sources or project changed after analysis. Review the updated batch.");
      const chosen=(selected ? fresh.changes.filter(c=>selected.includes(c.id)) : fresh.changes).filter(c=>!filesOnly||!sequenceChange(c));
      for(const c of chosen) {
        const target=c.kind==="new-folder"?P.dirname(c.path):c.target;
        if(target&&fresh.changes.some(parent=>parent.kind==="new-folder"&&parent!==c&&P.within(target,parent.path)&&!chosen.some(v=>v.id===parent.id)))throw new Error("Select the required parent bin before applying this change: "+c.path);
        if(["append-footage","sequence-review"].includes(c.kind)&&decisions[c.id]!=="keep"&&!c.checkpoint){
          const source=fresh.changes.find(m=>["new-file","fragmented"].includes(m.kind)&&P.key(m.path)===P.key(c.path));
          if(source&&!chosen.some(m=>m.id===source.id))throw new Error("Select and resolve the source import before appending its footage and title: "+c.path);
        }
        if(c.blocking && !(c.kind==="fragmented" && decisions[c.id]==="original") && !(c.kind==="marker-choice"&&["append","replace","skip"].includes(decisions[c.id]))&&!(c.kind==="sequence-review"&&["retry","keep"].includes(decisions[c.id]))) throw new Error("Resolve blocking items before syncing.");
        if(c.file) { const scan=fresh.scans[c.linkId]; if(!scan.files.some(f=>P.key(f.path)===P.key(c.path)&&f.size===c.file.size&&f.mtime===c.file.mtime)) throw new Error("Source changed after analysis."); }
      }
      const skipKeys=new Set(options.skipSequenceKeys||[]);
      for(const key of skipKeys)if(!fresh.changes.some(c=>sequenceChange(c)&&c.entry?.key===key&&!chosen.some(v=>v.id===c.id)))throw new Error("The sequence selection changed. Review the updated batch.");
      // Store links before mutation: if a later import fails, reconciliation can safely recover.
      const previousLinks=this.data.links;
      mutationStarted=true;
      this.data.links=batch.links;
      try { await this.persist(); } catch(e) { this.data.links=previousLinks; throw e; }
      let applied=0;const markerWarnings=[],sequenceWarnings=[];
      // Persist append intent before importing media; a failed/restarted run can
      // still append an item which now exists in the Footage project.
      const intents=filesOnly?[]:fresh.changes.filter(c=>sequenceChange(c)&&!skipKeys.has(c.entry?.key)&&typeof c.entry?.date==="string"&&chosen.some(v=>v.id===c.id||["new-file","fragmented"].includes(v.kind)&&P.key(v.path)===P.key(c.path)));
      const queue=new Map((this.data.sequenceQueue||[]).map(e=>[e.key,e]));
      if(filesOnly||skipKeys.size){
        const skipped=new Set(this.data.sequenceSkipped||[]);
        for(const c of fresh.changes.filter(c=>sequenceChange(c)&&c.entry&&(filesOnly||skipKeys.has(c.entry.key))&&(!fresh.changes.some(m=>["new-file","fragmented"].includes(m.kind)&&P.key(m.path)===P.key(c.path))||chosen.some(m=>["new-file","fragmented"].includes(m.kind)&&P.key(m.path)===P.key(c.path))))){skipped.add(c.entry.key);queue.delete(c.entry.key);}
        this.data.sequenceSkipped=[...skipped];
      }
      for(const c of intents)queue.set(c.entry.key,c.entry);
      this.data.sequenceQueue=[...queue.values()];if(intents.length)await this.persist();
      let completed=0, videosProcessed=0;
      const videoTotal=chosen.filter(change=>willAppend(change,decisions)).length;
      for(const change of chosen) {
        const detail={current:change.path,completed,total:chosen.length};
        const appending=willAppend(change,decisions);
        const timelineProgress=()=>this.progress("Appending to Footage sequence",{current:change.path,completed:videosProcessed,total:videoTotal,unit:"videos"});
        if(appending){
          timelineProgress();
          // An already-resolved host Promise may only enqueue a microtask.
          // Give Premiere/UXP a turn to paint and accept input between clips.
          await new Promise(resolve=>setTimeout(resolve,0));
        }else this.progress("Validating source",detail);
        await this.assertContext(batch.projectPath,batch.projectId);
        if(change.file) await this.scanner.validate(change.file);
        if(change.kind==="append-footage"||change.kind==="sequence-review"){
          if(!appending)this.progress("Checking Footage sequence",detail);
          const Sequence=require("./host/sequence"),entry=queue.get(change.entry.key)||change.entry;
          try{if(change.checkpoint){
            if(!(await Sequence.readReceipts(entry.target)).imports.some(r=>r.key===entry.key))throw new Error("The completed sequence receipt changed. Scan again.");
          }
          else if(decisions[change.id]==="keep")await Sequence.keep(entry);
          else{
            if(decisions[change.id]==="retry"){delete entry.attempt;delete entry.failure;}
            const inv=await H.inventory(this.project),matches=inv.clips.filter(c=>P.key(c.mediaPath)===P.key(entry.path));
            if(matches.length!==1)throw new Error("The sequence source was not found uniquely after import. Scan again: "+entry.path);
            await Sequence.apply(entry,inv.handles.get(matches[0].id),async()=>{this.data.sequenceQueue=[...queue.values()];await this.persist();});
          }
          queue.delete(entry.key);this.data.sequenceQueue=[...queue.values()];
          this.data.sequenceObserved=[...(this.data.sequenceObserved||[]).filter(e=>e.key!==entry.key),{key:entry.key,path:entry.path,date:entry.date,target:entry.target}];
          await this.persist();applied++;
          if(!change.checkpoint&&decisions[change.id]!=="keep"){const source=completedChanges.find(c=>P.key(c.path)===P.key(change.path)&&["new-file","fragmented"].includes(c.kind));if(source)source.timeline=true;else completedChanges.push({kind:"sequence-review",path:change.path,timeline:true});}
          }catch(e){
            await this.assertContext(batch.projectPath,batch.projectId);
            entry.failure=e.message;queue.set(entry.key,entry);this.data.sequenceQueue=[...queue.values()];await this.persist();
            sequenceWarnings.push({path:entry.path,message:e.message});this.warn("Media imported; sequence append needs review: "+e.message,entry.path);
          }
          if(appending){videosProcessed++;timelineProgress();}
          completed++;continue;
        }
        if(change.kind==="clip-markers"||change.kind==="marker-choice") {
          this.progress("Applying source clip markers",detail);
          try {
            const inv=await H.inventory(this.project),matches=inv.clips.filter(c=>P.key(c.mediaPath)===P.key(change.path));
            if(matches.length!==1){completed++;continue;} // Media may have been left unselected in Review.
            const itemId=matches[0].id,item=inv.handles.get(itemId),source=await this.scanner.txt(change.source.path);
            if(source.error)throw new Error(source.error);
            if(source.signature!==change.source.signature||source.identity!==change.source.identity||source.size!==change.source.size||source.mtime!==change.source.mtime)throw new Error("Marker TXT changed after review. Scan again.");
            await this.scanner.validate(source);
            // Durable observation precedes every marker attempt. If the project
            // was not saved or its receipt was undone, future Sync must ask.
            this.data.markerObserved??={};this.data.markerObserved[itemId]={attempt:{path:source.path,signature:source.signature,revision:change.source.revision||0}};
            await this.persist();
            const result=await Markers.apply(this.project,item,{...source,revision:change.source.revision},decisions[change.id]||"append",change.expected);
            this.data.markerObserved??={};this.data.markerObserved[itemId]=result.ledger;
            if(this.data.markerSources?.[P.key(change.path)]) {this.data.markerSources[itemId]=this.data.markerSources[P.key(change.path)];delete this.data.markerSources[P.key(change.path)];}
            applied+=result.added;await this.persist();if(result.added)completedChanges.push({kind:"clip-markers",path:change.path,txtPath:change.source.path,markers:result.added});
          }catch(e){
            await this.assertContext(batch.projectPath,batch.projectId);
            this.markerFailures.set(P.key(change.path),{signature:JSON.stringify([change.source.signature,change.source.revision]),message:e.message});
            markerWarnings.push({path:change.path,txtPath:change.source.path,message:e.message});
            this.warn(e.message,change.source.path);
          }
          completed++;
          continue;
        }
        this.progress("Checking project before change",detail);
        const before=["new-file","fragmented"].includes(change.kind)?null:await H.inventory(this.project);
        this.progress(change.kind==="new-folder"?"Creating bins":"Updating Premiere",detail);
        const verified=await H.applyChange(this.project,change,before,(phase,current)=>this.progress(phase,{...detail,current})); applied++;
        completedChanges.push({kind:change.kind,path:change.path,from:change.from});
        // Checkpoint verified mappings after each action so a later failure remains recoverable.
        this.progress("Saving verified progress",detail);
        this.checkpoint(fresh,verified||await H.inventory(this.project)); await this.persist();
        this.progress("Changes applied",{...detail,completed:++completed});
      }
      this.progress("Final project verification",{completed:chosen.length,total:chosen.length});
      const after=await H.inventory(this.project);
      this.checkpoint(fresh,after);
      // A deferred or failed import has no verified clip for its empty TXT.
      const receipts=emptyMarkerReceipts(this.data.emptyMarkerReceipts,fresh.warnings,after);
      this.data.history.unshift({...run,count:countChanges(completedChanges),changes:completedChanges,duration:Date.now()-this.operation.startedAt,status:"completed",message:applied?"Sync completed":fresh.changes.length?"No changes applied":"Everything is up to date"});historySaved=true;
      this.data.history=this.data.history.slice(0,30);
      await this.persist(receipts===this.data.emptyMarkerReceipts?this.data:{...this.data,emptyMarkerReceipts:receipts});
      if(receipts)this.data.emptyMarkerReceipts=receipts;
      this.error=null; this.batch=await this.analyze();
      this.progress("Sync finished",{completed:chosen.length,total:chosen.length});
    } catch(e) { failure=e.message;this.error=e.message;if(!historySaved&&this.path){this.data.history.unshift({...run,time:run?.time||new Date().toISOString(),count:countChanges(completedChanges),changes:completedChanges,duration:Date.now()-this.operation.startedAt,status:"failed",error:e.message,errorPath:this.operation.current,stage:this.operation.phase,message:"Sync failed"});this.data.history=this.data.history.slice(0,30);if(mutationStarted)try{await this.persist();}catch(_){/* Preserve the original failure. */}}throw e; }
    finally { await this.finish(failure); }
  }
  async chooseMarkers(entry,path) {
    if(this.busy)throw new Error("Wait for the current sync to finish.");
    if(entry.projectPath)await this.assertContext(entry.projectPath,entry.projectId);
    await this.context();this.data.markerSources??={};
    this.data.markerSources[entry.itemId||P.key(entry.path)]={path:P.clean(path),revision:Date.now()};
    this.markerFailures.delete(P.key(entry.path));await this.persist();
  }
  checkpoint(plan,after) {
    const owners=new Map();
    const clipsByPath = groupBy(after.clips, clip => P.key(clip.mediaPath));
    const binsByPath = groupBy(after.bins, bin => bin.path);
    for(const link of this.data.links) {
      const root=after.bins.find(b=>b.id===link.binId)||after.bins.find(b=>b.path===link.binPath);
      if(root) { link.binId=root.id; link.binPath=root.path; }
      const proposed=plan.next[link.id]; if(!proposed) continue;
      const old=this.data.records[link.id]||{files:[],dirs:[]};
      const files=new Map(old.files.filter(f=>f.itemId).map(f=>[f.itemId,f]));
      const dirs=new Map(old.dirs.filter(d=>d.binId).map(d=>[d.binId,d]));
      for(const f of proposed.files) {
        const matches=clipsByPath.get(P.key(f.path));
        if(matches?.length===1) { files.set(matches[0].id,{...f,itemId:matches[0].id}); owners.set(matches[0].id,link.id); }
      }
      for(const d of proposed.dirs) {
        const matches=binsByPath.get(d.binPath);
        if(matches?.length===1) dirs.set(matches[0].id,{...d,binId:matches[0].id});
      }
      this.data.records[link.id]={files:[...files.values()],dirs:[...dirs.values()]};
    }
    for(const [linkId,record] of Object.entries(this.data.records)) record.files=record.files.filter(f=>!owners.has(f.itemId)||owners.get(f.itemId)===linkId);
  }
  async diagnostics() {
    await Store.diagnostic({time:new Date().toISOString(),ticks:this.ticks,visible:this.visible,projectPath:this.path,busy:this.busy,operation:this.operation,error:this.error,links:this.data.links,batch:this.batch && {changes:this.batch.changes,reused:this.batch.reused,warnings:this.batch.warnings,media:this.batch.media},inventory:this.batch && {bins:this.batch.inventory.bins,clips:this.batch.inventory.clips},scans:this.batch?.scans});
  }
  start() {
    if(this.timer) return;
    this.timer=setInterval(async()=>{
      this.ticks++;
      if(this.busy||this.dialogOpen) return;
      try { await this.scan(undefined,true); if(this.data.settings.mode==="AUTO" && this.batch?.changes.length && !this.batch.hasBlocking) await this.apply(this.batch,undefined,{}, {trigger:"Automatic sync"}); }
      catch(e) { this.error=e.message; this.emit(); }
    },5000);
  }
  stop() { if(this.timer) clearInterval(this.timer); this.timer=null; }
}
module.exports={Controller};
