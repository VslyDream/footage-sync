"use strict";
const P=require("./core/paths"),Dates=require("./core/footage-dates"),Ignore=require("./core/ignore"),V=require("./core/changes-view");
const {previewTree, branchItems}=require("./core/preview-tree");
const esc=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const action=(id,text,cls="quiet")=>`<div id="${id}" class="${cls}" role="button" tabindex="0">${text}</div>`;
const button=(id,text,primary=false)=>`<sp-button id="${id}" variant="${primary?"cta":"secondary"}">${text}</sp-button>`;
const chip=(text,amber=false)=>`<span class="tag ${amber?"amber":""}">${esc(text)}</span>`;
const size=n=>n>=1e9?(n/1e9).toFixed(1)+" GB":n>=1e6?(n/1e6).toFixed(1)+" MB":Math.round(n/1e3)+" KB";
const time=t=>t?new Date(t).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"never";
const elapsed=n=>Math.floor(n/60000)+":"+String(Math.floor(n/1000)%60).padStart(2,"0");
const {processStages,willAppend}=require("./core/process-view");
const editor=Symbol("return to editor");
module.exports.redesign=(Base,{H})=>class extends Base {
  previewFolders(preview,state,selection,renderFile,treeMode){
    const rows=[], selected=new Set(selection.selected), expanded=state.expanded;
    const resolved=new Set();
    for(const change of preview.batch.changes){
      const decision=state.decision(change);
      if(decision && decision!=="defer")resolved.add(change.id);
    }
    const draftRoots=preview.drafts.map(l=>P.resolve(P.dirname(this.c.path),l.folderPath));
    const disclosure=(id,label,open,cls)=>`<div id="${id}" class="${cls}" role="button" tabindex="0" aria-expanded="${open}">${open?"▾":"▸"} &nbsp; ${label}</div>`;
    const reuseFile=file=>`<div class="file-row reused-file"><span class="success-check">✓</span><span class="path file-name" title="${esc(file.path)}">${esc(P.basename(file.path))}</span></div>`;
    const render=(node,depth,reuse)=>{
      const key=(reuse?"reuse:":"folder:")+node.key;
      const children=node.children.filter(child=>reuse?child.hasReuse:child.hasChanges);
      const items=reuse?[]:node.items.filter(c=>c.kind!=="new-folder");
      const leaves=reuse?node.reused:[];
      const canOpen=Boolean(children.length||items.length||leaves.length);
      const defaultOpen=!reuse && preview.tree.includes(node);
      const expansionKey=defaultOpen?"folded:"+key:key;
      const open=canOpen && (defaultOpen?!expanded.has(expansionKey):expanded.has(expansionKey)), index=rows.length;
      const row={node,key:expansionKey,index,reuse};
      rows.push(row);
      let checked=0, selectable=0;
      if(!reuse)for(const c of branchItems(node,resolved)){selectable++;if(selected.has(c.id))checked++;}
      const name=esc(P.basename(node.path)||node.path);
      const label=canOpen?disclosure("preview-expand-"+index,name,open,"group-label path"):`<span class="group-label path">${name}</span>`;
      const mark=reuse?'<span class="success-check">✓</span>':selectable?`<sp-checkbox id="preview-check-${index}" aria-label="${esc(node.path)}" ${checked===selectable?"checked":""}></sp-checkbox>`:"";
      const summary=[];
      if(selectable)summary.push((checked===selectable?checked:checked+" of "+selectable)+" selected");
      if(!reuse && node.fileCount)summary.push(node.fileCount+(node.fileCount===1?" file":" files")+(node.bytes?" · "+size(node.bytes):""));
      if(node.reuseCount)summary.push(node.reuseCount+" reused");
      else if(reuse)summary.push("already in the project");
      if(!reuse && node.renamed)summary.push(node.renamed+" renamed");
      if(!reuse && node.moved)summary.push(node.moved+" moved");
      if(!reuse && node.decisionCount)summary.push(node.decisionCount+" in Needs you");
      if(!reuse && !children.length && !open)summary.push(...items.slice(0,2).map(c=>P.basename(c.path)));
      const tags=[];
      if(!reuse){
        if(node.items.some(c=>c.kind==="new-folder"))tags.push(chip("new bin"));
        if(node.excluded)tags.push(chip("excluded",true));
        if(node.warnings)tags.push(chip(node.warnings+" TXT skipped",true));
      }
      const menu=!node.excluded?action("preview-more-"+index,"⋯","more"):"";
      let html=`<div class="group-row preview-folder${node.excluded?" excluded":""}" title="${esc(node.path)}" style="padding-left:${12+depth*18}px">${mark}${label}${tags.join("")}<span class="group-summary muted">${esc(summary.join(" · "))}</span>${menu}</div>`;
      if(open){
        for(const child of children)html+=render(child,depth+1,reuse);
        const files=items.map(renderFile).join("")+leaves.map(reuseFile).join("");
        if(files)html+=`<div style="padding-left:${depth*18}px">${files}</div>`;
      }
      return html;
    };
    const forest=reuse=>preview.tree.filter(node=>reuse?node.hasReuse:node.hasChanges).map(node=>{
      const rootNeeded=preview.tree.length>1 || (reuse?node.reused.length:node.items.length||node.decisions.length||node.excluded||node.warnings);
      if(rootNeeded||!node.children.length)return render(node,0,reuse);
      return node.children.filter(child=>reuse?child.hasReuse:child.hasChanges).map(child=>render(child,0,reuse)).join("");
    }).join("");
    const active=treeMode?forest(false):"";
    const detailsOpen=expanded.has("preview-reuse-details");
    const details=preview.tree.some(n=>n.hasReuse)?disclosure("preview-reuse","Already in the project",detailsOpen,"quiet reused-disclosure")+(detailsOpen?forest(true):""):"";
    const bindMenu=(d,root,redraw,anchor,node,reuse=false)=>{
      this.bind(root,anchor,()=>{
          const subtree=[],collect=n=>{subtree.push(n);n.children.forEach(collect);};collect(node);
          const files=new Map();
          for(const n of subtree)for(const c of reuse?n.reused:[...n.items,...n.decisions,...n.reused]){
            if(P.isAbsolute(c.path))files.set(P.key(c.path),c.path);
          }
          const exclude=draftRoots.some(base=>P.within(node.path,base)&&node.key!==P.key(base));
          this.menu(d,[
            {text:"Exclude this folder",disabled:!exclude,hint:"Not synced; nothing in Premiere is touched",run:()=>d.close({action:"exclude-preview",path:node.path})},
            {text:"Show all "+files.size+" files",disabled:!files.size,run:()=>{
              if(!reuse)state.groupBy="Folder";
              const prefix=reuse?"reuse:":"folder:";
              const show=n=>{
                if(!P.within(node.path,n.path)&&!P.within(n.path,node.path))return;
                expanded.delete("folded:"+prefix+n.key);
                expanded.add(prefix+n.key);
                n.children.forEach(show);
              };
              preview.tree.forEach(show);
              if(!reuse && node.hasReuse){
                expanded.add("preview-reuse-details");
                // Open the path to the same node in the read-only tree, too.
                const show=n=>{if(P.within(node.path,n.path)||P.within(n.path,node.path)){expanded.add("reuse:"+n.key);n.children.forEach(show);}};
                preview.tree.forEach(show);
              }
              redraw();
            }},
            {text:"Ignore a file…",disabled:!files.size,run:()=>d.close({action:"pick-ignore-file",files:[...files.values()]})}
          ],anchor);
      });
    };
    const bind=(d,root,redraw)=>{
      const toggle=key=>{if(expanded.has(key))expanded.delete(key);else expanded.add(key);redraw();};
      this.bind(root,"preview-reuse",()=>toggle("preview-reuse-details"));
      for(const {node,key,index,reuse} of rows){
        this.bind(root,"preview-expand-"+index,()=>toggle(key));
        root.querySelector("#preview-check-"+index)?.addEventListener("change",e=>{
          for(const c of branchItems(node,resolved))state.check(c,e.target.checked);
          redraw();
        });
        if(!node.excluded)bindMenu(d,root,redraw,"preview-more-"+index,node,reuse);
      }
    };
    const find=(path,nodes=preview.tree)=>{
      for(const node of nodes){
        if(node.key===P.key(path))return node;
        if(P.within(path,node.path))return find(path,node.children);
      }
    };
    return {active,details,bind,find,bindMenu};
  }
  async ignorePreviewFile(files){
    if(!files.length)return;
    let path=files[0];
    if(files.length>1){
      const picked=await this.modal("Choose a file to ignore",
        `<div class="body"><sp-textfield id="ignore-search" placeholder="Find a file by name or path"></sp-textfield><div class="choice-list marker-targets" id="ignore-targets"></div></div><div class="footer">${button("cancel","Cancel")}</div>`,d=>{
          this.close(d);
          const search=d.querySelector("#ignore-search"),list=d.querySelector("#ignore-targets");
          const render=()=>{
            const query=search.value.toLowerCase(),matches=files.filter(file=>file.toLowerCase().includes(query));
            const visible=matches.slice(0,100);
            list.innerHTML=visible.map((file,i)=>action("ignore-target-"+i,`<strong>${esc(P.basename(file))}</strong><div class="muted path" title="${esc(file)}">${esc(file)}</div>`,"small-button")).join("")||"<p>No matching files.</p>";
            if(matches.length>visible.length)list.innerHTML+=`<p>Showing ${visible.length} of ${matches.length} files. Refine your search to see more.</p>`;
            visible.forEach((file,i)=>this.bind(list,"ignore-target-"+i,()=>d.close({path:file})));
          };
          search.addEventListener("input",render);render();
        },{width:650,height:450});
      if(!picked?.path)return;
      path=picked.path;
    }
    await this.ignorePath(path,"file");
  }
  constructor(c){super(c);this.view={tab:"changes",changes:new V.ChangesState(),search:"",historySearch:"",history:0,scroll:{}};}
  update(){if(!this.c.busy){this.runningCount=null;this.runningChanges=null;this.runSelection=null;}this.mainPanel?.update(this.c);this.refreshWindow?.();}
  header(title,tabs=false){return tabs?`<div class="window-header"><span class="brand">FS</span>${["changes","history","links","settings"].map(t=>action("tab-"+t,t[0].toUpperCase()+t.slice(1)+(t==="changes"?'<span id="tab-count" class="count"></span>':""),"tab")).join("")}${action("window-more","⋯","more window-more")}</div>`:"";}
  management(){return this.openWindow("links");}
  status(){return this.openWindow("changes");}
  review(batch){this.c.batch=batch;return this.openWindow("changes");}
  async sync(){if(this.c.busy)return this.status();try{const batch=await this.c.scan();if(batch.hasBlocking)return this.review(batch);await this.c.apply(batch);}catch(e){this.c.error=e.message;return this.status();}}
  saveWindow(){const d=this.windowDialog;if(!d)return;const body=d.querySelector("#view-scroll");if(body)this.view.scroll[this.renderedTab||this.view.tab]=body.scrollTop||0;}
  startApply(batch,selection,options=selection.options){
    const selected=new Set(selection.selected);
    this.runningCount=selection.count;
    this.runningChanges=batch.changes.filter(c=>selected.has(c.id));
    this.runSelection=selection;
    const appends=!options.filesOnly&&this.runningChanges.some(c=>willAppend(c,selection.decisions));
    return {appends,pending:this.c.apply(batch,selection.selected,selection.decisions,options)};
  }
  async openWindow(tab="changes"){
    if(this.windowDialog){this.saveWindow();this.view.tab=tab;this.renderWindow();return;}
    if(this.windowPromise)return;
    this.view.tab=tab;
    const run=async()=>this.dialogFlow(async()=>{
      if(!this.c.busy)this.c.scan(undefined,true).catch(e=>{this.c.error=e.message;this.update();});
      for(;;){
        let timer,result;
        try{result=await this.modal("Footage Sync",this.header("Footage Sync",true)+'<div id="management-content" class="view-content"></div><div id="menu-host"></div>',d=>{
          this.windowDialog=d;this.close(d);
          for(const t of ["changes","history","links","settings"])this.bind(d,"tab-"+t,()=>{this.saveWindow();this.view.tab=t;this.renderWindow();});
          this.bind(d,"window-more",()=>this.menu(d,[{text:"Add markers from TXT…",hint:"Pick a TXT, then the clip it belongs to",disabled:this.c.busy,run:()=>this.leave({action:"markers"})},{text:`Ignored files and folders (${(this.c.data.ignored||[]).length})…`,run:()=>this.leave({action:"ignored"})},{text:"Change import project or timeline…",separator:true,disabled:this.c.busy,run:()=>this.leave({action:"targets"})}],"window-more"));
          d.addEventListener?.("keydown",e=>{if(e.key==="Escape"&&this.menuOpen){e.preventDefault();e.stopPropagation();this.hideMenu(d);}});
          this.refreshWindow=()=>{if(this.c.busy&&this.view.tab==="changes"){const el=d.querySelector("#operation-details");if(el){el.innerHTML=this.operationDetails();this.updateHeader();return;}}this.renderWindow();};
          this.renderWindow();timer=setInterval(()=>{if(this.c.busy&&this.view.tab==="changes")this.refreshWindow?.();},500);
        },{width:1000,height:670});}finally{clearInterval(timer);this.refreshWindow=null;this.windowDialog=null;this.menuOpen=false;}
        if(!result?.action){
          await this.c.acknowledgeMarkerWarnings?.(this.reviewedWarnings);
          this.view.changes.clearDeferred();
          return;
        }
        try{
          if(result.action==="apply"){
            const {appends,pending}=this.startApply(result.batch,result.selection);
            pending.catch(e=>{this.c.error=e.message;}).finally(()=>{this.view.changes.clearDeferred();this.update();});
            if(appends)return;
          }
          else if(result.action==="check")await this.c.scan();
          else if(result.action==="add"){if(await this.add()===editor)return;}
          else if(result.action==="edit"){if(await this.existing(result.link)===editor)return;}
          else if(result.action==="exclude")await this.excludeSubfolders(result.link);
          else if(result.action==="unavailable"){if(await this.unavailable(result.link)===editor)return;}
          else if(result.action==="remove")await this.removeLink(result.link);
          else if(result.action==="ignored")await this.ignoredPaths();
          else if(result.action==="ignore"){if(await this.ignorePath(result.source.path,result.source.kind))await this.c.scan();}
          else if(result.action==="markers"){await this.addMarkers(this.c.batch||{},result.entry);await this.c.scan();}
          else if(result.action==="targets"){await this.targets();await this.c.scan();}
        }catch(e){this.c.error=e.message;}
      }
    });
    this.windowPromise=run();try{return await this.windowPromise;}finally{this.reviewedWarnings=null;this.windowPromise=null;this.refreshWindow=null;this.windowDialog=null;}
  }
  leave(value){this.saveWindow();this.windowDialog?.close(value);}
  updateHeader(){const d=this.windowDialog;if(!d)return;const s=V.summary(this.c.batch||{});if(this.c.error)s.needs++;for(const t of ["changes","history","links","settings"]){const el=d.querySelector("#tab-"+t);el.className="tab"+(this.view.tab===t?" active":"")+(t==="changes"&&s.needs?" attention-tab":"");el.setAttribute?.("aria-current",this.view.tab===t?"page":"false");}const count=d.querySelector("#tab-count");count.textContent=this.c.busy?"◌":s.needs||s.count||"";count.style.display=count.textContent?"inline-block":"none";}
  renderWindow(){const d=this.windowDialog;if(!d)return;this.saveWindow();this.hideMenu(d);this.updateHeader();if(this.view.tab==="links")this.linksView(d);else if(this.view.tab==="settings")this.settingsView(d);else if(this.view.tab==="history")this.historyView(d);else this.changesView(d,this.c.batch||{changes:[]},this.view.changes);this.renderedTab=this.view.tab;const body=d.querySelector("#view-scroll");if(body)body.scrollTop=this.view.scroll[this.view.tab]||0;}
  hideMenu(d){const host=d.querySelector("#menu-host");if(host)host.innerHTML="";this.menuOpen=false;}
  menu(d,items,anchorId){const host=d.querySelector("#menu-host");if(!host)return;if(this.menuOpen===anchorId){this.hideMenu(d);return;}this.menuOpen=anchorId;host.innerHTML=`<div class="menu-shade" id="menu-dismiss"></div><div class="context-menu" id="active-menu">${items.map((m,i)=>`${m.separator?'<div class="menu-separator"></div>':""}${action("menu-item-"+i,esc(m.text)+(m.hint?`<span class="muted">${esc(m.hint)}</span>`:""),"menu-item"+(m.disabled?" disabled":"")+(m.danger?" danger":""))}`).join("")}</div>`;this.bind(host,"menu-dismiss",()=>this.hideMenu(d));items.forEach((m,i)=>{const el=host.querySelector("#menu-item-"+i);el.disabled=Boolean(m.disabled);this.bind(host,"menu-item-"+i,async()=>{this.hideMenu(d);await m.run();});});const anchor=d.querySelector("#"+anchorId),box=anchor?.getBoundingClientRect?.(),origin=d.getBoundingClientRect?.(),menu=host.querySelector("#active-menu");if(box&&origin){menu.style.top=Math.max(48,Math.min(box.bottom-origin.top,origin.height-items.length*55-12))+"px";menu.style.right=Math.max(12,origin.right-box.right)+"px";}}
  targetName(){const p=this.c.workspace?.importProject,s=this.c.data.settings?.sequenceTarget;return `${esc(p?.name||"No import project selected")}${Dates.enabled(this.c.data.settings)&&s?" → "+esc(s.projectName+" / "+s.sequenceName):""}`;}
  strip(){const batch=this.c.batch||{},paused=(this.c.data.links||[]).filter(l=>l.paused||batch.scans?.[l.id]?.error).length;return `<div class="status-strip"><span>Into <span class="value">${this.targetName()}</span> · ${this.c.busy?"sync started "+time(this.c.operation?.startedAt):"last sync "+time(this.c.data.history?.[0]?.time)}</span>${paused?action("paused-links",`${paused} link${paused===1?"":"s"} paused`):""}${action("check-now","Check now","quiet strip-end")}</div>`;}
  projectControls(){const s=this.c.data.settings||{},p=this.c.workspace?.importProject,t=s.sequenceTarget;return `<div class="status-strip ${!p?"target-missing":""}"><span>Into <strong class="value" title="${esc(p?.path)}">${esc(p?.name||"Not selected")}</strong> · new videos</span><div id="sequence-enabled" class="sequence-toggle ${Dates.enabled(s)?"enabled":""}" role="switch" tabindex="0" aria-label="Add new videos to timeline" aria-checked="${Dates.enabled(s)}"><span></span></div><span class="path value" title="${esc(t?.projectPath)}">→ ${esc(t?t.projectName+" / "+t.sequenceName:"No timeline selected")}</span>${action("change-targets",p?"Change…":"Choose…","quiet strip-end")}</div>`;}
  async targets(){const choice=await this.modal("Import project and timeline",this.header("Import project and timeline")+`<div class="body"><p>${this.targetName()}</p>${action("choose-project","Change import project…","option")}${action("choose-sequence","Change timeline…","option")}</div><div class="footer">${button("close","Close")}</div>`,d=>{this.close(d);this.bind(d,"choose-project",()=>d.close("project"));this.bind(d,"choose-sequence",()=>d.close("sequence"));},{width:640,height:300});if(choice==="project"){const p=await this.chooseProject();if(p&&typeof p==="object"){await this.c.selectProject(p);this.view.changes=new V.ChangesState();}}else if(choice==="sequence"){const s=await this.chooseSequence();if(s&&typeof s==="object")await this.c.selectSequence(s);}}
  linksView(d){const content=d.querySelector("#management-content"),links=this.c.data.links||[],batch=this.c.batch||{};content.innerHTML=this.projectControls()+`<div class="links-toolbar row"><sp-textfield id="search" placeholder="Search bin or folder"></sp-textfield>${action("links-more","⋯","more")}${button("add","+ Add link",true)}</div><div class="body" id="view-scroll"><div class="table"><div class="link-row table-head"><div class="mapping">BIN ↔ FOLDER</div><div class="link-options">OPTIONS</div><div class="link-state">STATE</div><div class="more-space"></div></div><div id="rows"></div></div></div><div class="footer"><span class="hint">Saved automatically</span>${button("close","Close")}</div>`;
    const render=()=>{const q=content.querySelector("#search").value.toLowerCase();this.view.search=q;const filtered=links.filter(l=>(l.binPath+" "+l.folderPath).toLowerCase().includes(q)),rows=content.querySelector("#rows");rows.innerHTML=filtered.map((l,i)=>{const offline=batch.scans?.[l.id]?.error,n=V.countChanges((batch.changes||[]).filter(c=>c.linkId===l.id)),excluded=(this.c.data.ignored||[]).filter(r=>r.linkId===l.id&&r.origin==="excluded").length;return `<div class="link-row ${offline?"unavailable-row":""}"><div class="mapping"><strong class="path">${esc(l.binPath||"Project root")}</strong><div class="muted path" title="${esc(l.folderPath)}">${esc(l.folderPath)}</div></div><div class="link-options">${l.subfolders?chip("Subfolders"):""}${l.relative?chip("Relative"):""}${excluded?chip(excluded+" folders excluded",true):""}</div><div class="link-state"><span class="state-dot ${offline?"red":l.paused?"grey":"green"}"></span>${offline?"Unavailable":l.paused?"Paused":"Active"}${offline?action("reconnect-"+i,"Reconnect…"):l.paused?action("resume-"+i,"Resume"):`<span class="muted"> · ${n?n+" pending":"up to date"}</span>`}</div>${action("link-menu-"+i,"⋯","more")}</div>`;}).join("")||'<div class="empty"><h2>No folders linked</h2><p>Add a link to connect a Premiere bin to a system folder.</p></div>';filtered.forEach((l,i)=>{const pause=async()=>{if(this.c.busy)throw new Error("Wait for the current sync to finish.");const old=l.paused;l.paused=!old;try{await this.c.persist();await this.c.scan();this.renderWindow();}catch(e){l.paused=old;throw e;}};this.bind(rows,"resume-"+i,pause);this.bind(rows,"reconnect-"+i,()=>this.leave({action:"unavailable",link:l}));this.bind(rows,"link-menu-"+i,()=>this.menu(d,[{text:"Edit link…",run:()=>this.leave({action:"edit",link:l})},{text:"Exclude subfolders…",hint:"Choose folders this link skips",run:()=>this.leave({action:"exclude",link:l})},{text:l.paused?"Resume":"Pause",run:pause},{text:"Remove link…",danger:true,separator:true,run:()=>this.leave({action:"remove",link:l})}],"link-menu-"+i));});};
    content.querySelector("#search").value=this.view.search;content.querySelector("#search").addEventListener("input",render);render();this.bind(content,"close",()=>d.close());this.bind(content,"add",()=>this.leave({action:"add"}));content.querySelector("#add").disabled=this.c.busy;this.bind(content,"change-targets",()=>this.leave({action:"targets"}));this.bind(content,"links-more",()=>this.menu(d,[{text:`Ignored files and folders (${(this.c.data.ignored||[]).length})…`,run:()=>this.leave({action:"ignored"})}],"links-more"));const box=content.querySelector("#sequence-enabled");box.disabled=this.c.busy;this.bind(content,"sequence-enabled",async()=>{await this.c.setSequenceEnabled(!Dates.enabled(this.c.data.settings));await this.c.scan();this.renderWindow();});
  }
  settingsView(d){const content=d.querySelector("#management-content"),s=this.c.data.settings||{},mode=s.mode==="MANUAL"?"ASK":s.mode;const option=(id,title,desc,checked,disabled=false)=>`<div class="setting-option ${disabled?"disabled":""}">${action(id,`<span class="radio">${checked?"◉":"○"}</span><span>${title}</span>`,"setting-choice")}<div class="setting-description">${desc}</div></div>`;content.innerHTML=`<div class="body settings-body" id="view-scroll"><div class="setting-row"><strong>Apply changes</strong><div class="setting-options">${option("mode-ASK","When I press Sync "+chip("Recommended"),"Changes wait in the panel badge. Sync applies them; Review opens only when something needs a decision.",mode!=="AUTO")}${option("mode-AUTO","Automatically","Changes apply in the background. If anything needs a decision, the whole batch waits for you in Changes.",mode==="AUTO")}</div></div><div class="setting-row"><strong>Fragmented MP4</strong><div class="setting-options">${option("mp4-ASK","Ask in Review","Import the original or skip it, file by file.",s.mp4!=="NONE")}${option("mp4-NONE","Import original as is","",s.mp4==="NONE")}${option("mp4-AUTO","Repair before import","Needs the media helper — not in this version.",false,true)}</div></div><div class="setting-row"><strong>Clip markers</strong><div class="setting-options"><sp-checkbox id="auto-markers" ${s.autoMarkers!==false?"checked":""}>Find a marker TXT next to each video</sp-checkbox><div class="setting-description">TXT name inside the video name, same folder. Applied during Sync.</div></div></div><div class="setting-row"><strong>Notifications</strong><div class="setting-options"><sp-checkbox id="success" ${s.success?"checked":""}>Notify after a successful automatic sync</sp-checkbox><div class="setting-description">Warnings and errors are always shown.</div></div></div><p id="settings-error" class="issue-text"></p></div><div class="footer"><span class="hint">Saved automatically</span>${button("close","Close")}</div>`;const save=async patch=>{if(this.c.busy)return;const previous=this.c.data.settings;this.c.data.settings={...previous,...patch,warnings:true};try{await this.c.persist();await this.c.scan();}catch(e){this.c.data.settings=previous;content.querySelector("#settings-error").textContent=e.message;}};for(const group of ["mode","mp4"])for(const value of group==="mode"?["ASK","AUTO"]:["ASK","NONE"])this.bind(content,group+"-"+value,()=>save({[group]:value}));for(const [id,key] of [["auto-markers","autoMarkers"],["success","success"]]){const el=content.querySelector("#"+id);el.disabled=this.c.busy;el.addEventListener("change",()=>save({[key]:el.checked}));}content.querySelector("#mp4-AUTO").disabled=true;this.bind(content,"close",()=>d.close());}
  async removeLink(link){const result=await this.modal("Remove link",this.header("Remove link")+`<div class="body"><h2>${esc(link.binPath||"Project root")}</h2><p>Remove this link? Nothing in Premiere or on disk is deleted.</p></div><div class="footer">${button("cancel","Cancel")}${button("remove-confirm","Remove link",true)}</div>`,d=>{this.close(d);this.bind(d,"remove-confirm",()=>d.close("remove"));},{width:540,height:240});if(result==="remove"){const previous=this.c.data.links,records=this.c.data.records;this.c.data.links=previous.filter(l=>l.id!==link.id);this.c.data.records={...records};delete this.c.data.records[link.id];try{await this.c.persist();await this.c.scan();}catch(e){this.c.data.links=previous;this.c.data.records=records;throw e;}}}
  changesView(d,batch,state,preview=null){
    if(!preview&&!this.c.busy)this.reviewedWarnings=batch.warnings?.some(w=>w.emptyVersion&&w.itemId)?batch:null;
    const root=d.querySelector("#management-content"),all=batch.changes||[],selection=state.selection(batch),blocking=all.filter(V.needs),ready=all.filter(c=>c.kind!=="unavailable"&&(!V.needs(c)||V.timeline(c))),fragments=blocking.filter(c=>c.kind==="fragmented");
    const treeMode=preview && state.groupBy==="Folder";
    const by=V.groups(treeMode ? ready.filter(V.timeline) : ready,state.groupBy,batch);
    const decisionRow=(c,group=null)=>{const list=group||[c],chosen=state.decision(c),name=group?list.length+" fragmented MP4":P.basename(c.path),options=c.kind==="fragmented"?[["original",group?"Import originals":"Import original"],["defer","Skip this time"]]:c.kind==="marker-choice"?(c.pendingMode?[c.pendingMode,"skip"]:["replace","append","skip"]).map(v=>[v,v==="replace"?"Replace":v==="append"?"Add to existing":"Skip TXT"]):c.kind==="sequence-review"?[["retry","Append again"],["keep","Keep current sequence"]]:[];
      return `<div class="decision-row"><span class="state-dot ${chosen?"grey":"amber-dot"}"></span><div class="decision-detail"><strong>${esc(name)}</strong><div class="muted path" title="${esc(c.message)}">${esc(chosen==="defer"?"Skipped this time · stays pending for the next Sync":group?list.map(v=>P.basename(v.path)).join(", "):c.kind==="marker-choice"?"Marker TXT changed · Replace also removes manual markers":c.message||c.path)}</div></div>${group?action("per-file","Per file","quiet"):""}<div class="segments">${options.map(([v,text])=>action("decision-"+(group?"all":c.id)+"-"+v,esc(text),"segment"+(chosen===v&&list.every(vv=>state.decision(vv)===chosen)?" selected":""))).join("")}</div>${!options.length?action("resolve-"+c.id,c.kind==="sequence-error"?"Choose timeline…":"Ignore…"):""}</div>`;};
    const warnings=c=>(batch.warnings||[]).filter(w=>P.key(w.path||"")===P.key(c.path)||P.key(w.txtPath||"")===P.key(c.path));
    const fileRow=(c,i)=>{const selected=state.selected(c,batch),append=all.find(a=>V.timeline(a)&&P.key(a.path)===P.key(c.path)),warn=warnings(c);return `<div class="file-row ${!selected?"unchecked":""}"><sp-checkbox id="change-${c.id}" ${selected?"checked":""}></sp-checkbox><span class="path file-name" title="${esc(c.path)}">${esc(P.basename(c.path))}</span>${append&&state.selected(append,batch)?chip("+ timeline"):""}${warn.map(w=>chip("TXT skipped"+(w.message.match(/line\s+\d+/i)?.[0]?" · "+w.message.match(/line\s+\d+/i)[0]:""),true)).join("")}${!selected?chip("stays pending"):""}${c.from?`<span class="muted path" title="${esc(c.from)}">from ${esc(c.from)}</span>`:""}${action("file-more-"+i,"⋯","more")}</div>`;};
    let rowIndex=0;const rendered=[];
    const renderFile=c=>{const index=rowIndex++;rendered.push({c,rowIndex:index});return fileRow(c,index);};
    let treeView;
    if(preview){
      preview.tree ??= previewTree(batch,preview);
      treeView=this.previewFolders({...preview,batch},state,selection,renderFile,treeMode);
    }
    const groupHtml=by.map((g,i)=>{const open=state.expanded.has(g.name),checked=g.items.filter(c=>state.selected(c,batch)).length,n=g.items.length,dependent=g.items.every(V.timeline),folder=P.isAbsolute(g.name),total=g.items.reduce((sum,c)=>sum+(c.file?.size||0),0);let expanded="";
      if(open){const folders=new Map();for(const c of g.items){const name=V.timeline(c)?"Timeline":P.dirname(c.path)||"Project root";if(!folders.has(name))folders.set(name,[]);folders.get(name).push(c);}for(const [name,items] of folders){const fidx=rendered.length;expanded+=`<div class="folder-subrow"><sp-checkbox id="folder-check-${fidx}" ${items.every(c=>state.selected(c,batch))?"checked":""}></sp-checkbox><span class="path" title="${esc(name)}">${esc(name)}</span><span class="muted">${items.length} files</span>${treeView?.find(name)?action("folder-more-"+fidx,"⋯","more"):""}</div>`;rendered.push({items,name,fidx});for(const c of items){expanded+=fileRow(c,rowIndex);rendered.push({c,rowIndex:rowIndex++});}}}
      return `<div class="change-group"><div class="group-row"><sp-checkbox id="group-check-${i}" ${checked===n?"checked":""}></sp-checkbox>${action("expand-group-"+i,(open?"▾":"▸")+" &nbsp; "+esc(folder?P.basename(g.name):g.name)+(folder&&g.items.some(c=>c.kind==="new-folder")?chip("new bin"):""),"group-label")}<span class="count">${checked!==n?checked+" of ":""}${n}</span><span class="group-summary muted">${dependent?"not counted separately · uncheck to import without timeline · V1 + date title on V2":folder?g.items.filter(c=>!V.timeline(c)&&c.kind!=="new-folder").length+" files · "+size(total)+" · "+g.items.filter(c=>c.kind!=="new-folder").slice(0,3).map(c=>esc(P.basename(c.path))).join(", "):g.items.slice(0,3).map(c=>esc(P.basename(c.path))).join(" · ")}</span></div>${expanded}</div>`;}).join("");
    const targetError=/project|sequence|destination|saved import/i.test(this.c.error||""),errorRow=this.c.error&&!preview?`<div class="decision-row target-error"><span class="state-dot red"></span><div class="decision-detail"><strong>${targetError?"Import target needs attention":"Sync stopped"}</strong><p>${esc(this.c.error)}</p></div>${action("fix-target",targetError?"Choose target…":"Check again")}</div>`:"",needCount=blocking.length+Number(Boolean(errorRow));if(errorRow)selection.waiting++;
    const offline=all.filter(c=>c.kind==="unavailable");
    const noChanges=!all.some(c=>c.kind!=="unavailable")&&!this.c.error&&!offline.length&&!(batch.warnings||[]).length;
    root.innerHTML=(preview?`<div class="preview-intro"><div class="eyebrow">NEW LINK · PREVIEW</div><h1>${esc(preview.drafts.map(l=>(l.binPath||"Project root")+" ↔ "+l.folderPath).join(" · "))}</h1><p>${(batch.reused||[]).filter(r=>r.kind==="file").length} files already in the project are reused, nothing is duplicated. Nothing changes until you confirm.</p></div>`:this.strip())+`<div id="needs-pinned" class="pinned-notice" style="display:none">${selection.waiting} items in Needs you above are still open ${action("show-needs","Show")}</div><div class="body changes-body" id="view-scroll">${this.c.busy&&!preview?`<div id="operation-details">${this.operationDetails()}</div>${blocking.filter(c=>!this.runSelection?.selected.includes(c.id)).length?`<p class="waiting-row">${blocking.filter(c=>!this.runSelection?.selected.includes(c.id)).length} items need you · not part of this run · your choices so far are kept</p>`:""}`:noChanges&&!preview?'<div class="up-to-date"><span class="success-check">✓</span><h1>Up to date</h1><p>Nothing on disk is waiting. New files show up here as soon as they are found.</p></div>':`${offline.length?`<p class="issue-text">${offline.length} linked folder${offline.length===1?" is":"s are"} unavailable. ${action("offline-links","Reconnect in Links…")}</p>`:""}${needCount?`<div id="needs-block"><div class="section-heading"><span class="state-dot amber-dot"></span>NEEDS YOU <span class="count amber">${needCount}</span><span class="heading-hint">nothing here is applied until you choose</span></div><div class="decision-box">${errorRow}${fragments.length>1&&!state.expanded.has("fragmented-per-file")?decisionRow(fragments[0],fragments):fragments.map(c=>decisionRow(c)).join("")}${blocking.filter(c=>c.kind!=="fragmented").map(c=>decisionRow(c)).join("")}</div></div>`:""}<div class="section-heading">READY TO APPLY <span class="count">${V.countChanges(ready,all)}</span><span class="heading-hint">Group by</span><div class="segments">${["Type","Folder"].map(v=>action("group-by-"+v,v,"segment"+(state.groupBy===v?" selected":""))).join("")}</div>${action("select-none","Select none")}</div><div class="group-box">${(treeView?.active||"")+groupHtml||'<p class="muted">No ready changes.</p>'}${treeView?.details||""}</div>${(batch.warnings||[]).map(w=>`<p class="issue-text" title="${esc(w.txtPath||w.path)}">${esc(P.basename(w.txtPath||w.path))} · ${esc(w.message)} · TXT skipped, the video imports</p>`).join("")}${all.filter(c=>c.kind==="media-error"&&/copy|writ|settle/i.test(c.message||"")).map(c=>`<p class="muted">${esc(P.basename(c.path))} is still copying — it will be picked up on the next check.</p>`).join("")}`}</div><div class="footer"><span class="hint">${this.c.busy&&!preview?"Sync, Check now and Add markers are unavailable until this run ends":selection.waiting+" items wait for you"}</span>${button("close",preview?"Cancel":"Close")}${!noChanges||preview?button("apply",this.c.busy&&!preview?"Applying…":(preview?"Link and apply ":"Apply ")+selection.count+" changes",true):""}</div>`;
    const body=root.querySelector("#view-scroll");body.scrollTop=state.scroll;const redraw=()=>{state.scroll=body.scrollTop||0;this.changesView(d,batch,state,preview);};body.addEventListener("scroll",()=>{state.scroll=body.scrollTop||0;const pinned=root.querySelector("#needs-pinned");pinned.style.display=selection.waiting&&state.scroll>(root.querySelector("#needs-block")?.offsetHeight||150)?"flex":"none";});
    this.bind(root,"show-needs",()=>{body.scrollTop=0;state.scroll=0;});this.bind(root,"close",()=>d.close());this.bind(root,"fix-target",()=>this.leave({action:targetError?"targets":"check"}));this.bind(root,"offline-links",()=>{this.view.tab="links";this.renderWindow();});this.bind(root,"paused-links",()=>{this.view.tab="links";this.renderWindow();});this.bind(root,"check-now",()=>this.leave({action:"check"}));const check=root.querySelector("#check-now");if(check)check.disabled=this.c.busy;
    if(treeView)treeView.bind(d,root,redraw);
    const apply=root.querySelector("#apply");if(apply){apply.disabled=this.c.busy||(!selection.selected.length&&!selection.options.skipSequenceKeys.length&&!preview);this.bind(root,"apply",()=>{const value={action:"apply",batch,selection};if(preview)d.close(value);else this.leave(value);});}
    const decide=(items,value)=>{for(const c of items)state.decide(c,value);redraw();};
    this.bind(root,"per-file",()=>{state.expanded.add("fragmented-per-file");redraw();});for(const value of ["original","defer"])this.bind(root,"decision-all-"+value,()=>decide(fragments,value));
    for(const c of blocking){for(const value of ["original","defer","replace","append","skip","retry","keep"])this.bind(root,"decision-"+c.id+"-"+value,()=>decide([c],value));this.bind(root,"resolve-"+c.id,()=>{if(c.kind==="sequence-error")return preview?d.close({action:"targets"}):this.leave({action:"targets"});const source=this.ignoreSource(c,batch);if(source){const result={action:"ignore",source};if(preview)d.close(result);else this.leave(result);}});}
    for(const name of ["Type","Folder"])this.bind(root,"group-by-"+name,()=>{state.groupBy=name;redraw();});this.bind(root,"select-none",()=>{for(const c of ready)state.check(c,false);redraw();});
    by.forEach((g,i)=>{this.bind(root,"expand-group-"+i,()=>{if(state.expanded.has(g.name))state.expanded.delete(g.name);else state.expanded.add(g.name);redraw();});root.querySelector("#group-check-"+i)?.addEventListener("change",e=>{for(const c of g.items)state.check(c,e.target.checked);redraw();});});
    for(const entry of rendered){if(entry.items){root.querySelector("#folder-check-"+entry.fidx)?.addEventListener("change",e=>{for(const c of entry.items)state.check(c,e.target.checked);redraw();});const node=treeView?.find(entry.name);if(node)treeView.bindMenu(d,root,redraw,"folder-more-"+entry.fidx,node);continue;}const {c,rowIndex:i}=entry;root.querySelector("#change-"+c.id)?.addEventListener("change",e=>{state.check(c,e.target.checked);redraw();});this.bind(root,"file-more-"+i,()=>{const source=this.ignoreSource(c,batch),append=all.find(a=>V.timeline(a)&&P.key(a.path)===P.key(c.path)),items=[];const leave=value=>preview?d.close(value):this.leave(value);if(source){items.push({text:"Ignore this file…",hint:"Hidden from Sync until restored in Links › ⋯ › Ignored",run:()=>leave({action:"ignore",source})});if(source.kind==="file")items.push({text:"Ignore folder "+P.basename(P.dirname(source.path))+"…",run:()=>leave({action:"ignore",source:{path:P.dirname(source.path),kind:"folder"}})});}if(append)items.push({text:"Import without adding to timeline",separator:true,run:()=>{state.check(append,false);redraw();}});if(P.isAbsolute(c.path)&&!V.timeline(c))items.push({text:"Add markers from TXT…",hint:"The clip is already chosen — pick only the TXT",run:()=>leave({action:"markers",entry:(batch.media||[]).find(m=>P.key(m.path)===P.key(c.path))||{path:c.path,projectPath:batch.projectPath,projectId:batch.projectId}})});items.push({text:"Copy full path",disabled:true,hint:"Not available in this build",run:()=>{}});this.menu(d,items,"file-more-"+i);});}
  }
  operationDetails(){const op=this.c.operation;if(!op)return '<p class="muted">Preparing…</p>';const now=op.finishedAt||Date.now(),waiting=Date.now()-op.updatedAt,events=op.events||[];return `<div class="process-card"><div class="row spread"><strong>◌ ${op.label==="Sync"?"Applying "+(this.runningCount??V.summary(this.c.batch||{}).count)+" changes":"Checking for changes"} · ${esc(op.phase)}</strong><span class="muted">${elapsed(now-op.startedAt)} elapsed</span></div><div class="process-file"><strong>${esc(P.basename(op.current||""))}</strong> <span class="muted path">${esc(P.dirname(op.current||""))}</span></div>${op.total>0?`<div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,op.completed/op.total*100)}%"></div></div><span class="muted">${op.completed} of ${op.total} ${op.unit==="videos"?"videos":"operations"}</span>`:""}<p class="muted">${waiting>=15000?"Waiting for this step for "+Math.floor(waiting/1000)+"s · ":""}Closing this window does not stop Sync</p><div class="stage-list">${processStages(op,this.runningChanges||this.c.batch?.changes||[],this.runSelection?.decisions).map(s=>`<div class="stage-row ${s.state}"><span class="${s.state==="done"?"success-check":""}">${s.state==="done"?"✓":s.state==="current"?"◌":"○"}</span><span>${esc(s.name)}</span><span class="muted stage-duration">${s.state==="done"?(s.duration/1000).toFixed(1)+" s":s.state==="upcoming"&&s.planned?s.planned+(s.id===6?" TXT":s.id===5?" videos":" changes"):""}</span></div>`).join("")}</div>${(op.warnings||[]).map(w=>`<p class="issue-text">${esc(P.basename(w.path))} · ${esc(w.message)}</p>`).join("")}${(op.errors||[]).map(e=>`<p class="issue-text">${esc(e.message)}</p>`).join("")}</div>`;}
  historyView(d){const root=d.querySelector("#management-content"),history=(this.c.data.history||[]).map(h=>h.changes?{...h,changes:h.changes.filter(c=>!Ignore.matches(c.path,this.c.data.ignored)),count:V.countChanges(h.changes.filter(c=>!Ignore.matches(c.path,this.c.data.ignored))),...(Ignore.matches(h.errorPath,this.c.data.ignored)?{error:null,status:"completed"}:{})}:h);root.innerHTML=`<div class="history-layout" id="view-scroll"><div class="history-sidebar"><sp-textfield id="history-search" placeholder="Find a file or folder"></sp-textfield><div id="history-runs"></div></div><div class="history-detail" id="history-detail"></div></div><div class="footer">${button("close","Close")}</div>`;const render=()=>{const q=root.querySelector("#history-search").value.toLowerCase();this.view.historySearch=q;const matches=history.map((h,i)=>({h,i})).filter(({h})=>JSON.stringify([h.trigger,h.project,h.changes]).toLowerCase().includes(q));let day="";root.querySelector("#history-runs").innerHTML=matches.map(({h,i})=>{const date=new Date(h.time).toLocaleDateString(),heading=date!==day?`<div class="history-day">${esc(date)}</div>`:"";day=date;return heading+action("history-run-"+i,`<span class="state-dot ${h.status==="failed"?"red":h.count?"green":"grey"}"></span><div class="history-run-copy"><strong>${esc(h.trigger||"Sync")}</strong><div class="muted">${h.status==="failed"?"Failed · "+esc(h.error):h.count?h.count+" changes":h.message==="No changes applied"?"Nothing applied · waited in Changes":"No changes"}</div></div><span class="muted">${time(h.time)}</span>`,"history-run"+(this.view.history===i?" selected":""));}).join("")||'<p class="muted">No syncs found.</p>';for(const {i} of matches)this.bind(root,"history-run-"+i,()=>{this.view.history=i;render();});const h=history[this.view.history],detail=root.querySelector("#history-detail");detail.innerHTML=!h?'<p class="muted">Completed syncs appear here.</p>':`<h1>${esc(h.trigger||"Sync")} · ${time(h.time)}</h1><p>${esc(h.project||"")} ${h.sequence?"→ "+esc(h.sequence):""} · ${elapsed(h.duration||0)}</p>${h.status==="failed"?`<div class="failure-card"><strong>Sync stopped: ${esc(h.error)}</strong><p>Check the source and project, then return to Changes.</p><span class="muted">Stopped while ${esc(h.stage)} · the changes are still waiting in Changes</span></div>`:""}<div class="section-heading">CHANGES <span class="count">${h.count}</span></div>${V.groups(h.changes||[]).map((g,i)=>`<div class="group-box">${action("history-group-"+i,"▸ &nbsp; "+esc(g.name)+` <span class="count">${g.items.length}</span>`,"group-row")}<div id="history-files-${i}" style="display:none">${g.items.map(c=>`<div class="history-file"><span class="muted path">${esc(P.dirname(c.path))}</span><div>${esc(P.basename(c.path))} ${c.timeline?chip("+ timeline"):""}${c.markers?chip(c.markers+" markers"):""}</div></div>`).join("")}</div></div>`).join("")||'<p class="muted">'+(h.changes?"Nothing was changed in the project.":"File details were not recorded by this older version.")+"</p>"}`;if(h)V.groups(h.changes||[]).forEach((g,i)=>this.bind(detail,"history-group-"+i,()=>{const el=detail.querySelector("#history-files-"+i);el.style.display=el.style.display==="none"?"block":"none";}));};root.querySelector("#history-search").value=this.view.historySearch;root.querySelector("#history-search").addEventListener("input",render);render();this.bind(root,"close",()=>d.close());}
  async add(){return this.linkForm();}
  async existing(edit=null,folder=null){return this.linkForm(edit,folder);}
  binDropdown(d,anchorId,selected,bins,choose){const host=d.querySelector("#menu-host"),expanded=new Set();for(const b of bins)if(selected?.path&&P.within(selected.path,b.path)&&b.path!==selected.path)expanded.add(b.id);const render=()=>{const rows=require("./core/ui-data").binRows(bins,expanded);host.innerHTML=`<div id="bin-dismiss" class="menu-shade"></div><div class="bin-popover"><div id="project-root" class="bin-root" role="button" tabindex="0">Project root ${selected?.path===""?"✓":""}</div><div class="bin-options">${rows.map(({bin,depth,hasChildren},i)=>`<div class="tree-row ${selected?.path===bin.path?"selected":""}" style="padding-left:${depth*18}px">${hasChildren?action("bin-expand-"+i,expanded.has(bin.id)?"▾":"▸","bin-arrow"):'<span class="bin-arrow"></span>'}${action("bin-select-"+i,esc(bin.name)+(selected?.path===bin.path?" ✓":""),"bin-label")}</div>`).join("")}</div><div class="muted bin-hint">Arrow opens a bin · name selects it</div></div>`;this.bind(host,"bin-dismiss",()=>{host.innerHTML="";});this.bind(host,"project-root",()=>{host.innerHTML="";choose({id:null,path:"",name:"Project root"});});rows.forEach(({bin},i)=>{this.bind(host,"bin-expand-"+i,()=>{if(expanded.has(bin.id))expanded.delete(bin.id);else expanded.add(bin.id);render();});this.bind(host,"bin-select-"+i,()=>{host.innerHTML="";choose(bin);});});const box=d.querySelector("#"+anchorId)?.getBoundingClientRect?.(),origin=d.getBoundingClientRect?.(),popover=host.querySelector(".bin-popover");if(box&&origin&&popover){popover.style.top=Math.min(box.bottom-origin.top,origin.height-310)+"px";popover.style.left=Math.max(12,Math.min(box.left-origin.left,origin.width-320))+"px";}};render();}
  async linkForm(edit=null,replacement=null){return this.dialogFlow(async()=>{
    if(this.c.busy)throw new Error("Wait for the current sync to finish.");const project=await this.c.context();if(!project)throw new Error("Choose the import project first.");const projectPath=this.c.path,projectId=String(project.guid),inv=await H.inventory(project),draft={id:edit?.id||"l"+Date.now(),binId:edit?.binId||null,binPath:edit?.binPath??"",folderPath:replacement||(edit?P.resolve(P.dirname(projectPath),edit.folderPath):""),relative:edit?.relative||false,subfolders:edit?.subfolders??true,paused:edit?.paused||false};let destination=edit?{path:edit.binPath,id:edit.binId}:null,parent=null,placement="existing",message="";
    for(;;){let cancelSummary=()=>{};const result=await this.modal(edit?"Edit link":"Add link",this.header(edit?"Edit link":"Add link")+`<div class="body link-form"><div class="field"><div class="step-label"><span>1</span>Folder on disk</div><div class="field-row"><sp-textfield id="folder" value="${esc(draft.folderPath)}" placeholder="Folder path"></sp-textfield>${button("browse","Browse…")}</div><p id="folder-summary" class="muted"></p>${edit&&P.key(draft.folderPath)!==P.key(P.resolve(P.dirname(projectPath),edit.folderPath))?`<p class="muted">${chip("changed")} Previously ${esc(edit.folderPath)}</p>`:""}</div><div class="field"><div class="step-label"><span>2</span>${edit?"Premiere bin":"Where in Premiere"}</div>${edit?"":'<div class="destination-option" id="placement-existing" role="button" tabindex="0">'}<div class="row">${edit?"":"<span id=\"radio-existing\" class=\"radio\">◉</span>"}<span>${edit?"Premiere bin":"Into an existing bin"}</span>${action("choose-existing",esc(destination?.path||destination?.name||"Choose bin")+" ▾","bin-select")}</div><p class="muted" id="existing-example"></p>${edit?"":"</div><div class=\"destination-option\" id=\"placement-new\" role=\"button\" tabindex=\"0\"><div class=\"row\"><span id=\"radio-new\" class=\"radio\">○</span><span id=\"new-bin-label\">Into a new bin</span>"+action("choose-parent",esc(parent?.path||parent?.name||"Choose parent")+" ▾","bin-select")+'</div><p class="muted" id="new-example"></p></div>'}</div><div class="field"><div class="step-label"><span>3</span>Options</div><div class="row"><sp-checkbox id="subfolders" ${draft.subfolders?"checked":""}>Include subfolders</sp-checkbox><sp-checkbox id="relative" ${draft.relative?"checked":""}>Path relative to the project</sp-checkbox><span class="muted">for project templates</span></div>${edit?`<p class="muted">Excluded subfolders: ${(this.c.data.ignored||[]).filter(r=>r.linkId===edit.id).length} ${action("edit-exclusions","Exclude subfolders…")}</p>`:""}</div><p id="form-error" class="issue-text">${esc(message)}</p></div><div class="footer"><span class="hint">Nothing changes in Premiere until you confirm the preview</span>${button("cancel","Cancel")}${button("analyze",edit?"Preview changes":"Preview link",true)}</div><div id="menu-host"></div>`,d=>{
      this.close(d);const field=d.querySelector("#folder"),primary=d.querySelector("#analyze");let valid=false,epoch=0,closed=false,timer;
      const capture=()=>{draft.folderPath=field.value.trim();draft.relative=d.querySelector("#relative").checked;draft.subfolders=d.querySelector("#subfolders").checked;};
      const refresh=()=>{const folder=P.basename(field.value.trim())||"folder",target=placement==="existing"?destination:parent;primary.disabled=!valid||!target;d.querySelector("#existing-example").textContent="Files land in "+(destination?.path||"Project root")+"/…";if(!edit){d.querySelector("#new-example").textContent="Files land in "+P.join(parent?.path||"",folder)+"/…";d.querySelector("#new-bin-label").textContent='Into a new bin “'+folder+'”, inside';d.querySelector("#radio-existing").textContent=placement==="existing"?"◉":"○";d.querySelector("#radio-new").textContent=placement==="new"?"◉":"○";}};
      const validate=async()=>{const version=++epoch,path=field.value.trim();valid=false;refresh();if(!P.isAbsolute(path))return;try{const stat=await require("./host/io").lstat(path);if(closed||version!==epoch)return;valid=stat.isDirectory()&&!stat.isSymbolicLink?.();refresh();if(valid){d.querySelector("#folder-summary").textContent="Counting media…";await require("./host/folder-summary").folderSummary(path,{cancelled:()=>closed||version!==epoch,onUpdate:nodes=>{if(closed||version!==epoch)return;const top=nodes.filter(n=>n.depth===1),root=nodes[0];d.querySelector("#folder-summary").textContent=`${top.length} subfolders: ${top.slice(0,4).map(n=>P.basename(n.path)).join(", ")} · ${root?.complete?root.files+" media files":"counting media…"}`;}});}}catch(e){if(!closed&&version===epoch){d.querySelector("#folder-summary").textContent=e.message;}}};
      cancelSummary=()=>{closed=true;epoch++;clearTimeout(timer);};field.addEventListener("input",()=>{clearTimeout(timer);valid=false;refresh();timer=setTimeout(validate,350);});validate();
      this.bind(d,"choose-existing",()=>this.binDropdown(d,"choose-existing",destination,inv.bins,b=>{destination=b;placement="existing";d.querySelector("#choose-existing").textContent=(b.path||"Project root")+" ▾";refresh();}));this.bind(d,"choose-parent",()=>this.binDropdown(d,"choose-parent",parent,inv.bins,b=>{parent=b;placement="new";d.querySelector("#choose-parent").textContent=(b.path||"Project root")+" ▾";refresh();}));this.bind(d,"placement-existing",()=>{placement="existing";refresh();});this.bind(d,"placement-new",()=>{placement="new";refresh();});this.bind(d,"browse",()=>{capture();d.close({action:"browse"});});this.bind(d,"edit-exclusions",()=>{capture();d.close({action:"exclude"});});
      this.bind(d,"analyze",async()=>{capture();await this.c.assertContext?.(projectPath,projectId);const chosen=placement==="existing"?destination:parent;if(!valid||!chosen)return;draft.binPath=placement==="existing"?chosen.path:P.join(chosen.path,P.basename(draft.folderPath));draft.binId=placement==="existing"?chosen.id:null;d.close({draft:{...draft,folderPath:draft.relative?P.relative(P.dirname(projectPath),draft.folderPath):P.clean(draft.folderPath)}});});
    },{width:780,height:550});cancelSummary();if(result?.action){message="";await this.c.assertContext?.(projectPath,projectId);try{if(result.action==="browse"){const folder=await require("uxp").storage.localFileSystem.getFolder();if(folder)draft.folderPath=folder.nativePath;}else if(edit)await this.excludeSubfolders(edit);}catch(e){message="Could not open the picker: "+e.message+". You can enter the path manually.";}continue;}if(result?.draft)return this.initial([result.draft],edit?.id);return;
    }
  });}
  async initial(drafts,editId=null){
    return this.dialogFlow(async()=>{
      const others=this.c.data.links.filter(l=>l.id!==editId), all=[...others,...drafts];
      const root=l=>P.resolve(P.dirname(this.c.path),l.folderPath);
      for(const draft of drafts)for(const other of all){
        if(draft.id===other.id)continue;
        if(P.within(root(draft),root(other))||P.within(root(other),root(draft))||draft.binPath===other.binPath)
          throw new Error("Links overlap. Choose independent folders and bins.");
      }
      const state=new V.ChangesState(), excluded=[];
      state.groupBy="Folder";
      for(;;){
        const originalIgnored=this.c.data.ignored||[];
        const previewRules=[...originalIgnored,...excluded];
        this.c.data.ignored=previewRules;
        let batch;
        try{batch=await this.c.scan(all);}finally{this.c.data.ignored=originalIgnored;}
        const activeExclusions=previewRules.filter(rule=>rule.kind==="folder"&&rule.origin==="excluded"&&
          drafts.some(link=>link.id===rule.linkId&&P.key(rule.path)!==P.key(root(link))&&P.within(rule.path,root(link))));
        const preview={drafts,excluded:activeExclusions.map(rule=>rule.path)};
        const result=await this.modal("New link",'<div id="management-content" class="view-content"></div><div id="menu-host"></div>',d=>this.changesView(d,batch,state,preview),{width:950,height:650});
        if(result?.action==="apply"){
          this.c.data.ignored=previewRules;
          const {appends,pending}=this.startApply(batch,result.selection,{...result.selection.options,trigger:"New link · "+(drafts[0].binPath||"Project root")});
          const applied=pending.catch(e=>{
            if(this.c.data.links!==batch.links&&this.c.data.ignored===previewRules)this.c.data.ignored=originalIgnored;
            throw e;
          });
          if(appends){
            applied.catch(e=>{this.c.error=e.message;this.update();});
            return editor;
          }
          await applied;
          return;
        }
        if(result?.action==="markers"){await this.addMarkers(batch,result.entry);continue;}
        if(result?.action==="pick-ignore-file"){await this.ignorePreviewFile(result.files);continue;}
        if(result?.action==="ignore"){await this.ignorePath(result.source.path,result.source.kind);continue;}
        if(result?.action==="targets"){await this.targets();continue;}
        if(result?.action==="exclude-preview"){
          const path=result.path, link=drafts.find(l=>P.within(path,root(l)));
          if(!link||P.key(path)===P.key(root(link)))throw new Error("Choose a subfolder of this link.");
          if(!previewRules.some(r=>r.kind==="folder"&&P.within(path,r.path))){
            for(let i=excluded.length-1;i>=0;i--)if(P.within(excluded[i].path,path))excluded.splice(i,1);
            excluded.push({path,kind:"folder",linkId:link.id,origin:"excluded"});
          }
          continue;
        }
        return;
      }
    });
  }
  async unavailable(link){const path=P.resolve(P.dirname(this.c.path),link.folderPath),scan=this.c.batch?.scans?.[link.id];const result=await this.modal("Folder unavailable",this.header("Folder unavailable")+`<div class="body"><h1><span class="state-dot red"></span>${esc(link.binPath||"Project root")} ↔ ${esc(P.basename(path))}</h1><p>The folder can't be reached — the drive may be disconnected or renamed. This link is paused. Nothing was removed from Premiere, and other links keep syncing.</p><div class="card"><p>Premiere bin: ${esc(link.binPath||"Project root")} · ${(this.c.data.records?.[link.id]?.files||[]).length} items, unchanged</p><p class="path" title="${esc(path)}">System folder: ${esc(path)}</p><p>Last available: ${link.lastAvailable?new Date(link.lastAvailable).toLocaleString():"Not recorded"}</p><p>Pending: nothing from this link is applied while it is paused</p><p>${esc(scan?.error)}</p></div></div><div class="footer">${action("pause-link","Pause link","quiet footer-start")}${button("close","Close")}${button("choose-folder","Choose folder…",true)}</div>`,d=>{this.close(d);this.bind(d,"pause-link",()=>d.close("pause"));this.bind(d,"choose-folder",()=>d.close("folder"));},{width:740,height:440});if(result==="pause"){link.paused=true;await this.c.persist();await this.c.scan();}else if(result==="folder"){const folder=await require("uxp").storage.localFileSystem.getFolder();if(folder)return this.existing(link,folder.nativePath);}}
  async excludeSubfolders(link){return this.dialogFlow(async()=>{const root=P.resolve(P.dirname(this.c.path),link.folderPath),rules=this.c.data.ignored||[],excluded=new Set(rules.filter(r=>r.kind==="folder"&&P.key(r.path)!==P.key(root)&&P.within(r.path,root)).map(r=>r.path)),expanded=new Set([P.key(root)]);let nodes=[],error="",cancelled=false,render=()=>{};const job=require("./host/folder-summary").folderSummary(root,{cancelled:()=>cancelled,onUpdate:value=>{nodes=value;render();}}).catch(e=>{error=e.message;render();});const result=await this.modal("Exclude subfolders",this.header("Exclude subfolders")+`<div class="body"><h1>${esc(link.binPath||"Project root")} ↔ ${esc(root)}</h1><p>Unchecked folders are skipped by Sync. Items already in Premiere stay as they are.</p><sp-textfield id="folder-filter" placeholder="Filter folders"></sp-textfield><div class="folder-table"><div class="folder-summary-row table-head"><span>FOLDER</span><span>MEDIA</span><span>SIZE</span></div><div id="folder-nodes"></div></div><p class="issue-text" id="exclude-error"></p></div><div class="footer"><span id="exclude-summary" class="hint"></span>${button("cancel","Cancel")}${button("save-exclusions","Save",true)}</div>`,d=>{this.close(d);render=()=>{if(cancelled)return;const q=d.querySelector("#folder-filter").value.toLowerCase(),visible=nodes.filter(n=>!q?n.depth===0||nodes.filter(p=>p.depth<n.depth&&P.within(n.path,p.path)).every(p=>expanded.has(P.key(p.path))):n.path.toLowerCase().includes(q)),hidden=n=>[...excluded].some(p=>P.within(n.path,p))||rules.some(r=>!(r.kind==="folder"&&P.key(r.path)!==P.key(root)&&P.within(r.path,root))&&Ignore.matches(n.path,[r]));d.querySelector("#folder-nodes").innerHTML=visible.map((n,i)=>`<div class="folder-summary-row ${hidden(n)?"excluded":""}"><div class="row" style="padding-left:${n.depth*16}px">${action("folder-expand-"+i,expanded.has(P.key(n.path))?"▾":"▸","bin-arrow")}<sp-checkbox id="folder-sync-${i}" ${hidden(n)?"":"checked"} ${n.depth===0?"disabled":""}></sp-checkbox><span class="path" title="${esc(n.path)}">${esc(P.basename(n.path))}</span>${hidden(n)?chip("excluded",true):""}</div><span>${n.complete?n.files:"…"}</span><span>${n.complete?size(n.size):"…"}</span></div>`).join("");visible.forEach((n,i)=>{this.bind(d,"folder-expand-"+i,()=>{if(expanded.has(P.key(n.path)))expanded.delete(P.key(n.path));else expanded.add(P.key(n.path));render();});d.querySelector("#folder-sync-"+i).addEventListener("change",e=>{if(e.target.checked){for(const p of [...excluded])if(P.within(n.path,p)||P.within(p,n.path))excluded.delete(p);}else{for(const p of [...excluded])if(P.within(p,n.path))excluded.delete(p);excluded.add(n.path);}render();});});const top=nodes.filter(n=>excluded.has(n.path)&&![...excluded].some(p=>p!==n.path&&P.within(n.path,p)));d.querySelector("#exclude-summary").textContent=`${excluded.size} folders excluded · ${top.every(n=>n.complete)?top.reduce((sum,n)=>sum+n.files,0)+" files · "+size(top.reduce((sum,n)=>sum+n.size,0))+" not synced":"counting…"}`;d.querySelector("#exclude-error").textContent=error;d.querySelector("#save-exclusions").disabled=Boolean(error);};d.querySelector("#folder-filter").addEventListener("input",render);this.bind(d,"save-exclusions",()=>d.close("save"));render();},{width:780,height:570});cancelled=true;void job;if(result==="save"){await this.c.setExcluded(link,[...excluded]);await this.c.scan();}});}
  async ignorePath(path="",kind="file"){let selected=kind;const result=await this.modal("Ignore file or folder",this.header("Ignore file or folder")+`<div class="body"><h2>${esc(P.basename(path))}</h2><sp-textfield id="ignore-path" placeholder="Absolute file or folder path" value="${esc(path)}"></sp-textfield><div class="ignore-options">${action("ignore-file","○ This file","ignore-option") }<p class="muted">Only this path. A new file with the same name stays ignored too.</p>${action("ignore-folder","○ Folder and its subfolders","ignore-option")}<p class="muted">Includes files added to it later.</p></div><p id="ignore-scope" class="muted"></p><p>Restore in Links › ⋯ › Ignored files and folders. Nothing in Premiere is removed. Your choices in Changes are kept.</p><p id="ignore-error" class="issue-text"></p></div><div class="footer">${button("cancel","Cancel")}${button("ignore-confirm","Ignore",true)}</div>`,d=>{this.close(d);const field=d.querySelector("#ignore-path"),render=()=>{for(const type of ["file","folder"])d.querySelector("#ignore-"+type).className="ignore-option"+(selected===type?" selected":"");d.querySelector("#ignore-scope").textContent=selected==="folder"?"New files and subfolders here stay ignored.":"Only this file path is ignored.";};for(const type of ["file","folder"])this.bind(d,"ignore-"+type,()=>{selected=type;if(path)field.value=type==="folder"&&kind==="file"?P.dirname(path):path;render();});this.bind(d,"ignore-confirm",()=>{try{d.close(Ignore.rule({path:field.value.trim(),kind:selected}));}catch(e){d.querySelector("#ignore-error").textContent=e.message;}});render();},{width:720,height:440});if(result&&typeof result==="object"){await this.c.setIgnored(result);return true;}return false;}
  async ignoredPaths(){for(;;){const rules=this.c.data.ignored||[];const result=await this.modal("Ignored files and folders",this.header("Ignored files and folders")+`<div class="body"><p>Hidden from Sync, Changes and badges until restored. Folder rules include subfolders and files added later. Items already in Premiere stay. Restore checks the path again on the next scan.</p><div class="row"><sp-textfield id="ignore-filter" placeholder="Filter"></sp-textfield>${button("ignore-add","Add path…")}</div><div class="ignored-head table-head"><span>PATH</span><span>SCOPE</span><span>FROM</span><span></span></div><div id="ignored-rows"></div></div><div class="footer"><span class="hint">Saved automatically</span>${button("close","Close")}</div>`,d=>{this.close(d);const render=()=>{const q=d.querySelector("#ignore-filter").value.toLowerCase(),filtered=rules.filter(r=>r.path.toLowerCase().includes(q));d.querySelector("#ignored-rows").innerHTML=filtered.map((r,i)=>`<div class="ignored-row"><div><strong>${esc(P.basename(r.path))}</strong><div class="muted path" title="${esc(r.path)}">${esc(r.path)}</div></div><span>${r.kind==="folder"?"Folder and subfolders":"File"}</span><span class="muted">${r.origin==="excluded"?esc(this.c.data.links.find(l=>l.id===r.linkId)?.binPath||"Link")+" · excluded":"Ignored in Changes"}</span>${action("restore-ignore-"+i,"Restore")}</div>`).join("")||'<p class="muted">No ignored paths.</p>';filtered.forEach((r,i)=>this.bind(d,"restore-ignore-"+i,()=>d.close({restore:r})));};render();d.querySelector("#ignore-filter").addEventListener("input",render);this.bind(d,"ignore-add",()=>d.close({add:true}));},{width:880,height:520});if(result?.add){if(await this.ignorePath())await this.c.scan();}else if(result?.restore){await this.c.setIgnored(result.restore,true);await this.c.scan();}else return;}}
};
