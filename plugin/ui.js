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
  bind(root,id,fn) { const el=root.querySelector("#"+id); if(el) { const run=async()=>{ if(el.disabled) return; try { await fn(); } catch(e) { await this.error(e.message); } }; el.addEventListener("click",run); if(el.getAttribute("role")==="button") el.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" ") { e.preventDefault();run(); } }); } }
  update() {
    this.mainPanel?.update(this.c);
    this.refreshStatus?.();
  }
  async modal(title,html,setup,{width=850,height=570}={}) {
    const d=document.createElement("dialog"); d.style.width=width+"px"; d.style.height=height+"px"; d.innerHTML=`<div class="window">${html}</div>`; document.body.appendChild(d);
    this.openDialogs=(this.openDialogs||0)+1; this.c.dialogOpen=true;
    try { setup?.(d); return await d.uxpShowModal({title,resize:"none",size:{width,height}}); }
    catch(e) { if(e.code) return "cancel"; throw e; }
    finally { d.remove(); this.openDialogs--; this.c.dialogOpen=this.openDialogs>0; this.update(); }
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
  async sync() {
    if(this.c.busy)return this.status();
    const batch=await this.c.scan();
    if(batch.hasBlocking) return this.review(batch);
    await this.c.apply(batch);
  }
  async management() {
    return this.dialogFlow(async()=>{
      let view="links",draft;
      for(;;){
        this.importTargetError="";this.sequenceTargetError="";
        try{await this.c.context();}catch(e){this.c.error=e.message;this.importTargetError=e.message;}
        if(this.c.data.settings.sequenceTarget&&Dates.enabled(this.c.data.settings))try{await require("./host/sequence").context(this.c.data.settings.sequenceTarget);}catch(e){this.sequenceTargetError=e.message;}
        const result=await this.modal("Footage Sync — Links / Settings",this.header("Footage Sync",true)+'<div id="management-content" style="display:flex;flex:1;flex-direction:column"></div>',d=>{
          this.close(d);this.bind(d,"tab-links",()=>this.linksView(d));this.bind(d,"tab-settings",()=>this.settingsView(d));if(view==="settings")this.settingsView(d,draft);else this.linksView(d);
        });
        if(result?.action==="ignored"){await this.ignoredPaths();view="settings";draft=result.draft;continue;}
        if(result?.action==="project"){const project=await this.chooseProject();if(project&&typeof project==="object")await this.c.selectProject(project);}
        else if(result?.action==="sequence"){const target=await this.chooseSequence();if(target!=="cancel")await this.c.selectSequence(target);}
        else if(result?.action==="add")await this.add();
        else if(result?.action==="edit")await this.existing(this.c.data.links.find(l=>l.id===result.id));
        else return;
      }
    });
  }
  activeTab(d,id) { for(const el of d.querySelectorAll(".tab")) el.className="tab"+(el.id===id?" active":""); }
  projectControls() {
    const selected=this.c.workspace?.importProject;
    const sequence=this.c.data.settings?.sequenceTarget;
    const enabled=Dates.enabled(this.c.data.settings),sourceError=this.importTargetError||(!selected?"Choose the import project.":""),sequenceError=this.sequenceTargetError||(!sequence?"Choose a sequence, or leave sequence import off.":"");
    return `<div class="target-controls"><div class="target-row ${sourceError?"target-missing":""}"><span class="target-label">Import project</span><strong class="path target-name" title="${esc(sourceError||selected?.path)}">${esc(selected?.name||"Not selected")}</strong><div id="choose-project" class="small-button target-change" role="button" tabindex="0" title="${esc(selected?.path||"Choose import project")}">${selected?"Change":"Choose…"}</div></div><div class="target-row ${sequenceError?"target-missing":""}"><sp-checkbox id="sequence-enabled" class="target-toggle" title="Append new video to the sequence during future syncs" ${enabled?"checked":""}>To sequence</sp-checkbox><strong class="path target-name" title="${esc(sequenceError||sequence?.projectPath+" → "+sequence?.sequenceName)}">${esc(sequence?sequence.projectName+" → "+sequence.sequenceName:"Not selected")}</strong><div id="choose-sequence" class="small-button target-change" role="button" tabindex="0" title="${esc(sequence?.projectPath||"Choose Footage sequence")}">${sequence?"Change":"Choose…"}</div></div></div>`;
  }
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
  linksView(d) {
    this.activeTab(d,"tab-links"); const links=this.c.data.links;
    const content=d.querySelector("#management-content");
    content.innerHTML=`<div class="links-toolbar row spread"><div class="row"><h1>Links</h1><span class="muted">${links.length} linked folders</span></div>${button("add","+ Add link",true)}</div><div class="body"><sp-textfield id="search" class="search" placeholder="Search bin or folder path"></sp-textfield><div class="table"><div class="table-head"><div class="col-bin">PREMIERE BIN</div><div class="col-flag">RELATIVE</div><div class="col-flag">SUBFOLDERS</div><div class="col-folder">SYSTEM FOLDER</div><div class="col-status">STATUS</div><div class="col-actions"></div></div><div id="rows"></div></div></div><div class="footer management-footer">${this.projectControls()}${button("close","Close")}</div>`;
    const render=()=>{
      const query=content.querySelector("#search").value.toLowerCase();
      const rows=content.querySelector("#rows"), filtered=links.filter(l=>((l.binPath||"Project root")+" "+l.folderPath).toLowerCase().includes(query));
      rows.innerHTML=filtered.length?filtered.map(l=>`<div class="table-row"><div class="col-bin path" title="${esc(l.binPath||"Project root")}">${esc(l.binPath||"Project root")}</div><div class="col-flag"><sp-checkbox id="relative-${l.id}" ${l.relative?"checked":""}></sp-checkbox></div><div class="col-flag"><sp-checkbox id="sub-${l.id}" ${l.subfolders?"checked":""}></sp-checkbox></div><div class="col-folder path" title="${esc(l.folderPath)}">${esc(l.folderPath)}</div><div class="col-status"><span class="pill ${l.paused?"paused":""}">${l.paused?"Paused":"Active"}</span></div><div class="col-actions"><div class="small-button" role="button" tabindex="0" id="edit-${l.id}">Edit</div><div class="small-button" role="button" tabindex="0" id="pause-${l.id}">${l.paused?"Resume":"Pause"}</div><div class="small-button" role="button" tabindex="0" id="remove-${l.id}" title="Remove link only">×</div></div></div>`).join(""):'<div class="empty"><h2>No folders linked</h2><p>Add a link to connect a Premiere bin to a system folder.</p></div>';
      for(const l of filtered) {
        this.bind(rows,"edit-"+l.id,()=>d.close({action:"edit",id:l.id}));
        this.bind(rows,"pause-"+l.id,async()=>{ l.paused=!l.paused; await this.c.persist(); this.linksView(d); });
        this.bind(rows,"remove-"+l.id,async()=>{ this.c.data.links=this.c.data.links.filter(x=>x.id!==l.id); delete this.c.data.records[l.id]; await this.c.persist(); this.linksView(d); });
        rows.querySelector("#relative-"+l.id).addEventListener("change",async e=>{
          try { const path=P.resolve(P.dirname(this.c.path),l.folderPath); l.relative=e.target.checked; l.folderPath=l.relative?P.relative(P.dirname(this.c.path),path):path; await this.c.persist(); render(); } catch(err) { await this.error(err.message); this.linksView(d); }
        });
        rows.querySelector("#sub-"+l.id).addEventListener("change",async e=>{ try { l.subfolders=e.target.checked; await this.c.persist(); } catch(err) { await this.error(err.message); } });
      }
    };
    this.bind(content,"choose-project",()=>d.close({action:"project"}));
    this.bind(content,"choose-sequence",()=>d.close({action:"sequence"}));
    content.querySelector("#sequence-enabled").addEventListener("change",async e=>{try{await this.c.setSequenceEnabled(e.target.checked);}catch(err){e.target.checked=Dates.enabled(this.c.data.settings);await this.error(err.message);}});
    content.querySelector("#search").addEventListener("input",render); render(); this.bind(content,"close",()=>d.close());
    this.bind(content,"add",()=>d.close({action:"add"}));
  }
  settingsView(d,draft) {
    this.activeTab(d,"tab-settings"); const settings={...this.c.data.settings,...draft}, content=d.querySelector("#management-content");
    const options=(group,list)=>list.map(([value,title,copy])=>`<div id="${group}-${value}" class="option ${settings[group]===value?"selected":""}"><strong><span class="dot">${settings[group]===value?"◉":"○"}</span>${title}</strong><span class="muted">${copy}</span></div>`).join("");
    const modes=[["AUTO","Auto","Apply safe changes automatically"],["ASK","Ask when needed","Sync safe batches directly; review blocking items"],["MANUAL","Manual","Apply changes from Main Panel or Status Sync"]];
    const mp4=[["AUTO","Fix automatically","Prepare media before import"],["ASK","Ask before fixing","Recommended default"],["NONE","Don’t fix","Import original media only"]];
    const render=()=>{
      content.innerHTML=`<div class="intro"><div class="eyebrow">PROJECT PREFERENCES</div><h1>Settings</h1><p>Global behavior for this project</p></div><div class="body"><div class="columns"><div class="column"><h2>Sync mode</h2><p>Global for this project</p>${options("mode",modes)}</div><div class="column"><h2>Fragmented MP4</h2><p>Applied before import</p>${options("mp4",mp4)}</div></div><div class="row spread" style="margin-top:16px"><div><h2>Source clip markers</h2><p>TXT name is contained in the MP4 name · Same folder</p></div><sp-checkbox id="auto-markers" ${settings.autoMarkers!==false?"checked":""}>Find and apply TXT during Sync</sp-checkbox></div><div class="row spread" style="margin-top:20px"><div><h2>Notifications</h2><p>Auto mode stays quiet after success</p></div><sp-checkbox id="warnings" ${settings.warnings?"checked":""}>Show warnings and errors</sp-checkbox><sp-checkbox id="success" ${settings.success?"checked":""}>Show successful syncs</sp-checkbox></div></div><div class="footer">${button("cancel","Cancel")}${button("save","Save settings",true)}</div>`;
      for(const [group,list] of [["mode",modes],["mp4",mp4]]) for(const [value] of list) this.bind(content,group+"-"+value,()=>{ settings.autoMarkers=content.querySelector("#auto-markers").checked; settings.warnings=content.querySelector("#warnings").checked; settings.success=content.querySelector("#success").checked; settings[group]=value; render(); });
      this.bind(content,"cancel",()=>this.linksView(d));
      this.bind(content,"save",async()=>{ settings.autoMarkers=content.querySelector("#auto-markers").checked; settings.warnings=content.querySelector("#warnings").checked; settings.success=content.querySelector("#success").checked; this.c.data.settings=settings; await this.c.persist(); this.linksView(d); });
      const capture=()=>{settings.autoMarkers=content.querySelector("#auto-markers").checked;settings.warnings=content.querySelector("#warnings").checked;settings.success=content.querySelector("#success").checked;};
      const ignore=document.createElement("div");ignore.className="row spread";ignore.style.marginTop="20px";ignore.innerHTML=`<div><h2>Ignore list</h2><p>Files and folders excluded from Sync and alerts</p></div>${button("ignored-paths","Manage ignored paths… ("+(this.c.data.ignored||[]).length+")")}`;
      content.querySelector(".body").appendChild(ignore);
      this.bind(ignore,"ignored-paths",()=>{capture();d.close({action:"ignored",draft:settings});});
    }; render();
  }
  async ignorePath(path="",kind="file"){
    let selected={path,kind};
    const result=await this.modal("Ignore file or folder",this.header("Ignore file or folder")+`<div class="body"><p>Excluded from Sync, Review and attention until restored in Settings. Existing Premiere items and timeline edits are kept.</p><div class="row">${button("ignore-file","File")}${button("ignore-folder","Folder and subfolders")}</div><sp-textfield id="ignore-path" placeholder="Absolute file or folder path" value="${esc(path)}" style="margin-top:16px"></sp-textfield><p id="ignore-scope" class="muted"></p><p id="ignore-error" class="issue-text"></p></div><div class="footer">${button("cancel","Cancel")}${button("ignore-confirm","Ignore",true)}</div>`,d=>{
      this.close(d);const field=d.querySelector("#ignore-path"),render=()=>{d.querySelector("#ignore-scope").textContent=selected.kind==="folder"?"This folder and everything inside it. New files here are also ignored.":"Only this file path. Replacing the file does not remove it from the ignore list.";};
      for(const type of ["file","folder"])this.bind(d,"ignore-"+type,()=>{selected.kind=type;if(path)field.value=type==="folder"&&kind==="file"?P.dirname(path):path;render();});
      this.bind(d,"ignore-confirm",()=>{try{d.close(Ignore.rule({kind:selected.kind,path:field.value.trim()}));}catch(e){d.querySelector("#ignore-error").textContent=e.message;}});render();
    },{width:680,height:360});
    if(result&&typeof result==="object"){await this.c.setIgnored(result);return true;}return false;
  }
  async ignoredPaths(){
    for(;;){
      const rules=this.c.data.ignored||[];
      const result=await this.modal("Ignored files and folders",this.header("Ignored files and folders")+`<div class="body"><p>Ignored paths do not appear in Sync, Review or attention. Folder rules include subfolders and future files. Restore resumes normal analysis; existing Premiere edits are kept.</p>${rules.map((r,i)=>`<div class="history-row row spread"><div class="column"><strong>${r.kind==="folder"?"Folder and subfolders":"File"}</strong><span class="path" title="${esc(r.path)}">${esc(r.path)}</span></div><div id="restore-ignore-${i}" class="small-button" role="button" tabindex="0">Restore</div></div>`).join("")||'<p>No ignored paths.</p>'}</div><div class="footer">${button("ignore-add","Add path…")}${button("close","Close")}</div>`,d=>{this.close(d);this.bind(d,"ignore-add",()=>d.close({add:true}));rules.forEach((r,i)=>this.bind(d,"restore-ignore-"+i,()=>d.close({restore:r})));},{width:720,height:480});
      if(result?.add){if(await this.ignorePath())await this.c.scan();}
      else if(result?.restore){await this.c.setIgnored(result.restore,true);await this.c.scan();}
      else return;
    }
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
  async add() {
    const choice=await this.modal("Add link",this.header("Add link")+`<div class="body"><h1>Connect folders to Premiere</h1><div id="existing" class="option"><strong>Link an existing bin</strong><p>Choose a Premiere bin and its system folder.</p></div><div id="matching" class="option"><strong>Create matching bins</strong><p>Select system folders and preview matching bins.</p></div></div><div class="footer">${button("cancel","Cancel")}</div>`,d=>{ this.close(d); this.bind(d,"existing",()=>d.close("existing")); this.bind(d,"matching",()=>d.close("matching")); },{width:560,height:350});
    if(choice==="existing") await this.existing(); else if(choice==="matching") await this.matching();
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
  async existing(edit=null) {
    return this.dialogFlow(async()=>{
    const project=await this.c.context();if(!project) throw new Error("Open the Footage project before adding a link.");
    const projectPath=this.c.path,projectId=String(project.guid);
    const draft={id:edit?.id||"l"+Date.now(),binPath:edit?.binPath||"",binId:edit?.binId||null,folderPath:edit?P.resolve(P.dirname(this.c.path),edit.folderPath):"",relative:edit?.relative||false,subfolders:edit?.subfolders??true,paused:false};
    let rootSelected=Boolean(edit&&edit.binPath==="");
    let formError="";
    for(;;){
    const result=await this.modal("Link existing bin",this.header(edit?"Edit link":"Link existing bin")+`<div class="body"><div class="field"><span class="field-label">Premiere bin</span><div class="field-row"><sp-textfield id="bin" value="${esc(rootSelected?"Project root":draft.binPath)}" placeholder="Choose an existing bin"></sp-textfield>${button("choose","Choose…")}</div><sp-checkbox id="use-root" ${rootSelected?"checked":""}>Project root</sp-checkbox></div><div class="field"><span class="field-label">System folder</span><div class="field-row"><sp-textfield id="folder" value="${esc(draft.folderPath)}" placeholder="Folder path"></sp-textfield>${button("browse","Browse…")}</div></div><div class="row"><sp-checkbox id="relative" ${draft.relative?"checked":""}>Relative path</sp-checkbox><sp-checkbox id="subfolders" ${draft.subfolders?"checked":""}>Include subfolders</sp-checkbox></div><div class="notice">Disk is the source of truth. Existing matching bins and media are reused. Nothing is deleted from Premiere.</div><div id="form-error" class="issue-text"></div></div><div class="footer">${button("cancel","Cancel")}${button("analyze","Analyze link",true)}</div>`,d=>{
      this.close(d);
      d.querySelector("#form-error").textContent=formError;
      const rootField=d.querySelector("#use-root"),binField=d.querySelector("#bin");binField.disabled=rootSelected;
      rootField.addEventListener("change",()=>{rootSelected=rootField.checked;binField.disabled=rootSelected;binField.value=rootSelected?"Project root":draft.binPath;});
      const capture=()=>{
        if(!rootSelected)draft.binPath=binField.value.trim();
        draft.folderPath=d.querySelector("#folder").value.trim();draft.relative=d.querySelector("#relative").checked;draft.subfolders=d.querySelector("#subfolders").checked;
      };
      this.bind(d,"choose",()=>{capture();d.close({action:"choose"});});
      this.bind(d,"browse",()=>{capture();d.close({action:"browse"});});
      this.bind(d,"analyze",async()=>{
        await this.c.assertContext?.(projectPath,projectId);
        const bin=rootSelected?"":d.querySelector("#bin").value.trim(), path=d.querySelector("#folder").value.trim();
        const inv=await H.inventory(this.c.project), matches=rootSelected?[{id:null,path:""}]:inv.bins.filter(b=>b.path===bin);
        if(matches.length!==1||!path) { d.querySelector("#form-error").textContent="Choose one existing bin and a system folder."; return; }
        draft.binPath=bin; draft.binId=matches[0].id; draft.relative=d.querySelector("#relative").checked; draft.subfolders=d.querySelector("#subfolders").checked;
        draft.folderPath=draft.relative?P.relative(P.dirname(this.c.path),path):P.clean(path);
        d.close(draft);
      });
    },{width:680,height:430});
    if(result?.action){
      formError="";
      await this.c.assertContext?.(projectPath,projectId);
      try{
        if(result.action==="browse"){const f=await uxp.storage.localFileSystem.getFolder();if(f)draft.folderPath=f.nativePath;}
        else {const b=await this.chooseBin(true);if(b&&typeof b==="object"){draft.binId=b.id;draft.binPath=b.path;rootSelected=b.path==="";}}
      }catch(e){formError="Could not open the picker: "+e.message+". You can enter the path manually.";}
      await this.c.assertContext?.(projectPath,projectId);
      continue;
    }
    if(result && typeof result==="object") await this.initial([result],edit?.id);
    return;
    }
    });
  }
  async matching() {
    return this.dialogFlow(async()=>{
    const project=await this.c.context();if(!project) throw new Error("Open the Footage project before adding a link.");
    const projectPath=this.c.path,projectId=String(project.guid);
    const selection=new Map(), expanded=new Set(), nodes=new Map(); let destination={path:"",id:null}, root="";
    let rootText="",search="",relative=false,subfolders=true,formError="";
    const loadRoot=async value=>{
      const next=P.clean(value),st=await fs.lstat(next);if(!st.isDirectory()||st.isSymbolicLink?.())throw new Error("Choose a folder.");
      root=next;nodes.clear();expanded.clear();selection.clear();nodes.set(root,{children:[],identity:require("./host/filesystem").identity(st)});
    };
    for(;;){
    const result=await this.modal("Create matching bins",this.header("Create matching bins")+`<div class="body"><div class="columns"><div class="column"><div class="field-row"><sp-textfield id="root" placeholder="Drive or folder path"></sp-textfield>${button("browse","Browse…")}${button("load","Open")}</div><sp-textfield id="search" placeholder="Search folders" style="margin:10px 0"></sp-textfield><div id="tree" class="tree"></div></div><div class="column" style="max-width:260px"><h2>Selection</h2><p id="count">0 folders selected</p><span class="field-label">Destination Premiere bin</span><p id="destination">Project root</p>${button("choose","Choose…")}<div style="margin-top:20px"><sp-checkbox id="relative">Relative paths</sp-checkbox><sp-checkbox id="subfolders" checked>Include subfolders</sp-checkbox></div><div class="notice">Each selected top-level folder becomes one link. Preview changes before applying.</div></div></div></div><div class="footer">${button("cancel","Cancel")}${button("analyze","Analyze selection",true)}</div>`,d=>{
      this.close(d);d.querySelector("#root").value=rootText;d.querySelector("#search").value=search;
      d.querySelector("#relative").checked=relative;d.querySelector("#subfolders").checked=subfolders;
      d.querySelector("#destination").textContent=destination.path||"Project root";
      d.querySelector("#count").textContent=selection.size+" folders selected";d.querySelector("#analyze").disabled=!selection.size;
      const render=()=>{
        const tree=d.querySelector("#tree"), query=d.querySelector("#search").value.toLowerCase(), visible=[];
        function visit(path,depth) { const entry=nodes.get(path); if(!entry) return; if(!query||path.toLowerCase().includes(query)) visible.push({path,depth}); if(expanded.has(path)) entry.children.forEach(child=>visit(child,depth+1)); }
        if(root) visit(root,0);
        tree.innerHTML=(formError?`<p class="issue-text">${esc(formError)} You can enter the path manually.</p>`:"")+visible.map((n,i)=>`<div class="tree-row" style="padding-left:${n.depth*16}px"><div class="small-button" role="button" tabindex="0" id="expand-${i}">${expanded.has(n.path)?"▾":"▸"}</div><sp-checkbox id="select-${i}" ${selection.has(n.path)?"checked":""}></sp-checkbox><span class="path" title="${esc(n.path)}">${esc(P.basename(n.path)||n.path)}</span></div>`).join("");
        visible.forEach((n,i)=>{
          this.bind(tree,"expand-"+i,async()=>{ if(expanded.has(n.path)) expanded.delete(n.path); else { const children=[]; for(const name of await fs.readdir(n.path)) { if(!name||name==="."||name===".."||/[\\/]/.test(name))throw new Error("Invalid directory entry.");const path=P.join(n.path,name), st=await fs.lstat(path); if(st.isDirectory() && !(st.isSymbolicLink?.())) { const id=require("./host/filesystem").identity(st);if(id&&Array.from(nodes).some(([ancestor,node])=>P.within(n.path,ancestor)&&node.identity===id))throw new Error("Folder scan stopped: the filesystem returned an ancestor folder again. Path: "+path);children.push(path);if(!nodes.has(path))nodes.set(path,{children:[],identity:id}); } } nodes.get(n.path).children=children; expanded.add(n.path); } render(); });
          tree.querySelector("#select-"+i).addEventListener("change",e=>{ if(e.target.checked) selection.set(n.path,true); else selection.delete(n.path); d.querySelector("#count").textContent=selection.size+" folders selected"; d.querySelector("#analyze").disabled=!selection.size; });
        });
      };
      const capture=()=>{rootText=d.querySelector("#root").value;search=d.querySelector("#search").value;relative=d.querySelector("#relative").checked;subfolders=d.querySelector("#subfolders").checked;};
      const load=async()=>{capture();await loadRoot(rootText);formError="";d.querySelector("#count").textContent="0 folders selected";d.querySelector("#analyze").disabled=true;render();};
      this.bind(d,"load",load);this.bind(d,"browse",()=>{capture();d.close({action:"browse"});});
      d.querySelector("#search").addEventListener("input",render);
      this.bind(d,"choose",()=>{capture();d.close({action:"choose"});});
      this.bind(d,"analyze",async()=>{
        await this.c.assertContext?.(projectPath,projectId);
        const paths=Array.from(selection.keys()).filter(p=>!Array.from(selection.keys()).some(other=>other!==p&&P.within(p,other)));
        const relative=d.querySelector("#relative").checked, subfolders=d.querySelector("#subfolders").checked;
        d.close(paths.map((path,i)=>({id:"l"+Date.now()+i,binId:null,binPath:P.join(destination.path,P.basename(path)),folderPath:relative?P.relative(P.dirname(this.c.path),path):path,relative,subfolders,paused:false})));
      });
      render();
    },{width:900,height:550});
    if(result?.action){
      formError="";await this.c.assertContext?.(projectPath,projectId);
      try{
        if(result.action==="browse"){const f=await uxp.storage.localFileSystem.getFolder();if(f){rootText=f.nativePath;await loadRoot(rootText);}}
        else {const b=await this.chooseBin(true);if(b&&typeof b==="object")destination=b;}
      }catch(e){formError="Could not open the picker: "+e.message;}
      await this.c.assertContext?.(projectPath,projectId);continue;
    }
    if(Array.isArray(result)) await this.initial(result);
    return;
    }
    });
  }
  async initial(drafts,editId=null) {
    const others=this.c.data.links.filter(l=>l.id!==editId), all=[...others,...drafts];
    for(const draft of drafts) for(const other of all) {
      if(draft.id===other.id) continue;
      const a=P.resolve(P.dirname(this.c.path),draft.folderPath), b=P.resolve(P.dirname(this.c.path),other.folderPath);
      if(P.within(a,b)||P.within(b,a)||draft.binPath===other.binPath) throw new Error("Links overlap. Choose independent folders and bins.");
    }
    const batch=await this.c.scan(all);
    const confirm=await this.modal("Initial Sync",this.header("Initial Sync")+`<div class="body"><div class="eyebrow">RECONCILIATION PREVIEW</div><h1>Ready to link</h1>${drafts.map(l=>`<div class="card" style="margin-bottom:10px"><strong>${esc(l.binPath||"Project root")}</strong><p>${esc(l.folderPath)}</p></div>`).join("")}<div class="metrics"><div class="metric"><strong>${batch.reused.filter(r=>r.kind==="file").length}</strong><span class="muted">Already imported</span></div><div class="metric"><strong>${batch.changes.filter(c=>["new-file","fragmented"].includes(c.kind)).length}</strong><span class="muted">To import</span></div><div class="metric"><strong>0</strong><span class="muted">Duplicates created</span></div></div>${this.changeRows(batch,false)}<h2>Source clip markers</h2>${this.markerRows(batch)}<div class="notice">Existing items are reused. Source files and Premiere items are never deleted.</div></div><div class="footer">${button("cancel","Cancel")}${button("confirm","Link & Sync",true)}</div>`,d=>{ this.close(d); this.bindMarkerRows(d,batch); this.bind(d,"confirm",()=>d.close("confirm")); },{width:850,height:620});
    if(confirm?.addMarkers){await this.addMarkers(batch);return this.initial(drafts,editId);}
    if(confirm!=="confirm") return;
    if(batch.hasBlocking) await this.review(batch); else await this.c.apply(batch);
  }
  markerRows(batch) {
    const pending=(batch.media||[]).filter(m=>m.markerState==="pending"||m.markerState==="review").length;
    return `<div class="row spread marker-actions"><p>${pending?pending+" clips with pending TXT markers":"Choose a TXT, then its source clip"}</p>${button("add-markers","Add markers…")}</div>`;
  }
  bindMarkerRows(d,batch) {
    this.bind(d,"add-markers",()=>d.close({addMarkers:true}));
    const add=d.querySelector("#add-markers");if(add)add.disabled=this.c.busy||!(batch.media||[]).length;
  }
  async addMarkers(batch) {
    this.openDialogs=(this.openDialogs||0)+1;this.c.dialogOpen=true;
    try {
      const file=await uxp.storage.localFileSystem.getFileForOpening({types:["txt"]});if(!file)return;
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
  markerWarnings(batch,ignorable=false) {
    return (batch.warnings||[]).map((w,i)=>`<div class="notice error"><strong>${esc(P.basename(w.txtPath||w.path))}</strong><p>${esc(w.message)}</p><span class="muted">Video import can continue. Fix the TXT, then Sync again.</span>${ignorable?button("ignore-warning-"+i,"Ignore…"):""}</div>`).join("")+(batch.sequenceWarnings||[]).map(w=>`<div class="notice"><strong>Sequence title · ${esc(P.basename(w.path))}</strong><p>${esc(w.message)}</p></div>`).join("");
  }
  changeRows(batch,selectable) {
    return this.markerWarnings(batch,selectable)+(batch.changes.map(c=>`<div class="change ${c.blocking?"blocked":""}">${selectable?`<sp-checkbox id="change-${c.id}" ${c.blocking?"disabled":"checked"}></sp-checkbox>`:""}<div class="change-detail"><strong>${esc(label[c.kind]||c.kind)}</strong><div class="path" title="${esc(c.path)}">${esc(c.path)}</div>${c.from?`<div class="muted path">From: ${esc(c.from)}</div>`:""}${c.message?`<div class="issue-text">${esc(c.message)}</div>`:""}${selectable&&this.ignoreSource(c,batch)?`<div id="ignore-change-${c.id}" class="small-button" role="button" tabindex="0">Ignore…</div>`:""}${selectable&&["append-footage","sequence-review"].includes(c.kind)?`<div id="dependency-${c.id}" class="muted"></div>`:""}</div></div>`).join("")||'<p>No changes needed. Existing structure will be reused.</p>');
  }
  async review(batch) {
    const decisions={};
    const result=await this.modal("Review Changes",this.header("Review Changes")+`<div class="body"><h1>${batch.changes.length} changes detected</h1><p>${batch.changes.filter(c=>!c.blocking).length} safe · ${batch.changes.filter(c=>c.blocking).length} blocking — nothing applied before confirmation</p><div class="columns"><div class="column">${this.changeRows(batch,true)}<h2>Source clip markers</h2>${this.markerRows(batch)}</div><div class="column" style="max-width:300px"><h2>Needs a decision</h2>${batch.changes.filter(c=>c.blocking).map(c=>`<div class="card" style="margin-bottom:10px"><strong>${esc(label[c.kind])}</strong><p class="path" title="${esc(c.path)}">${esc(P.basename(c.path))}</p><p id="decision-text-${c.id}">${esc(c.message)}</p>${c.kind==="marker-choice"?`<p class="issue-text">Replace removes every marker on this source clip, including manual markers.</p>${(c.pendingMode?[c.pendingMode,"skip"]:["replace","append","skip"]).map(mode=>`<div class="small-button" role="button" tabindex="0" id="marker-${mode}-${c.id}">${mode==="replace"?"Replace markers":mode==="append"?"Add to existing":"Skip TXT"}</div>`).join("")}`:c.kind==="fragmented"?`<p class="issue-text">Automatic repair is not available in this development build.</p><div class="small-button" role="button" tabindex="0" id="original-${c.id}">Import original</div><div class="small-button" role="button" tabindex="0" id="skip-${c.id}">Later</div>`:["sequence-error","sequence-review"].includes(c.kind)?'<p class="muted">Import files only continues media import and skips these sequence appends. It does not change the saved destination or checkbox.</p>':'<p class="muted">Resolve the source or link, then scan again. This item stays pending.</p>'}</div>`).join("")||'<p>No blocking items.</p>'}</div></div></div><div class="footer"><span class="hint">Selected changes only · No automatic deletes</span>${button("later","Later")}${batch.changes.some(c=>["append-footage","sequence-error","sequence-review"].includes(c.kind))?button("files-only","Import files only"):""}${button("apply","Sync selected",true)}</div>`,d=>{
      this.close(d); this.bindMarkerRows(d,batch); this.bind(d,"later",()=>d.close("cancel"));
      const dependencies=()=>{
        for(const change of batch.changes.filter(c=>["append-footage","sequence-review"].includes(c.kind)&&!c.checkpoint)){
          const media=batch.changes.find(c=>["new-file","fragmented"].includes(c.kind)&&P.key(c.path)===P.key(change.path));if(!media)continue;
          const source=d.querySelector("#change-"+media.id),el=d.querySelector("#change-"+change.id),hint=d.querySelector("#dependency-"+change.id);
          const ready=source.checked&&!source.disabled||decisions[change.id]==="keep";
          if(hint)hint.textContent=ready?"":"Resolve and select the source import first.";
          if(!ready){el.disabled=true;el.checked=false;}else if(el.disabled&&(!change.blocking||decisions[change.id])){el.disabled=false;el.checked=true;}
        }
      };
      for(const change of batch.changes){
        const source=this.ignoreSource(change,batch);if(source)this.bind(d,"ignore-change-"+change.id,()=>d.close({ignore:source}));
        if(["new-file","fragmented"].includes(change.kind))d.querySelector("#change-"+change.id)?.addEventListener("change",dependencies);
      }
      (batch.warnings||[]).forEach((w,i)=>this.bind(d,"ignore-warning-"+i,()=>d.close({ignore:{kind:"file",path:w.txtPath||w.path}})));
      dependencies();
      for(const c of batch.changes.filter(c=>c.kind==="sequence-review")){
        const card=d.querySelector("#change-"+c.id);
        const controls=document.createElement("div");controls.className="notice";controls.innerHTML=`<strong>${esc(P.basename(c.path))}</strong><p>${esc(c.message)}</p><div class="row">${button("sequence-retry-"+c.id,"Append again")}${button("sequence-keep-"+c.id,"Keep current sequence")}</div>`;
        d.querySelector(".body").appendChild(controls);
        for(const mode of ["retry","keep"])this.bind(controls,"sequence-"+mode+"-"+c.id,()=>{decisions[c.id]=mode;card.disabled=false;card.checked=true;dependencies();});
      }
      for(const c of batch.changes.filter(c=>c.kind==="marker-choice"))for(const mode of ["replace","append","skip"])this.bind(d,"marker-"+mode+"-"+c.id,()=>{decisions[c.id]=mode;const el=d.querySelector("#change-"+c.id);el.disabled=false;el.checked=true;for(const other of ["replace","append","skip"]){const b=d.querySelector("#marker-"+other+"-"+c.id);if(b)b.className="small-button"+(mode===other?" selected":"");}});
      for(const c of batch.changes.filter(c=>c.kind==="fragmented"&&!c.sequenceBlocked)) {
        this.bind(d,"original-"+c.id,()=>{ decisions[c.id]="original"; const el=d.querySelector("#change-"+c.id); el.disabled=false; el.checked=true;const text=d.querySelector("#decision-text-"+c.id);if(text)text.textContent="Import original selected. Footage and title can now be added.";dependencies(); });
        this.bind(d,"skip-"+c.id,()=>{ delete decisions[c.id]; const el=d.querySelector("#change-"+c.id); el.disabled=true; el.checked=false;const text=d.querySelector("#decision-text-"+c.id);if(text)text.textContent="Deferred for this sync. Use Ignore to hide this path until restored in Settings.";dependencies(); });
      }
      this.bind(d,"apply",()=>d.close({selected:batch.changes.filter(c=>d.querySelector("#change-"+c.id)?.checked).map(c=>c.id),decisions}));
      this.bind(d,"files-only",()=>d.close({selected:batch.changes.filter(c=>d.querySelector("#change-"+c.id)?.checked).map(c=>c.id),decisions,filesOnly:true}));
    },{width:900,height:620});
    if(result?.ignore){await this.c.assertContext?.(batch.projectPath,batch.projectId);await this.ignorePath(result.ignore.path,result.ignore.kind);return this.review(await this.c.scan());}
    if(result?.addMarkers){await this.addMarkers(batch);return this.review(await this.c.scan());}
    if(result && typeof result==="object"){
      if(result.filesOnly)await this.c.apply(batch,result.selected,result.decisions,{filesOnly:true});
      else await this.c.apply(batch,result.selected,result.decisions);
    }
  }
  operationDetails() {
    const op=this.c.operation;if(!op)return "";
    const elapsed=Math.floor(((op.finishedAt||Date.now())-op.startedAt)/1000),waiting=Math.floor((Date.now()-op.updatedAt)/1000);
    const state=op.status==="running"?"In progress":op.status==="failed"?"Failed":op.status==="warnings"?"Completed with warnings":"Completed";
    const count=op.total===null?`${op.completed} checked`:`${op.completed} / ${op.total}`;
    return `<div class="card operation"><div class="row spread"><h2>${esc(op.label)} · ${state}</h2><span class="muted">${elapsed}s elapsed</span></div><strong>${esc(op.phase)}</strong><p class="path" title="${esc(op.current)}">${esc(op.current||(op.status==="running"?"Preparing…":""))}</p><p>${count}${op.status==="running"&&waiting>=15?` · Waiting for this step for ${waiting}s`:""}</p>${op.total>0?`<div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,op.completed/op.total*100)}%"></div></div>`:""}${op.errors.map(e=>`<div class="notice error"><strong>${esc(e.phase)}</strong><p>${esc(e.message)}</p><span class="path">${esc(e.current)}</span></div>`).join("")}${op.warnings.map(w=>`<div class="notice"><strong>Warning</strong><p>${esc(w.message)}</p><span class="muted path" title="${esc(w.path)}">${esc(w.path)}</span></div>`).join("")}<div class="operation-log">${op.events.map(e=>`<div class="muted">${Math.floor((e.time-op.startedAt)/1000)}s · ${esc(e.message)}</div>`).join("")}</div></div>`;
  }
  statusContent() {
    const batch=this.c.batch,changes=batch?.changes||[],blocking=changes.filter(c=>c.blocking),unavailable=changes.some(c=>c.kind==="unavailable");
    const title=this.c.busy?"Sync in progress":this.c.error?"Needs attention":unavailable?"Folder unavailable":blocking.length?"Changes need review":batch?.warnings?.length?"Marker warnings":changes.length?"Changes detected":this.c.path?"Up to date":"Open a project";
    return `${this.c.error?`<div class="notice error">${esc(this.c.error)}</div>`:""}<div class="card row spread"><div><div class="eyebrow">CURRENT STATUS</div><h1>${title}</h1><p>${esc(this.c.project?.name||"No saved project open")}</p></div>${button("sync-now","Sync now")}</div><div id="operation-details">${this.operationDetails()}</div><div class="metrics"><div id="active-links" class="metric" role="button" tabindex="0"><strong>${this.c.data.links.filter(l=>!l.paused).length}</strong><span class="muted">Active links</span></div><div class="metric"><strong>${changes.length}</strong><span class="muted">Pending changes</span></div><div class="metric"><strong>${blocking.length}</strong><span class="muted">Blocking items</span></div></div><div class="columns"><div class="column card"><h2>Sync history</h2>${this.c.data.history.map(h=>`<div class="history-row"><strong>${esc(h.message)}</strong><span class="muted">${esc(new Date(h.time).toLocaleString())} · ${h.count} changes applied</span></div>`).join("")||'<p>No syncs yet.</p>'}</div><div class="column card"><h2>Needs attention</h2>${blocking.map(c=>`<div class="history-row"><strong>${esc(label[c.kind])}</strong><span class="muted path" title="${esc(c.path)}">${esc(c.path)}</span><span>${esc(c.message)}</span></div>`).join("")||(!(batch?.warnings?.length)?'<p>No issues detected.</p>':'')}${this.markerWarnings(batch||{})}${button("review","Review changes")}</div></div><h2>Source clip markers</h2>${this.markerRows(batch||{})}`;
  }
  async status() {
    if(this.statusOpen)return;
    this.statusOpen=true;let timer,result;
    // Open immediately even if Premiere is still awaiting an import/scan call.
    if(!this.c.busy)this.c.scan(undefined,true).catch(()=>{});
    try {
      result=await this.modal("Footage Sync — Status",this.header("Status")+`<div class="body" id="status-content"></div><div class="footer"><span class="hint">No automatic deletes · Disk → Premiere</span>${button("close","Close")}</div>`,d=>{
        this.close(d);
        const progress=()=>{const el=d.querySelector("#operation-details");if(el)el.innerHTML=this.operationDetails();};
        let rendered;
        this.refreshStatus=()=>{
          const state=[this.c.batch,this.c.busy,this.c.error,this.c.project,this.c.data.links,this.c.data.history];
          if(rendered&&state.every((v,i)=>v===rendered[i])){progress();return;}
          rendered=state;
          d.querySelector("#status-content").innerHTML=this.statusContent();this.bindMarkerRows(d,this.c.batch||{});
          d.querySelector("#sync-now").disabled=this.c.busy||this.c.batch?.changes.some(c=>c.kind==="unavailable");
          d.querySelector("#review").disabled=this.c.busy||!this.c.batch;
          this.bind(d,"active-links",()=>d.close({action:"links"}));
          this.bind(d,"sync-now",()=>d.close({action:"sync"}));this.bind(d,"review",()=>d.close({action:"review",batch:this.c.batch}));
        };
        this.refreshStatus();timer=setInterval(progress,500);
      },{width:850,height:650});
    }finally{this.refreshStatus=null;clearInterval(timer);this.statusOpen=false;}
    if(result?.addMarkers){await this.addMarkers(this.c.batch||{});return this.status();}
    if(result?.action==="links")return this.management();
    if(result?.action==="sync")return this.sync();
    if(result?.action==="review")return this.review(result.batch);
  }
}
module.exports={UI};
