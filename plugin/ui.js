"use strict";
const uxp=require("uxp"), H=require("./host/premiere"), P=require("./core/paths"), fs=require("fs");
const {MainPanel}=require("./main-panel");
const esc=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const button=(id,label,primary=false)=>`<sp-button id="${id}" variant="${primary?"cta":"secondary"}">${label}</sp-button>`;
const label={"new-folder":"New folder / bin","new-file":"New file","rename-file":"Renamed file","move-file":"Moved file","folder-move":"Renamed / moved folder","reconcile-item":"Move existing item","fragmented":"Fragmented MP4","conflict":"Conflict","unavailable":"Folder unavailable","media-error":"Media not ready","clip-markers":"Add clip markers","marker-choice":"Marker TXT needs review"};
class UI {
  constructor(controller) { this.c=controller; controller.onChange(()=>this.update()); }
  bind(root,id,fn) { const el=root.querySelector("#"+id); if(el) { const run=async()=>{ if(el.disabled) return; try { await fn(); } catch(e) { await this.error(e.message); } }; el.addEventListener("click",run); if(el.getAttribute("role")==="button") el.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" ") { e.preventDefault();run(); } }); } }
  update() {
    this.mainPanel?.update(this.c);
  }
  async modal(title,html,setup,{width=850,height=570}={}) {
    const d=document.createElement("dialog"); d.style.width=width+"px"; d.style.height=height+"px"; d.innerHTML=`<div class="window">${html}</div>`; document.body.appendChild(d);
    this.openDialogs=(this.openDialogs||0)+1; this.c.dialogOpen=true;
    try { setup?.(d); return await d.uxpShowModal({title,resize:"none",size:{width,height}}); }
    catch(e) { if(e.code) return "cancel"; throw e; }
    finally { d.remove(); this.openDialogs--; this.c.dialogOpen=this.openDialogs>0; this.update(); }
  }
  header(title,tabs=false) { return `<div class="window-header"><span class="brand">FS</span><strong>${esc(title)}</strong>${tabs?'<div id="tab-links" class="tab active" role="button" tabindex="0">Links</div><div id="tab-settings" class="tab" role="button" tabindex="0">Settings</div>':''}<div id="close-x" class="close-x" role="button" tabindex="0" title="Close">×</div></div>`; }
  close(d) { this.bind(d,"close-x",()=>d.close("cancel")); this.bind(d,"close",()=>d.close("cancel")); this.bind(d,"cancel",()=>d.close("cancel")); }
  async error(message) {
    this.c.error=message; this.c.emit();
    await this.modal("Footage Sync",this.header("Needs attention")+`<div class="body"><div class="notice error">${esc(message)}</div><p>No source files were removed or changed.</p></div><div class="footer">${button("close","Close")}</div>`,d=>this.close(d),{width:540,height:250});
  }
  start() {
    this.mainPanel=new MainPanel(document.querySelector("#main-panel")); this.mainPanel.start();
    this.bind(document,"links",()=>this.management()); this.bind(document,"status",()=>this.status()); this.bind(document,"sync",()=>this.sync()); this.update();
  }
  destroy() { this.mainPanel?.destroy(); }
  async sync() {
    const batch=await this.c.scan();
    if(batch.hasBlocking) return this.review(batch);
    await this.c.apply(batch);
  }
  async management() {
    await this.c.context();
    await this.modal("Footage Sync — Links / Settings",this.header("Footage Sync",true)+'<div id="management-content" style="display:flex;flex:1;flex-direction:column"></div>',d=>{
      this.close(d); this.bind(d,"tab-links",()=>this.linksView(d)); this.bind(d,"tab-settings",()=>this.settingsView(d)); this.linksView(d);
    });
  }
  activeTab(d,id) { for(const el of d.querySelectorAll(".tab")) el.className="tab"+(el.id===id?" active":""); }
  linksView(d) {
    this.activeTab(d,"tab-links"); const links=this.c.data.links;
    const content=d.querySelector("#management-content");
    content.innerHTML=`<div class="intro row spread"><div><div class="eyebrow">FOLDER MAPPINGS</div><h1>Links</h1><p>${links.length} linked folders · Disk is the source of truth</p></div>${button("add","+ Add link",true)}</div><div class="body"><sp-textfield id="search" class="search" placeholder="Search bin or folder path"></sp-textfield><div class="table"><div class="table-head"><div class="col-bin">PREMIERE BIN</div><div class="col-flag">RELATIVE</div><div class="col-flag">SUBFOLDERS</div><div class="col-folder">SYSTEM FOLDER</div><div class="col-status">STATUS</div><div class="col-actions"></div></div><div id="rows"></div></div></div><div class="footer"><span class="hint">Relative: Off by default · Subfolders: On by default</span>${button("close","Close")}</div>`;
    const render=()=>{
      const query=content.querySelector("#search").value.toLowerCase();
      const rows=content.querySelector("#rows"), filtered=links.filter(l=>(l.binPath+" "+l.folderPath).toLowerCase().includes(query));
      rows.innerHTML=filtered.length?filtered.map(l=>`<div class="table-row"><div class="col-bin path" title="${esc(l.binPath)}">${esc(l.binPath)}</div><div class="col-flag"><sp-checkbox id="relative-${l.id}" ${l.relative?"checked":""}></sp-checkbox></div><div class="col-flag"><sp-checkbox id="sub-${l.id}" ${l.subfolders?"checked":""}></sp-checkbox></div><div class="col-folder path" title="${esc(l.folderPath)}">${esc(l.folderPath)}</div><div class="col-status"><span class="pill ${l.paused?"paused":""}">${l.paused?"Paused":"Active"}</span></div><div class="col-actions"><div class="small-button" role="button" tabindex="0" id="edit-${l.id}">Edit</div><div class="small-button" role="button" tabindex="0" id="pause-${l.id}">${l.paused?"Resume":"Pause"}</div><div class="small-button" role="button" tabindex="0" id="remove-${l.id}" title="Remove link only">×</div></div></div>`).join(""):'<div class="empty"><h2>No folders linked</h2><p>Add a link to connect a Premiere bin to a system folder.</p></div>';
      for(const l of filtered) {
        this.bind(rows,"edit-"+l.id,async()=>{ await this.existing(l); this.linksView(d); });
        this.bind(rows,"pause-"+l.id,async()=>{ l.paused=!l.paused; await this.c.persist(); this.linksView(d); });
        this.bind(rows,"remove-"+l.id,async()=>{ this.c.data.links=this.c.data.links.filter(x=>x.id!==l.id); delete this.c.data.records[l.id]; await this.c.persist(); this.linksView(d); });
        rows.querySelector("#relative-"+l.id).addEventListener("change",async e=>{
          try { const path=P.resolve(P.dirname(this.c.path),l.folderPath); l.relative=e.target.checked; l.folderPath=l.relative?P.relative(P.dirname(this.c.path),path):path; await this.c.persist(); render(); } catch(err) { await this.error(err.message); this.linksView(d); }
        });
        rows.querySelector("#sub-"+l.id).addEventListener("change",async e=>{ try { l.subfolders=e.target.checked; await this.c.persist(); } catch(err) { await this.error(err.message); } });
      }
    };
    content.querySelector("#search").addEventListener("input",render); render(); this.bind(content,"close",()=>d.close());
    this.bind(content,"add",async()=>{ await this.add(); this.linksView(d); });
  }
  settingsView(d) {
    this.activeTab(d,"tab-settings"); const settings={...this.c.data.settings}, content=d.querySelector("#management-content");
    const options=(group,list)=>list.map(([value,title,copy])=>`<div id="${group}-${value}" class="option ${settings[group]===value?"selected":""}"><strong><span class="dot">${settings[group]===value?"◉":"○"}</span>${title}</strong><span class="muted">${copy}</span></div>`).join("");
    const modes=[["AUTO","Auto","Apply safe changes automatically"],["ASK","Ask when needed","Sync safe batches directly; review blocking items"],["MANUAL","Manual","Apply changes from Main Panel or Status Sync"]];
    const mp4=[["AUTO","Fix automatically","Prepare media before import"],["ASK","Ask before fixing","Recommended default"],["NONE","Don’t fix","Import original media only"]];
    const render=()=>{
      content.innerHTML=`<div class="intro"><div class="eyebrow">PROJECT PREFERENCES</div><h1>Settings</h1><p>Global behavior for this project</p></div><div class="body"><div class="columns"><div class="column"><h2>Sync mode</h2><p>Global for this project</p>${options("mode",modes)}</div><div class="column"><h2>Fragmented MP4</h2><p>Applied before import</p>${options("mp4",mp4)}</div></div><div class="row spread" style="margin-top:16px"><div><h2>Source clip markers</h2><p>TXT name is contained in the MP4 name · Same folder</p></div><sp-checkbox id="auto-markers" ${settings.autoMarkers!==false?"checked":""}>Find and apply TXT during Sync</sp-checkbox></div><div class="row spread" style="margin-top:20px"><div><h2>Notifications</h2><p>Auto mode stays quiet after success</p></div><sp-checkbox id="warnings" ${settings.warnings?"checked":""}>Show warnings and errors</sp-checkbox><sp-checkbox id="success" ${settings.success?"checked":""}>Show successful syncs</sp-checkbox></div></div><div class="footer">${button("cancel","Cancel")}${button("save","Save settings",true)}</div>`;
      for(const [group,list] of [["mode",modes],["mp4",mp4]]) for(const [value] of list) this.bind(content,group+"-"+value,()=>{ settings.autoMarkers=content.querySelector("#auto-markers").checked; settings.warnings=content.querySelector("#warnings").checked; settings.success=content.querySelector("#success").checked; settings[group]=value; render(); });
      this.bind(content,"cancel",()=>this.linksView(d));
      this.bind(content,"save",async()=>{ settings.autoMarkers=content.querySelector("#auto-markers").checked; settings.warnings=content.querySelector("#warnings").checked; settings.success=content.querySelector("#success").checked; this.c.data.settings=settings; await this.c.persist(); this.linksView(d); });
    }; render();
  }
  async add() {
    const choice=await this.modal("Add link",this.header("Add link")+`<div class="body"><h1>Connect folders to Premiere</h1><div id="existing" class="option"><strong>Link an existing bin</strong><p>Choose a Premiere bin and its system folder.</p></div><div id="matching" class="option"><strong>Create matching bins</strong><p>Select system folders and preview matching bins.</p></div></div><div class="footer">${button("cancel","Cancel")}</div>`,d=>{ this.close(d); this.bind(d,"existing",()=>d.close("existing")); this.bind(d,"matching",()=>d.close("matching")); },{width:560,height:350});
    if(choice==="existing") await this.existing(); else if(choice==="matching") await this.matching();
  }
  async chooseBin(allowRoot=false) {
    const project=await this.c.context(); if(!project) throw new Error("Open a saved Footage project first.");
    const inv=await H.inventory(project), bins=allowRoot?[{id:null,path:"",name:"Project root"},...inv.bins]:inv.bins;
    return this.modal("Choose Premiere bin",this.header("Premiere bin")+`<div class="body"><p>${esc(project.name)}</p><div class="choice-list">${bins.map((b,i)=>`<div class="small-button" role="button" tabindex="0" id="bin-${i}">${esc(b.path||b.name)}</div>`).join("")||'<p>No bins exist yet. Use Create matching bins.</p>'}</div></div><div class="footer">${button("cancel","Cancel")}</div>`,d=>{ this.close(d); bins.forEach((b,i)=>this.bind(d,"bin-"+i,()=>d.close(b))); },{width:620,height:430});
  }
  async existing(edit=null) {
    if(!await this.c.context()) throw new Error("Open the Footage project before adding a link.");
    const draft={id:edit?.id||"l"+Date.now(),binPath:edit?.binPath||"",binId:edit?.binId||null,folderPath:edit?P.resolve(P.dirname(this.c.path),edit.folderPath):"",relative:edit?.relative||false,subfolders:edit?.subfolders??true,paused:false};
    const result=await this.modal("Link existing bin",this.header(edit?"Edit link":"Link existing bin")+`<div class="body"><div class="field"><span class="field-label">Premiere bin</span><div class="field-row"><sp-textfield id="bin" value="${esc(draft.binPath)}" placeholder="Choose an existing bin"></sp-textfield>${button("choose","Choose…")}</div></div><div class="field"><span class="field-label">System folder</span><div class="field-row"><sp-textfield id="folder" value="${esc(draft.folderPath)}" placeholder="Folder path"></sp-textfield>${button("browse","Browse…")}</div></div><div class="row"><sp-checkbox id="relative" ${draft.relative?"checked":""}>Relative path</sp-checkbox><sp-checkbox id="subfolders" ${draft.subfolders?"checked":""}>Include subfolders</sp-checkbox></div><div class="notice">Disk is the source of truth. Existing matching bins and media are reused. Nothing is deleted from Premiere.</div><div id="form-error" class="issue-text"></div></div><div class="footer">${button("cancel","Cancel")}${button("analyze","Analyze link",true)}</div>`,d=>{
      this.close(d);
      this.bind(d,"choose",async()=>{ const b=await this.chooseBin(); if(b && typeof b==="object") { draft.binId=b.id; d.querySelector("#bin").value=b.path; } });
      this.bind(d,"browse",async()=>{ const f=await uxp.storage.localFileSystem.getFolder(); if(f) d.querySelector("#folder").value=f.nativePath; });
      this.bind(d,"analyze",async()=>{
        const bin=d.querySelector("#bin").value.trim(), path=d.querySelector("#folder").value.trim();
        const inv=await H.inventory(this.c.project), matches=inv.bins.filter(b=>b.path===bin);
        if(matches.length!==1||!path) { d.querySelector("#form-error").textContent="Choose one existing bin and a system folder."; return; }
        draft.binPath=bin; draft.binId=matches[0].id; draft.relative=d.querySelector("#relative").checked; draft.subfolders=d.querySelector("#subfolders").checked;
        draft.folderPath=draft.relative?P.relative(P.dirname(this.c.path),path):P.clean(path);
        d.close(draft);
      });
    },{width:680,height:430});
    if(result && typeof result==="object") await this.initial([result],edit?.id);
  }
  async matching() {
    if(!await this.c.context()) throw new Error("Open the Footage project before adding a link.");
    const selection=new Map(), expanded=new Set(), nodes=new Map(); let destination={path:"",id:null}, root="";
    const result=await this.modal("Create matching bins",this.header("Create matching bins")+`<div class="body"><div class="columns"><div class="column"><div class="field-row"><sp-textfield id="root" placeholder="Drive or folder path"></sp-textfield>${button("browse","Browse…")}${button("load","Open")}</div><sp-textfield id="search" placeholder="Search folders" style="margin:10px 0"></sp-textfield><div id="tree" class="tree"></div></div><div class="column" style="max-width:260px"><h2>Selection</h2><p id="count">0 folders selected</p><span class="field-label">Destination Premiere bin</span><p id="destination">Project root</p>${button("choose","Choose…")}<div style="margin-top:20px"><sp-checkbox id="relative">Relative paths</sp-checkbox><sp-checkbox id="subfolders" checked>Include subfolders</sp-checkbox></div><div class="notice">Each selected top-level folder becomes one link. Preview changes before applying.</div></div></div></div><div class="footer">${button("cancel","Cancel")}${button("analyze","Analyze selection",true)}</div>`,d=>{
      this.close(d); d.querySelector("#analyze").disabled=true;
      const render=()=>{
        const tree=d.querySelector("#tree"), query=d.querySelector("#search").value.toLowerCase(), visible=[];
        function visit(path,depth) { const entry=nodes.get(path); if(!entry) return; if(!query||path.toLowerCase().includes(query)) visible.push({path,depth}); if(expanded.has(path)) entry.children.forEach(child=>visit(child,depth+1)); }
        if(root) visit(root,0);
        tree.innerHTML=visible.map((n,i)=>`<div class="tree-row" style="padding-left:${n.depth*16}px"><div class="small-button" role="button" tabindex="0" id="expand-${i}">${expanded.has(n.path)?"▾":"▸"}</div><sp-checkbox id="select-${i}" ${selection.has(n.path)?"checked":""}></sp-checkbox><span class="path" title="${esc(n.path)}">${esc(P.basename(n.path)||n.path)}</span></div>`).join("");
        visible.forEach((n,i)=>{
          this.bind(tree,"expand-"+i,async()=>{ if(expanded.has(n.path)) expanded.delete(n.path); else { const children=[]; for(const name of await fs.readdir(n.path)) { const path=P.join(n.path,name), st=await fs.lstat(path); if(st.isDirectory() && !(st.isSymbolicLink?.())) { children.push(path); if(!nodes.has(path)) nodes.set(path,{children:[]}); } } nodes.get(n.path).children=children; expanded.add(n.path); } render(); });
          tree.querySelector("#select-"+i).addEventListener("change",e=>{ if(e.target.checked) selection.set(n.path,true); else selection.delete(n.path); d.querySelector("#count").textContent=selection.size+" folders selected"; d.querySelector("#analyze").disabled=!selection.size; });
        });
      };
      const load=async()=>{ root=P.clean(d.querySelector("#root").value); const st=await fs.lstat(root); if(!st.isDirectory()) throw new Error("Choose a folder."); nodes.clear(); expanded.clear(); selection.clear(); nodes.set(root,{children:[]}); d.querySelector("#count").textContent="0 folders selected"; d.querySelector("#analyze").disabled=true; render(); };
      this.bind(d,"load",load); this.bind(d,"browse",async()=>{ const f=await uxp.storage.localFileSystem.getFolder(); if(f) { d.querySelector("#root").value=f.nativePath; await load(); } });
      d.querySelector("#search").addEventListener("input",render);
      this.bind(d,"choose",async()=>{ const b=await this.chooseBin(true); if(b && typeof b==="object") { destination=b; d.querySelector("#destination").textContent=b.path||"Project root"; } });
      this.bind(d,"analyze",()=>{
        const paths=Array.from(selection.keys()).filter(p=>!Array.from(selection.keys()).some(other=>other!==p&&P.within(p,other)));
        const relative=d.querySelector("#relative").checked, subfolders=d.querySelector("#subfolders").checked;
        d.close(paths.map((path,i)=>({id:"l"+Date.now()+i,binId:null,binPath:P.join(destination.path,P.basename(path)),folderPath:relative?P.relative(P.dirname(this.c.path),path):path,relative,subfolders,paused:false})));
      });
    },{width:900,height:550});
    if(Array.isArray(result)) await this.initial(result);
  }
  async initial(drafts,editId=null) {
    const others=this.c.data.links.filter(l=>l.id!==editId), all=[...others,...drafts];
    for(const draft of drafts) for(const other of all) {
      if(draft.id===other.id) continue;
      const a=P.resolve(P.dirname(this.c.path),draft.folderPath), b=P.resolve(P.dirname(this.c.path),other.folderPath);
      if(P.within(a,b)||P.within(b,a)||draft.binPath===other.binPath) throw new Error("Links overlap. Choose independent folders and bins.");
    }
    const batch=await this.c.analyze(all);
    const confirm=await this.modal("Initial Sync",this.header("Initial Sync")+`<div class="body"><div class="eyebrow">RECONCILIATION PREVIEW</div><h1>Ready to link</h1>${drafts.map(l=>`<div class="card" style="margin-bottom:10px"><strong>${esc(l.binPath)}</strong><p>${esc(l.folderPath)}</p></div>`).join("")}<div class="metrics"><div class="metric"><strong>${batch.reused.filter(r=>r.kind==="file").length}</strong><span class="muted">Already imported</span></div><div class="metric"><strong>${batch.changes.filter(c=>["new-file","fragmented"].includes(c.kind)).length}</strong><span class="muted">To import</span></div><div class="metric"><strong>0</strong><span class="muted">Duplicates created</span></div></div>${this.changeRows(batch,false)}<h2>Source clip markers</h2>${this.markerRows(batch)}<div class="notice">Existing items are reused. Source files and Premiere items are never deleted.</div></div><div class="footer">${button("cancel","Cancel")}${button("confirm","Link & Sync",true)}</div>`,d=>{ this.close(d); this.bindMarkerRows(d,batch); this.bind(d,"confirm",()=>d.close("confirm")); },{width:850,height:620});
    if(confirm?.marker){await this.chooseMarker(confirm.marker);return this.initial(drafts,editId);}
    if(confirm!=="confirm") return;
    if(batch.hasBlocking) await this.review(batch); else await this.c.apply(batch);
  }
  markerRows(batch) {
    return (batch.media||[]).map((m,i)=>`<div class="history-row" id="marker-row-${i}"><div class="row spread"><strong class="path" title="${esc(m.path)}">${m.markerSource?'<span class="marker-indicator" title="Marker TXT found">◆</span> ':""}${esc(P.basename(m.path))}</strong><div class="small-button" role="button" tabindex="0" id="txt-${i}">Choose TXT…</div></div><span class="muted path" title="${esc(m.markerSource?.path||"")}">${esc(m.markerSource?P.basename(m.markerSource.path):"No marker TXT selected")}${m.markerState==="applied"?" · Applied or skipped":m.markerState==="review"?" · Needs review":""}</span>${m.markerIssue?`<span class="issue-text">${esc(m.markerIssue)}</span>`:""}</div>`).join("");
  }
  bindMarkerRows(d,batch) {
    (batch.media||[]).forEach((m,i)=>{
      const choose=()=>d.close({marker:m});this.bind(d,"txt-"+i,choose);
      d.querySelector("#marker-row-"+i)?.addEventListener("contextmenu",e=>{e.preventDefault();choose();});
    });
  }
  async chooseMarker(entry) {
    const file=await uxp.storage.localFileSystem.getFileForOpening({types:["txt"]});
    if(file)await this.c.chooseMarkers(entry,file.nativePath);
  }
  markerWarnings(batch) {
    return (batch.warnings||[]).map(w=>`<div class="notice error"><strong>${esc(P.basename(w.txtPath||w.path))}</strong><p>${esc(w.message)}</p><span class="muted">Video import can continue. Fix the TXT, then Sync again.</span></div>`).join("");
  }
  changeRows(batch,selectable) {
    return this.markerWarnings(batch)+(batch.changes.map(c=>`<div class="change ${c.blocking?"blocked":""}">${selectable?`<sp-checkbox id="change-${c.id}" ${c.blocking?"disabled":"checked"}></sp-checkbox>`:""}<div class="change-detail"><strong>${esc(label[c.kind]||c.kind)}</strong><div class="path" title="${esc(c.path)}">${esc(c.path)}</div>${c.from?`<div class="muted path">From: ${esc(c.from)}</div>`:""}${c.message?`<div class="issue-text">${esc(c.message)}</div>`:""}</div></div>`).join("")||'<p>No changes needed. Existing structure will be reused.</p>');
  }
  async review(batch) {
    const decisions={};
    const result=await this.modal("Review Changes",this.header("Review Changes")+`<div class="body"><h1>${batch.changes.length} changes detected</h1><p>${batch.changes.filter(c=>!c.blocking).length} safe · ${batch.changes.filter(c=>c.blocking).length} blocking — nothing applied before confirmation</p><div class="columns"><div class="column">${this.changeRows(batch,true)}<h2>Source clip markers</h2>${this.markerRows(batch)}</div><div class="column" style="max-width:300px"><h2>Needs a decision</h2>${batch.changes.filter(c=>c.blocking).map(c=>`<div class="card" style="margin-bottom:10px"><strong>${esc(label[c.kind])}</strong><p class="path" title="${esc(c.path)}">${esc(P.basename(c.path))}</p><p>${esc(c.message)}</p>${c.kind==="marker-choice"?`<p class="issue-text">Replace removes every marker on this source clip, including manual markers.</p>${(c.pendingMode?[c.pendingMode,"skip"]:["replace","append","skip"]).map(mode=>`<div class="small-button" role="button" tabindex="0" id="marker-${mode}-${c.id}">${mode==="replace"?"Replace markers":mode==="append"?"Add to existing":"Skip TXT"}</div>`).join("")}`:c.kind==="fragmented"?`<p class="issue-text">Automatic repair is not available in this development build.</p><div class="small-button" role="button" tabindex="0" id="original-${c.id}">Import original</div><div class="small-button" role="button" tabindex="0" id="skip-${c.id}">Later</div>`:'<p class="muted">Resolve the source or link, then scan again. This item stays pending.</p>'}</div>`).join("")||'<p>No blocking items.</p>'}</div></div></div><div class="footer"><span class="hint">Selected changes only · No automatic deletes</span>${button("later","Later")}${button("apply","Sync selected",true)}</div>`,d=>{
      this.close(d); this.bindMarkerRows(d,batch); this.bind(d,"later",()=>d.close("cancel"));
      for(const c of batch.changes.filter(c=>c.kind==="marker-choice"))for(const mode of ["replace","append","skip"])this.bind(d,"marker-"+mode+"-"+c.id,()=>{decisions[c.id]=mode;const el=d.querySelector("#change-"+c.id);el.disabled=false;el.checked=true;for(const other of ["replace","append","skip"]){const b=d.querySelector("#marker-"+other+"-"+c.id);if(b)b.className="small-button"+(mode===other?" selected":"");}});
      for(const c of batch.changes.filter(c=>c.kind==="fragmented")) {
        this.bind(d,"original-"+c.id,()=>{ decisions[c.id]="original"; const el=d.querySelector("#change-"+c.id); el.disabled=false; el.checked=true; });
        this.bind(d,"skip-"+c.id,()=>{ delete decisions[c.id]; const el=d.querySelector("#change-"+c.id); el.disabled=true; el.checked=false; });
      }
      this.bind(d,"apply",()=>d.close({selected:batch.changes.filter(c=>d.querySelector("#change-"+c.id)?.checked).map(c=>c.id),decisions}));
    },{width:900,height:620});
    if(result?.marker){await this.chooseMarker(result.marker);return this.review(await this.c.scan());}
    if(result && typeof result==="object") await this.c.apply(batch,result.selected,result.decisions);
  }
  async status() {
    try { await this.c.scan(); } catch(_) { /* Show the real error in Status. */ }
    const batch=this.c.batch, changes=batch?.changes||[], blocking=changes.filter(c=>c.blocking), unavailable=changes.some(c=>c.kind==="unavailable");
    const title=this.c.error?"Needs attention":unavailable?"Folder unavailable":blocking.length?"Changes need review":batch?.warnings?.length?"Marker warnings":changes.length?"Changes detected":this.c.path?"Up to date":"Open a project";
    const result=await this.modal("Footage Sync — Status",this.header("Status")+`<div class="body">${this.c.error?`<div class="notice error">${esc(this.c.error)}</div>`:""}<div class="card row spread"><div><div class="eyebrow">CURRENT STATUS</div><h1>${title}</h1><p>${esc(this.c.project?.name||"No saved project open")}</p></div>${button("sync-now","Sync now")}</div><div class="metrics"><div id="active-links" class="metric"><strong>${this.c.data.links.filter(l=>!l.paused).length}</strong><span class="muted">Active links</span></div><div class="metric"><strong>${changes.length}</strong><span class="muted">Pending changes</span></div><div class="metric"><strong>${blocking.length}</strong><span class="muted">Blocking items</span></div></div><div class="columns"><div class="column card"><h2>Sync history</h2>${this.c.data.history.map(h=>`<div class="history-row"><strong>${esc(h.message)}</strong><span class="muted">${esc(new Date(h.time).toLocaleString())} · ${h.count} changes applied</span></div>`).join("")||'<p>No syncs yet.</p>'}</div><div class="column card"><h2>Needs attention</h2>${blocking.map(c=>`<div class="history-row"><strong>${esc(label[c.kind])}</strong><span class="muted path" title="${esc(c.path)}">${esc(c.path)}</span></div>`).join("")||(!(batch?.warnings?.length)?'<p>No issues detected.</p>':'')}${this.markerWarnings(batch||{})}${button("review","Review changes")}</div></div><h2>Source clip markers</h2>${this.markerRows(batch||{})}</div><div class="footer"><span class="hint">No automatic deletes · Disk → Premiere</span>${button("close","Close")}</div>`,d=>{
      this.close(d); this.bindMarkerRows(d,batch||{}); if(unavailable) d.querySelector("#sync-now").disabled=true;
      this.bind(d,"active-links",async()=>{ await this.management(); });
      this.bind(d,"sync-now",async()=>{ d.close(); await this.sync(); });
      this.bind(d,"review",async()=>{ if(batch) { d.close(); await this.review(batch); } });
    },{width:850,height:600});
    if(result?.marker){await this.chooseMarker(result.marker);return this.status();}
  }
}
module.exports={UI};
