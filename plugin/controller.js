"use strict";
const H=require("./host/premiere"), Store=require("./host/store"), P=require("./core/paths"), {Scanner}=require("./host/filesystem"), {planSync}=require("./core/planner"), Markers=require("./host/marker-service");
class Controller {
  constructor() { this.data=Store.defaults(); this.scanner=new Scanner(); this.project=null; this.path=""; this.busy=false; this.batch=null; this.error=null; this.listeners=[]; this.ticks=0; this.visible=false; this.dialogOpen=false; this.markerFailures=new Map(); }
  onChange(fn) { this.listeners.push(fn); }
  emit() { this.listeners.forEach(f=>f()); }
  async context() {
    const project=await H.ppro.Project.getActiveProject();
    if(!project || !project.path) { this.project=null; this.path=""; this.data=Store.defaults(); this.batch=null; return null; }
    if(P.key(project.path)!==P.key(this.path)||String(project.guid)!==String(this.project?.guid)) { this.data=await Store.load(project.path); this.path=project.path; this.batch=null; this.error=null; this.markerFailures.clear(); }
    this.project=project; return project;
  }
  async assertContext(path,id=String(this.project?.guid)) { const p=await H.ppro.Project.getActiveProject(); if(!p || P.key(p.path)!==P.key(path)||String(p.guid)!==id) throw new Error("The active project changed. Open the linked project and scan again."); }
  async analyze(links=this.data.links) {
    const project=await this.context(); if(!project) throw new Error("Open the Footage project in Premiere before adding links.");
    const path=this.path,projectId=String(project.guid), inv=await H.inventory(project), scans={};
    for(const link of links) if(!link.paused) scans[link.id]=await this.scanner.scan(link,path);
    await this.assertContext(path,projectId);
    const plan=planSync({links,scans,inventory:inv,records:this.data.records});
    for(const change of plan.changes) if(change.kind==="fragmented" && this.data.settings.mp4==="NONE") change.blocking=false;
    const markers=await Markers.analyze({inventory:inv,scans,plan,data:this.data,scanner:this.scanner});
    for(const change of markers.changes) {
      const failure=this.markerFailures.get(P.key(change.path)),signature=JSON.stringify([change.source.signature,change.source.revision]);
      if(failure?.signature===signature)markers.warnings.push({path:change.path,txtPath:change.source.path,message:failure.message});
      else plan.changes.push({...change,id:String(plan.changes.length)});
    }
    await this.assertContext(path,projectId);
    plan.hasBlocking=plan.changes.some(c=>c.blocking);
    return {...plan,links,scans,inventory:inv,projectPath:path,projectId,media:markers.media.map(m=>({...m,projectPath:path,projectId})),warnings:markers.warnings};
  }
  async scan() {
    if(this.busy) return this.batch;
    this.busy=true; this.emit();
    try { this.batch=await this.analyze(); this.error=null; return this.batch; }
    catch(e) { this.error=e.message; throw e; }
    finally { this.busy=false; await this.diagnostics(); this.emit(); }
  }
  async persist() { if(!this.path) throw new Error("No saved project is open."); await this.assertContext(this.path); await Store.save(this.path,this.data); }
  async apply(batch,selected,decisions={}) {
    if(this.busy) throw new Error("A sync is already running.");
    this.busy=true; this.emit();
    try {
      await this.assertContext(batch.projectPath,batch.projectId);
      // Reanalyze immediately before mutation. A review decision applies only to the reviewed plan.
      const fresh=await this.analyze(batch.links);
      const signature=b=>JSON.stringify(b.changes.map(c=>[c.kind,c.path,c.from,c.target,c.itemId,c.file?.size,c.file?.mtime,c.file?.identity,c.source?.path,c.source?.signature,c.source?.revision,c.source?.size,c.source?.mtime,c.source?.identity,c.expected,c.pendingMode]));
      if(signature(fresh)!==signature(batch)) throw new Error("Sources or project changed after analysis. Review the updated batch.");
      const chosen=selected ? fresh.changes.filter(c=>selected.includes(c.id)) : fresh.changes;
      for(const c of chosen) {
        if(c.blocking && !(c.kind==="fragmented" && decisions[c.id]==="original") && !(c.kind==="marker-choice"&&["append","replace","skip"].includes(decisions[c.id]))) throw new Error("Resolve blocking items before syncing.");
        if(c.file) { const scan=fresh.scans[c.linkId]; if(!scan.files.some(f=>P.key(f.path)===P.key(c.path)&&f.size===c.file.size&&f.mtime===c.file.mtime)) throw new Error("Source changed after analysis."); }
      }
      // Store links before mutation: if a later import fails, reconciliation can safely recover.
      const previousLinks=this.data.links;
      this.data.links=batch.links;
      try { await this.persist(); } catch(e) { this.data.links=previousLinks; throw e; }
      let applied=0;const markerWarnings=[];
      for(const change of chosen) {
        await this.assertContext(batch.projectPath,batch.projectId);
        if(change.file) await this.scanner.validate(change.file);
        if(change.kind==="clip-markers"||change.kind==="marker-choice") {
          try {
            const inv=await H.inventory(this.project),matches=inv.clips.filter(c=>P.key(c.mediaPath)===P.key(change.path));
            if(matches.length!==1)continue; // Media may have been left unselected in Review.
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
            applied+=result.added;await this.persist();
          }catch(e){
            await this.assertContext(batch.projectPath,batch.projectId);
            this.markerFailures.set(P.key(change.path),{signature:JSON.stringify([change.source.signature,change.source.revision]),message:e.message});
            markerWarnings.push({path:change.path,txtPath:change.source.path,message:e.message});
          }
          continue;
        }
        await H.applyChange(this.project,change,await H.inventory(this.project)); applied++;
        // Checkpoint verified mappings after each action so a later failure remains recoverable.
        this.checkpoint(fresh,await H.inventory(this.project)); await this.persist();
      }
      const after=await H.inventory(this.project);
      this.checkpoint(fresh,after);
      this.data.history.unshift({time:new Date().toISOString(),count:applied,message:markerWarnings.length||fresh.warnings?.length ? "Sync completed with marker warnings" : applied ? "Sync completed" : fresh.changes.length ? "No changes applied" : "Everything is up to date"});
      this.data.history=this.data.history.slice(0,30); await this.persist(); this.error=null; this.batch=await this.analyze();
    } catch(e) { this.error=e.message; throw e; }
    finally { this.busy=false; await this.diagnostics(); this.emit(); }
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
    for(const link of this.data.links) {
      const root=after.bins.find(b=>b.id===link.binId)||after.bins.find(b=>b.path===link.binPath);
      if(root) { link.binId=root.id; link.binPath=root.path; }
      const proposed=plan.next[link.id]; if(!proposed) continue;
      const old=this.data.records[link.id]||{files:[],dirs:[]};
      const files=new Map(old.files.filter(f=>f.itemId).map(f=>[f.itemId,f]));
      const dirs=new Map(old.dirs.filter(d=>d.binId).map(d=>[d.binId,d]));
      for(const f of proposed.files) {
        const matches=after.clips.filter(c=>P.key(c.mediaPath)===P.key(f.path));
        if(matches.length===1) { files.set(matches[0].id,{...f,itemId:matches[0].id}); owners.set(matches[0].id,link.id); }
      }
      for(const d of proposed.dirs) {
        const matches=after.bins.filter(b=>b.path===d.binPath);
        if(matches.length===1) dirs.set(matches[0].id,{...d,binId:matches[0].id});
      }
      this.data.records[link.id]={files:[...files.values()],dirs:[...dirs.values()]};
    }
    for(const [linkId,record] of Object.entries(this.data.records)) record.files=record.files.filter(f=>!owners.has(f.itemId)||owners.get(f.itemId)===linkId);
  }
  async diagnostics() {
    await Store.diagnostic({time:new Date().toISOString(),ticks:this.ticks,visible:this.visible,projectPath:this.path,busy:this.busy,error:this.error,links:this.data.links,batch:this.batch && {changes:this.batch.changes,reused:this.batch.reused,warnings:this.batch.warnings,media:this.batch.media},inventory:this.batch && {bins:this.batch.inventory.bins,clips:this.batch.inventory.clips},scans:this.batch?.scans});
  }
  start() {
    if(this.timer) return;
    this.timer=setInterval(async()=>{
      this.ticks++;
      if(this.busy||this.dialogOpen) return;
      try { await this.scan(); if(this.data.settings.mode==="AUTO" && this.batch?.changes.length && !this.batch.hasBlocking) await this.apply(this.batch); }
      catch(e) { this.error=e.message; this.emit(); }
    },5000);
  }
  stop() { if(this.timer) clearInterval(this.timer); this.timer=null; }
}
module.exports={Controller};
