"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");

function element(attrs="") {
  const children=new Map(),handlers={};let html="";
  return {style:{},disabled:/\bdisabled\b/.test(attrs),checked:/\bchecked\b/.test(attrs),value:/\bvalue="([^"]*)"/.exec(attrs)?.[1]||"",textContent:"",
    set innerHTML(value){html=value;children.clear();for(const m of value.matchAll(/<[\w-]+\b([^>]*\bid="([^"]+)"[^>]*)>/g))children.set(m[2],element(m[1]));},get innerHTML(){return html;},
    appendChild(child){children.set("appended-"+children.size,child);},
    querySelector(selector){if(selector===".body"&&html.includes('class="body"'))return this;const id=selector.slice(1);if(children.has(id))return children.get(id);for(const child of children.values()){const found=child.querySelector(selector);if(found)return found;}return null;},
    getAttribute(name){return new RegExp('\\b'+name+'="([^"]*)"').exec(attrs)?.[1];},
    addEventListener(event,fn){handlers[event]=fn;},async click(){if(!this.disabled)await handlers.click?.();},async change(){await handlers.change?.({target:this});},async input(){await handlers.input?.({target:this});}
  };
}
function setup({picked={nativePath:"D:/Media/interview.txt"},folder={nativePath:"D:/Chosen"}}={}) {
  const log=[],project={name:"Footage",path:"D:/Footage.prproj",guid:"project"};
  const entry={path:"D:/Media/interview.mp4",itemId:"clip",projectPath:project.path,projectId:project.guid};
  const c={busy:false,data:{links:[],history:[]},batch:{media:[entry],changes:[],warnings:[]},project,path:project.path,onChange(fn){this.notify=fn;},async context(){return project;},async scan(){log.push("scan");return this.batch;},async chooseMarkers(...args){log.push({selection:args});}};
  const host={inventory:async()=>({bins:[]})},mod={exports:{}},filename=path.resolve("plugin/ui.js");
  let modalDepth=0;
  vm.runInThisContext("(function(require,module,exports){"+fs.readFileSync(filename,"utf8")+"\n})",{filename})(id=>id==="uxp"?{storage:{localFileSystem:{async getFolder(){assert.equal(modalDepth,0,"OS picker must have no plugin modal above it");assert.equal(c.dialogOpen,true);log.push("folder-picker");if(folder instanceof Error)throw folder;return folder;},async getFileForOpening(){log.push("picker");return picked;}}}}:id==="./host/premiere"?host:require(id.startsWith(".")?path.resolve("plugin",id):id),mod,mod.exports);
  const ui=new mod.exports.UI(c);ui.error=async message=>{throw new Error(message);};
  ui.modal=async(title,html,bind)=>{log.push(title);const d=element();d.innerHTML=html;d.close=value=>d.result=value;modalDepth++;try{bind(d);await ui.interact(title,d);return d.result||"cancel";}finally{modalDepth--;}};
  return {ui,c,entry,log,host};
}

test("bin picker renders nested names only on disclosure and keeps root separately selectable",async()=>{
  const x=setup();x.host.inventory=async()=>({bins:[{id:"a",name:"Parent",path:"Parent",parentPath:""},{id:"b",name:"Child",path:"Parent/Child",parentPath:"Parent"}]});
  x.ui.interact=async(title,d)=>{
    const tree=d.querySelector("#bin-tree");assert.doesNotMatch(tree.innerHTML,/Child/);
    await d.querySelector("#expand-bin-0").click();assert.match(tree.innerHTML,/Child/);
    await d.querySelector("#expand-bin-0").click();assert.doesNotMatch(tree.innerHTML,/Child/);
    await d.querySelector("#project-root").click();
  };
  const result=await x.ui.chooseBin();assert.equal(result.path,"");assert.equal(result.id,null);
});

test("link-existing root is explicit, validated and passed to Initial Sync without saving",async()=>{
  const x=setup();let drafts;
  x.ui.initial=async value=>{drafts=value;};
  x.ui.interact=async(title,d)=>{
    d.querySelector("#folder").value="D:/Media";
    await d.querySelector("#analyze").click();assert.equal(d.result,undefined);
    d.querySelector("#use-root").checked=true;await d.querySelector("#use-root").change();
    assert.equal(d.querySelector("#bin").disabled,true);await d.querySelector("#analyze").click();
  };
  await x.ui.existing();assert.equal(drafts[0].binPath,"");assert.equal(drafts[0].binId,null);assert.equal(x.c.data.links.length,0);
});

test("TXT is chosen before clip selection; the suggested clip can be overridden before saving",async()=>{
  const x=setup(),other={...x.entry,itemId:"other",path:"D:/Media/b-roll.mp4"};x.c.batch.media.push(other);
  x.ui.interact=async(title,d)=>{
    assert.equal(x.log[0],"picker");assert.equal(x.c.dialogOpen,true);
    assert.match(d.querySelector("#clip-targets").innerHTML,/selected/);assert.equal(x.log.filter(v=>v?.selection).length,0);
    await d.querySelector("#clip-target-1").click();await d.querySelector("#use-clip").click();
  };
  await x.ui.addMarkers(x.c.batch);assert.deepEqual(x.log.find(v=>v?.selection).selection,[other,"D:/Media/interview.txt"]);assert.equal(x.c.dialogOpen,false);
});

test("ambiguous marker names require explicit clip selection and Cancel saves nothing",async()=>{
  const x=setup();x.c.batch.media.push({...x.entry,itemId:"second",path:"D:/Media/interview.mov"});
  x.ui.interact=async(title,d)=>{assert.equal(d.querySelector("#use-clip").disabled,true);await d.querySelector("#cancel").click();};
  await x.ui.addMarkers(x.c.batch);assert.equal(x.log.filter(v=>v?.selection).length,0);assert.equal(x.c.dialogOpen,false);
});

test("Status opens during a pending scan and updates to failure without waiting or starting another scan",async()=>{
  const x=setup();x.c.busy=true;let scans=0;x.c.scan=async()=>{scans++;return new Promise(()=>{});};
  x.c.operation={label:"Sync",status:"running",startedAt:Date.now()-25000,updatedAt:Date.now()-20000,phase:"Importing media",current:x.entry.path,completed:1,total:2,events:[],warnings:[{message:"Marker warning",path:"test.txt"}],errors:[]};
  x.ui.interact=async(title,d)=>{
    assert.match(d.querySelector("#status-content").innerHTML,/Waiting for this step/);assert.match(d.querySelector("#status-content").innerHTML,/Marker warning/);
    assert.equal(d.querySelector("#sync-now").disabled,true);assert.equal(scans,0);
    x.c.busy=false;x.c.error="Import failed";x.c.operation.status="failed";x.c.operation.errors=[{message:"Import failed",current:x.entry.path,phase:"Importing media"}];x.c.notify();
    assert.match(d.querySelector("#status-content").innerHTML,/Import failed/);assert.equal(d.querySelector("#sync-now").disabled,false);
    await d.querySelector("#close").click();
  };
  await x.ui.status();assert.equal(x.ui.statusOpen,false);assert.equal(x.ui.refreshStatus,null);
});

test("clicking Sync while busy opens progress without reentering scan or apply",async()=>{
  const x=setup();x.c.busy=true;let opened=0;x.ui.status=async()=>opened++;
  await x.ui.sync();assert.equal(opened,1);assert.equal(x.log.length,0);
});

test("Browse closes the form before the picker and preserves the bin and flags",async()=>{
  const x=setup();let forms=0;
  x.ui.interact=async(title,d)=>{
    if(++forms===1){d.querySelector("#bin").value="Manual bin";d.querySelector("#relative").checked=true;d.querySelector("#subfolders").checked=false;await d.querySelector("#browse").click();}
    else{assert.equal(d.querySelector("#folder").value,"D:/Chosen");assert.equal(d.querySelector("#bin").value,"Manual bin");assert.equal(d.querySelector("#relative").checked,true);assert.equal(d.querySelector("#subfolders").checked,false);await d.querySelector("#cancel").click();}
  };
  await x.ui.existing();assert.equal(forms,2);assert.equal(x.c.dialogOpen,false);assert.equal(x.c.data.links.length,0);
});
test("Browse cancel and failure both return to the filled form without losing its path",async()=>{
  for(const folder of [null,new Error("picker unavailable")]){
    const x=setup({folder});let forms=0;
    x.ui.interact=async(title,d)=>{
      if(++forms===1){d.querySelector("#folder").value="D:/Typed";d.querySelector("#use-root").checked=true;await d.querySelector("#use-root").change();await d.querySelector("#browse").click();}
      else{assert.equal(d.querySelector("#folder").value,"D:/Typed");assert.equal(d.querySelector("#use-root").checked,true);if(folder)assert.match(d.querySelector("#form-error").textContent,/picker unavailable/);await d.querySelector("#cancel").click();}
    };
    await x.ui.existing();assert.equal(forms,2);assert.equal(x.c.dialogOpen,false);
  }
});

test("Links puts remembered targets and its persistent checkbox in the compact footer",async()=>{
  const x=setup();x.c.data.settings={sequenceTarget:{projectName:"Selects",projectPath:"D:/Selects.prproj",sequenceName:"Footage"}};x.c.workspace={importProject:x.c.project};let enabled;
  x.c.setSequenceEnabled=async value=>{enabled=value;x.c.data.settings.sequenceEnabled=value;};
  const d=element();d.querySelectorAll=()=>[];d.innerHTML='<div id="management-content"></div>';x.ui.linksView(d);
  const html=d.querySelector("#management-content").innerHTML;
  assert.ok(html.indexOf('class="table"')<html.indexOf('class="target-controls"'));assert.doesNotMatch(html,/Relative: Off by default|FOLDER MAPPINGS|New video →/);
  assert.match(html,/Footage/);assert.match(html,/Selects → Footage/);
  const box=d.querySelector("#sequence-enabled");assert.equal(box.checked,true);box.checked=false;await box.change();assert.equal(enabled,false);
});

test("missing targets are red and Review offers files-only without modifying the saved switch",async()=>{
  const x=setup();x.c.data.settings={};assert.match(x.ui.projectControls(),/target-missing/);
  const batch={changes:[{id:"0",kind:"new-file",path:"D:/Media/a.mp4"},{id:"1",kind:"sequence-error",path:"D:/Media/a.mp4",blocking:true,message:"Sequence unavailable"}],warnings:[]};
  let call;x.c.apply=async(...args)=>{call=args;};x.ui.interact=async(title,d)=>{assert.equal(d.querySelector("#change-0").checked,true);await d.querySelector("#files-only").click();};
  await x.ui.review(batch);assert.deepEqual(call[1],["0"]);assert.deepEqual(call[3],{filesOnly:true});assert.equal(x.c.data.settings.sequenceEnabled,undefined);
});

test("Ignore cancellation changes nothing and folder selection includes the explicit parent",async()=>{
  const x=setup();let saved;x.c.setIgnored=async value=>{saved=value;};
  x.ui.interact=async(title,d)=>{await d.querySelector("#cancel").click();};await x.ui.ignorePath("D:/Media/Hidden/a.mp4");assert.equal(saved,undefined);
  x.ui.interact=async(title,d)=>{await d.querySelector("#ignore-folder").click();assert.match(d.querySelector("#ignore-scope").textContent,/New files/);assert.equal(d.querySelector("#ignore-path").value,"D:/Media/Hidden");await d.querySelector("#ignore-confirm").click();};
  await x.ui.ignorePath("D:/Media/Hidden/a.mp4");assert.deepEqual(saved,{kind:"folder",path:"D:/Media/Hidden"});
});

test("Settings hides the ignore list behind one button and preserves unsaved choices on entry",async()=>{
  const previous=global.document;global.document={createElement:()=>element()};
  try{
    const x=setup();x.c.data.settings={mode:"ASK",mp4:"ASK"};x.c.data.ignored=[{kind:"file",path:"D:/hidden.mp4"}];
    const d=element();d.querySelectorAll=()=>[];d.innerHTML='<div id="management-content"></div>';d.close=r=>d.result=r;
    x.ui.settingsView(d);await d.querySelector("#mode-MANUAL").click();await d.querySelector("#ignored-paths").click();
    assert.equal(d.result.action,"ignored");assert.equal(d.result.draft.mode,"MANUAL");assert.equal(x.c.data.settings.mode,"ASK");
  }finally{global.document=previous;}
});

test("ignore manager restores a rule then refreshes analysis without importing anything",async()=>{
  const x=setup();const rule={kind:"folder",path:"D:/Hidden"};x.c.data.ignored=[rule];let restored;
  x.c.setIgnored=async(value,remove)=>{assert.equal(remove,true);restored=value;x.c.data.ignored=[];};let opened=0;
  x.ui.interact=async(title,d)=>{if(++opened===1)await d.querySelector("#restore-ignore-0").click();else{assert.match(d.innerHTML,/No ignored paths/);await d.querySelector("#close").click();}};
  await x.ui.ignoredPaths();assert.deepEqual(restored,rule);assert.equal(opened,2);assert.equal(x.log.includes("scan"),true);
});

test("Ignore maps managed bin rows to disk folders without targeting logical ancestors",()=>{
  const x=setup(),batch={projectPath:"D:/P.prproj",links:[{id:"a",binPath:"Parent/Video",folderPath:"D:/Media"}],scans:{a:{dirs:[{rel:"Child",path:"D:/Media/Child"}]}}};
  assert.equal(x.ui.ignoreSource({linkId:"a",kind:"new-folder",path:"Parent"},batch),null);
  assert.deepEqual(x.ui.ignoreSource({linkId:"a",kind:"conflict",path:"Parent/Video/Child"},batch),{kind:"folder",path:"D:/Media/Child"});
  assert.deepEqual(x.ui.ignoreSource({linkId:"a",kind:"unavailable",path:"Parent/Video"},batch),{kind:"folder",path:"D:/Media"});
});
