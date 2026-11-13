"use strict";
const uxp=require("uxp"), H=require("./host/premiere"), P=require("./core/paths"), fs=require("./host/io");
const {MainPanel}=require("./main-panel");
const {binRows,markerTargets}=require("./core/ui-data");
const Dates=require("./core/footage-dates");
const Ignore=require("./core/ignore");
const esc=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const button=(id,label,primary=false)=>`<sp-button id="${id}" variant="${primary?"cta":"secondary"}">${label}</sp-button>`;
const label={"new-folder":"New folder / bin","new-file":"New file","rename-file":"Renamed file","move-file":"Moved file","folder-move":"Renamed / moved folder","reconcile-item":"Move existing item","fragmented":"Fragmented MP4","conflict":"Conflict","unavailable":"Folder unavailable","media-error":"Media not ready","clip-markers":"Add clip markers","marker-choice":"Marker TXT needs review","append-footage":"Append footage + title","sequence-review":"Sequence append needs review","sequence-error":"Sequence destination needs attention"};
class UI {
  constructor(controller) { this.c=controller; controller.onChange(()=>this.update()); }
  bind(root,id,fn) { const el=root.querySelector("#"+id); if(el) { const run=async e=>{ e?.stopPropagation?.();if(el.disabled) return; try { await fn(); } catch(error) { const hint=root.querySelector("#form-error")||root.querySelector("#settings-error");if(hint)hint.textContent=error.message;else {this.c.error=error.message;this.c.emit?.();} } }; el.addEventListener("click",run); if(["button","switch"].includes(el.getAttribute("role"))) el.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" ") { e.preventDefault();run(e); } }); } }
  update() {
    this.mainPanel?.update(this.c);
    this.refreshStatus?.();
  }
  async modal(title,html,setup,{width=850,height=570}={}) {
    const d=document.createElement("dialog"); d.style.width=width+"px"; d.style.height=height+"px"; d.innerHTML=`<div class="window">${html}</div>`; document.body.appendChild(d);
    this.openDialogs=(this.openDialogs||0)+1; this.c.dialogOpen=true;
    try { setup?.(d); return await d.uxpShowModal({title,resize:"none",size:{width,height}}); }
    catch(e) { if(e.code==="reasonCanceled") return "cancel"; throw e; }
    finally { if(this.windowDialog===d){this.saveWindow?.();this.windowDialog=null;this.refreshWindow=null;}d.remove(); this.openDialogs--; this.c.dialogOpen=this.openDialogs>0; this.update(); }
  }
  async dialogFlow(task) {
    // Keep polling suspended while a form is closed for an OS picker and rebuilt.
    this.openDialogs=(this.openDialogs||0)+1;this.c.dialogOpen=true;
    try{return await task();}finally{this.openDialogs--;this.c.dialogOpen=this.openDialogs>0;this.update();}
  }
  header(title,tabs=false) { return `<div class="window-header"><span class="brand">FS</span><strong>${esc(title)}</strong>${tabs?'<div id="tab-links" class="tab active" role="button" tabindex="0">Links</div><div id="tab-settings" class="tab" role="button" tabindex="0">Settings</div>':''}<div id="close-x" class="close-x" role="button" tabindex="0" title="Close">×</div></div>`; }
  close(d) { this.bind(d,"close-x",()=>d.close("cancel")); this.bind(d,"close",()=>d.close("cancel")); this.bind(d,"cancel",()=>d.close("cancel")); }
  async error(message) {
    this.c.error=message; this.c.emit();
    await this.modal("Footage Sync",this.header("Needs attention")+`<div class="body"><div class="notice error">${esc(message)}</div><p>No source files were removed or changed.</p></div><div class="footer">${button("close","Close")}</div>`,d=>this.close(d),{width:540,height:250});
  }
  start() {
    this.mainPanel=new MainPanel(document.querySelector("#main-panel")); this.mainPanel.start();
    this.bind(document,"links",()=>this.management()); this.bind(document,"status",()=>this.status()); this.bind(document,"sync",()=>this.c.busy?this.status():this.sync()); this.update();
  }
  destroy() { this.mainPanel?.destroy(); }
  async chooseProject() {
    const projects=(await H.openProjects()).sort((a,b)=>Number(/_Footage(?:\.prproj)?$/i.test(b.name))-Number(/_Footage(?:\.prproj)?$/i.test(a.name))||a.name.localeCompare(b.name));
    return this.modal("Choose import project",this.header("Import project")+`<div class="body"><p>Choose the saved project that owns linked bins and imported media.</p>${projects.map((p,i)=>`<div id="project-${i}" class="option" role="button" tabindex="0"><strong>${esc(p.name)}</strong><p class="path" title="${esc(p.path)}">${esc(p.path)}</p></div>`).join("")||'<p>Open the desired project in Premiere, then return here.</p>'}</div><div class="footer">${button("cancel","Cancel")}</div>`,d=>{this.close(d);projects.forEach((p,i)=>this.bind(d,"project-"+i,()=>d.close({path:p.path,name:p.name})));},{width:720,height:430});
  }
  async chooseSequence(){
    const choices=[];
    for(const project of await H.openProjects())for(const sequence of await project.getSequences())choices.push({projectPath:P.clean(project.path),projectName:project.name,sequenceId:String(sequence.guid),sequenceName:sequence.name});
    choices.sort((a,b)=>Number(/_Selects(?:\.prproj)?$/i.test(b.projectName)&&b.sequenceName==="Footage")-Number(/_Selects(?:\.prproj)?$/i.test(a.projectName)&&a.sequenceName==="Footage")||a.projectName.localeCompare(b.projectName)||a.sequenceName.localeCompare(b.sequenceName));
    return this.modal("Choose Footage sequence",this.header("Footage sequence")+`<div class="body"><p>New video → V1 / A1. Native text on V2 uses the folder date, or its name when no date is found. The checkbox in Links turns appending on or off without forgetting this destination.</p>${choices.map((s,i)=>`<div id="sequence-${i}" class="option" role="button" tabindex="0"><strong>${esc(s.projectName)} → ${esc(s.sequenceName)}</strong><p class="path" title="${esc(s.projectPath)}">${esc(s.projectPath)}</p></div>`).join("")||'<p>Open the desired project and create its Footage sequence in Premiere, then return here.</p>'}</div><div class="footer">${button("cancel","Cancel")}</div>`,d=>{this.close(d);choices.forEach((s,i)=>this.bind(d,"sequence-"+i,()=>d.close(s)));},{width:760,height:500});
  }
  ignoreSource(change,batch){
    const link=batch.links?.find(l=>l.id===change.linkId),root=link?P.resolve(P.dirname(batch.projectPath),link.folderPath):"";
    if(change.kind==="unavailable")return {path:root||change.path,kind:"folder"};
    if(P.isAbsolute(change.path))return {path:change.path,kind:"file"};
    const dir=batch.next?.[change.linkId]?.dirs?.find(d=>d.binPath===change.path)||batch.scans?.[change.linkId]?.dirs?.find(d=>P.join(link?.binPath,d.rel)===change.path);
    if(dir)return {path:dir.path||P.join(root,dir.rel),kind:"folder"};
    if(root&&link&&change.path===link.binPath)return {path:root,kind:"folder"};
    if(root&&link?.binPath&&P.within(change.path,link.binPath))return {path:P.join(root,P.relative(link.binPath,change.path)),kind:"folder"};
    return null;
  }
  async chooseBin(allowRoot=true) {
    const project=await this.c.context(); if(!project) throw new Error("Open a saved Footage project first.");
    const inv=await H.inventory(project),expanded=new Set();
    return this.modal("Choose Premiere bin",this.header("Premiere bin")+`<div class="body"><p>${esc(project.name)}</p>${allowRoot?'<div class="small-button root-choice" role="button" tabindex="0" id="project-root">Project root</div>':""}<div id="bin-tree" class="tree"></div></div><div class="footer">${button("cancel","Cancel")}</div>`,d=>{
      this.close(d);this.bind(d,"project-root",()=>d.close({id:null,path:"",name:"Project root"}));
      const render=()=>{
        const tree=d.querySelector("#bin-tree"),rows=binRows(inv.bins,expanded);
        tree.innerHTML=rows.map(({bin,depth,hasChildren},i)=>`<div class="tree-row bin-row" style="padding-left:${depth*18}px">${hasChildren?`<div class="small-button bin-toggle" role="button" tabindex="0" aria-expanded="${expanded.has(bin.id)}" title="${expanded.has(bin.id)?"Collapse":"Expand"} ${esc(bin.name)}" id="expand-bin-${i}">${expanded.has(bin.id)?"▾":"▸"}</div>`:'<span class="bin-spacer"></span>'}<div class="bin-label path" role="button" tabindex="0" id="bin-${i}" title="${esc(bin.path)}">${esc(bin.name)}</div></div>`).join("")||'<p>No bins exist yet. Choose Project root or use Create matching bins.</p>';
        rows.forEach(({bin},i)=>{this.bind(tree,"bin-"+i,()=>d.close(bin));this.bind(tree,"expand-bin-"+i,()=>{if(expanded.has(bin.id))expanded.delete(bin.id);else expanded.add(bin.id);render();});});
      };render();
    },{width:620,height:430});
  }
  async addMarkers(batch,chosen=null) {
    this.openDialogs=(this.openDialogs||0)+1;this.c.dialogOpen=true;
    try {
      const file=await uxp.storage.localFileSystem.getFileForOpening({types:["txt"]});if(!file)return;
      if(chosen){const confirm=await this.modal("Add source clip markers",this.header("Add markers from TXT")+`<div class="body"><h2>${esc(P.basename(file.nativePath))}</h2><p>Source clip: ${esc(chosen.name||P.basename(chosen.path))}</p><p class="path" title="${esc(chosen.path)}">${esc(chosen.path)}</p><p>The assignment is applied during Sync.</p></div><div class="footer">${button("cancel","Cancel")}${button("use-clip","Use this clip",true)}</div>`,d=>{this.close(d);this.bind(d,"use-clip",()=>d.close("confirm"));},{width:680,height:300});if(confirm==="confirm")await this.c.chooseMarkers(chosen,file.nativePath);return;}
      const {ranked,suggested}=markerTargets(batch.media||[],file.nativePath);let selected=suggested;
      const entry=await this.modal("Add source clip markers",this.header("Add markers")+`<div class="body"><h2>${esc(P.basename(file.nativePath))}</h2><p>${suggested?"A matching clip is selected. Confirm or choose another clip.":"Choose the source clip for this TXT. No unique name match was found."}</p><p class="muted">Markers will be applied during Sync. Existing markers may require Review.</p><sp-textfield id="clip-search" placeholder="Search clips by name or path"></sp-textfield><div id="clip-targets" class="choice-list marker-targets"></div></div><div class="footer"><span id="selected-clip" class="hint path"></span>${button("cancel","Cancel")}${button("use-clip","Use this clip",true)}</div>`,d=>{
        this.close(d);const confirm=d.querySelector("#use-clip");
        const render=()=>{
          const query=d.querySelector("#clip-search").value.toLowerCase(),visible=ranked.filter(r=>(r.entry.path+" "+(r.entry.name||"")).toLowerCase().includes(query));
          d.querySelector("#clip-targets").innerHTML=visible.map(({entry},i)=>`<div class="small-button ${selected===entry?"selected":""}" role="button" tabindex="0" id="clip-target-${i}" title="${esc(entry.path)}"><strong>${esc(entry.name||P.basename(entry.path))}</strong><div class="muted path">${esc(entry.path)}</div>${selected===entry?'<span class="muted">Selected</span>':""}</div>`).join("")||'<p>No matching clips.</p>';
          visible.forEach(({entry},i)=>this.bind(d,"clip-target-"+i,()=>{selected=entry;render();}));confirm.disabled=!selected;
          d.querySelector("#selected-clip").textContent=selected?"Selected: "+(selected.name||P.basename(selected.path)):"No clip selected";
        };
        d.querySelector("#clip-search").addEventListener("input",render);this.bind(d,"use-clip",()=>{if(selected)d.close(selected);});render();
      },{width:680,height:500});
      if(entry&&typeof entry==="object")await this.c.chooseMarkers(entry,file.nativePath);
    }finally{this.openDialogs--;this.c.dialogOpen=this.openDialogs>0;}
  }
}
module.exports={UI:require("./workspace-ui").redesign(UI,{H})};
