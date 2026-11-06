"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
function setup() {
  const project={path:"D:/Prod/Footage.prproj",name:"Footage"}, log=[];
  const data={version:1,links:[{id:"a",binId:"b",binPath:"Video",folderPath:"D:/Media",subfolders:true}],settings:{mode:"ASK",mp4:"ASK"},records:{},history:[]};
  const inv={bins:[{id:"b",path:"Video"}],clips:[],handles:new Map()};
  let active=project, files=[{path:"D:/Media/a.wav",rel:"a.wav",size:100,mtime:1,identity:"i"}];
  let available=true;
  const host={resolveProject:async binding=>available&&binding?.path===project.path?project:null,ppro:{Project:{getActiveProject:async()=>active}},inventory:async()=>inv,applyChange:async(p,c)=>{assert.equal(p,project);log.push(c);if(c.kind==="new-file"||c.kind==="fragmented") inv.clips.push({id:"c"+log.length,mediaPath:c.path,parentPath:c.target});}};
  const store={loadWorkspace:async()=>({version:1,importProject:{path:project.path,name:project.name}}),saveWorkspace:async()=>{},defaults:()=>JSON.parse(JSON.stringify(data)),load:async()=>JSON.parse(JSON.stringify(data)),save:async()=>{log.push({kind:"persist"});},diagnostic:async()=>{}};
  const sequence={receipts:[],async snapshot(){return {ledger:{imports:this.receipts},fingerprint:JSON.stringify(this.receipts)};},async apply(entry,item,save){entry.attempt={start:0};await save();log.push({kind:"append",path:entry.path});this.receipts.push({key:entry.key});},async keep(entry){this.receipts.push({key:entry.key});}};
  class Scanner {async scan(){return {dirs:[{rel:"",identity:"dir"}],files};} async validate(f){if(!files.some(x=>x.path===f.path && x.size===f.size && x.mtime===f.mtime)) throw new Error("Source changed after analysis.");}}
  const filename=path.resolve("plugin/controller.js"), mod={exports:{}};
  const wrapper=vm.runInThisContext("(function(require,module,exports){"+fs.readFileSync(filename,"utf8")+"\n})",{filename});
  wrapper(id=>id==="./host/premiere"?host:id==="./host/store"?store:id==="./host/sequence"?sequence:id==="./host/filesystem"?{Scanner}:id==="./host/marker-service"?{analyze:async()=>({media:[],warnings:[],changes:[]})}:require(path.resolve("plugin",id)),mod,mod.exports);
  const c=new mod.exports.Controller();return {c,log,inv,host,store,sequence,setAvailable:v=>available=v,setActive:p=>active=p,setFiles:f=>files=f,project};
}
test("scan does not mutate the project or persist a link",async()=>{
  const x=setup();await x.c.scan();assert.equal(x.c.batch.changes.length,1);assert.equal(x.log.length,0);
});

test("a stale previous project guid does not block automatic reacquisition of the saved project",async()=>{
  const x=setup();x.project.guid="same-guid";await x.c.context();const data=x.c.data;
  const fresh={path:x.project.path,name:x.project.name,guid:"same-guid"};Object.defineProperty(x.project,"guid",{get(){throw Error("a null ptr was detected");}});
  x.host.resolveProject=async()=>fresh;await x.c.context();assert.equal(x.c.project,fresh);assert.equal(x.c.data,data);assert.equal(x.c.projectId,"same-guid");
  x.c.project=x.project;await x.c.assertContext(fresh.path);assert.equal(x.c.project,fresh);assert.equal(x.log.length,0);
});

test("a transient lookup failure is retried on the next background scan without replacing the saved target",async()=>{
  const x=setup();await x.c.scan();let calls=0;const resolve=x.host.resolveProject;
  x.host.resolveProject=async binding=>{if(++calls===1)throw Error("a null ptr was detected");return resolve(binding);};
  await assert.rejects(()=>x.c.scan(undefined,true),/null ptr/);assert.equal(x.c.workspace.importProject.path,x.project.path);
  const next=await x.c.scan(undefined,true);assert.equal(next.changes.length,1);assert.equal(x.c.error,null);assert.equal(x.c.operation.status,"completed");assert.equal(x.log.length,0);
});

test("first scan uses links loaded from the active project rather than stale defaults",async()=>{
  const x=setup();x.c.data.links=[];await x.c.scan();assert.equal(x.c.batch.changes.length,1);
});

test("analyzing a draft link does not replace the live pending batch or persist the draft",async()=>{
  const x=setup();await x.c.scan();const current=x.c.batch,links=[{...x.c.data.links[0],id:"draft"}];
  const preview=await x.c.scan(links);assert.equal(preview.links,links);assert.equal(x.c.batch,current);assert.equal(x.c.data.links[0].id,"a");assert.equal(x.log.length,0);
});

test("live progress identifies a pending import, then retains the failure and releases busy",async()=>{
  const x=setup(),batch=await x.c.scan();let rejectImport,entered;
  const atImport=new Promise(r=>entered=r);
  x.host.applyChange=async(p,change,inv,report)=>{report("Importing media",change.path);entered();await new Promise((_,reject)=>rejectImport=reject);};
  const applying=x.c.apply(batch);await atImport;
  assert.equal(x.c.busy,true);assert.equal(x.c.operation.phase,"Importing media");assert.equal(x.c.operation.current,"D:/Media/a.wav");assert.equal(x.c.operation.total,1);
  rejectImport(new Error("Premiere rejected media"));await assert.rejects(applying,/rejected media/);
  assert.equal(x.c.busy,false);assert.equal(x.c.operation.status,"failed");assert.equal(x.c.operation.errors[0].phase,"Importing media");
  await x.c.scan(undefined,true);assert.equal(x.c.operation.status,"failed","quiet polling must preserve the last failure details");
});

test("import checkpoints reuse verified inventory while preserving final reconciliation",async()=>{
  const x=setup();let inventories=0;
  x.host.inventory=async()=>{inventories++;return x.inv;};
  const original=x.host.applyChange;x.host.applyChange=async(...args)=>{await original(...args);return x.inv;};
  const batch=await x.c.scan();inventories=0;await x.c.apply(batch);
  assert.equal(inventories,3); // preflight, final checkpoint, final scan; import owns its before/after checks.
  assert.equal(x.c.operation.completed,1);assert.equal(x.c.operation.status,"completed");assert.equal(x.c.batch.changes.length,0);
});

test("unavailable sources appear in current operation warnings without mutations",async()=>{
  const x=setup();x.c.scanner.scan=async()=>({files:[],dirs:[],error:"Network folder unavailable"});await x.c.scan();
  assert.equal(x.c.operation.status,"warnings");assert.match(x.c.operation.warnings[0].message,/Network/);assert.equal(x.log.length,0);
});
test("unresolved fragmented media prevents every mutation in the batch",async()=>{
  const x=setup();x.setFiles([{path:"D:/Media/a.mp4",rel:"a.mp4",size:100,mtime:1,identity:"i",fragmented:true},{path:"D:/Media/b.wav",rel:"b.wav",size:10,mtime:1,identity:"j"}]);const batch=await x.c.scan();await assert.rejects(()=>x.c.apply(batch),/Resolve blocking/);assert.equal(x.log.length,0);
});
test("switching the active tab keeps imports pinned to the explicitly selected project",async()=>{
  const x=setup(),batch=await x.c.scan();x.setActive({path:"D:/Other.prproj"});await x.c.apply(batch);assert.equal(x.inv.clips.length,1);assert.equal(x.c.path,x.project.path);
});
test("a missing pinned project cannot redirect imports to the active tab",async()=>{
  const x=setup(),batch=await x.c.scan();x.setAvailable(false);x.setActive({path:"D:/Other.prproj"});await assert.rejects(()=>x.c.apply(batch),/selected import project changed/);assert.equal(x.log.length,0);
});
test("source change after review invalidates the confirmation",async()=>{
  const x=setup(),batch=await x.c.scan();x.setFiles([{path:"D:/Media/a.wav",rel:"a.wav",size:999,mtime:2,identity:"i"}]);await assert.rejects(()=>x.c.apply(batch),/changed after analysis/);assert.equal(x.log.length,0);
});
test("replacement with identical size and timestamp invalidates the reviewed identity",async()=>{
  const x=setup(),batch=await x.c.scan();x.setFiles([{path:"D:/Media/a.wav",rel:"a.wav",size:100,mtime:1,identity:"replacement"}]);await assert.rejects(()=>x.c.apply(batch),/changed after analysis/);assert.equal(x.log.length,0);
});
test("deferring every item keeps sources pending and does not report up to date",async()=>{
  const x=setup();x.setFiles([{path:"D:/Media/a.mp4",rel:"a.mp4",size:100,mtime:1,identity:"i",fragmented:true}]);await x.c.apply(await x.c.scan(),[]);assert.equal(x.inv.clips.length,0);assert.equal(x.c.batch.changes.length,1);assert.equal(x.c.data.history[0].message,"No changes applied");
});
test("safe sync applies once and repeat sync reuses the existing item",async()=>{
  const x=setup();await x.c.apply(await x.c.scan());const first=x.log.filter(c=>c.kind==="new-file").length;assert.equal(first,1);await x.c.apply(await x.c.scan());assert.equal(x.log.filter(c=>c.kind==="new-file").length,1);assert.equal(x.c.batch.changes.length,0);
});

const fragmentedBatch=()=>[
  {path:"D:/Media/a.mp4",rel:"a.mp4",size:100,mtime:1,identity:"mp4",fragmented:true},
  {path:"D:/Media/b.wav",rel:"b.wav",size:10,mtime:1,identity:"wav"}
];
test("Fix automatically holds the entire batch while a remux helper is unavailable",async()=>{
  const x=setup();x.setFiles(fragmentedBatch());await x.c.context();x.c.data.settings.mp4="AUTO";
  const batch=await x.c.scan();assert.equal(batch.hasBlocking,true);
  await assert.rejects(()=>x.c.apply(batch),/Resolve blocking/);assert.equal(x.log.length,0);
});
test("Don't fix explicitly permits original fragmented media and repeat imports nothing",async()=>{
  const x=setup();x.setFiles(fragmentedBatch());await x.c.context();x.c.data.settings.mp4="NONE";
  const batch=await x.c.scan();assert.equal(batch.hasBlocking,false);await x.c.apply(batch);
  assert.equal(x.inv.clips.length,2);await x.c.apply(await x.c.scan());assert.equal(x.inv.clips.length,2);
});
test("an explicit Import original decision resolves only its reviewed MP4",async()=>{
  const x=setup();x.setFiles(fragmentedBatch());const batch=await x.c.scan(),media=batch.changes.find(c=>c.kind==="fragmented");
  await x.c.apply(batch,undefined,{[media.id]:"original"});assert.equal(x.inv.clips.length,2);
  assert.equal(x.c.batch.changes.length,0);
});
test("selected safe media can sync while deferred MP4 remains pending on repeat",async()=>{
  const x=setup();x.setFiles(fragmentedBatch());const batch=await x.c.scan();
  await x.c.apply(batch,batch.changes.filter(c=>!c.blocking).map(c=>c.id));
  assert.equal(x.inv.clips.length,1);assert.match(x.inv.clips[0].mediaPath,/b.wav$/);
  const repeat=await x.c.scan();assert.equal(repeat.changes.length,1);assert.equal(repeat.changes[0].kind,"fragmented");
});
test("unsupported inline Ignore or Repackage decisions cannot authorize import or safe mutations",async()=>{
  for(const decision of ["ignore","remux","repackage"]){
    const x=setup();x.setFiles(fragmentedBatch());const batch=await x.c.scan(),media=batch.changes.find(c=>c.kind==="fragmented");
    await assert.rejects(()=>x.c.apply(batch,undefined,{[media.id]:decision}),/Resolve blocking/);assert.equal(x.log.length,0);
  }
});

const target={projectPath:"D:/Prod/Selects.prproj",projectName:"Selects",sequenceId:"sequence",sequenceName:"Footage"};
const dated=(name="clip1")=>({path:"D:/Media/2026-10-27/"+name+".mp4",rel:name+".mp4",size:100,mtime:1,identity:name});
async function withSequence(){const x=setup();await x.c.context();x.c.data.settings.sequenceTarget=target;return x;}
test("new footage appends in date/name order and repeat sync leaves the sequence alone",async()=>{
  const x=await withSequence();x.setFiles([dated("clip10"),dated("clip2")]);await x.c.apply(await x.c.scan());
  assert.deepEqual(x.log.filter(v=>v.kind==="append").map(v=>v.path),[dated("clip2").path,dated("clip10").path]);
  assert.equal(x.c.data.sequenceQueue.length,0);assert.equal(x.c.data.sequenceObserved.length,2);
  assert.equal((await x.c.scan()).changes.length,0);await x.c.apply(await x.c.scan());assert.equal(x.sequence.receipts.length,2);
});
test("one undated folder falls back to its name without poisoning correctly dated files",async()=>{
  const x=await withSequence();const paths=["L:/Iron Frontier/02_Assets/01_VIDEO/2026-10-15/Vasiliy_2026-10-15-17-42.mp4","L:/Iron Frontier/02_Assets/01_VIDEO/2026-10-16/Vasiliy_2026-10-16-17-33.mp4","L:/Iron Frontier/02_Assets/01_VIDEO/Developer Footage/#5.mp4"];
  x.setFiles(paths.map((path,i)=>({...dated(String(i)),path})));const batch=await x.c.scan();
  assert.equal(batch.hasBlocking,false);assert.deepEqual(batch.changes.filter(v=>v.kind==="append-footage").map(v=>v.date),["2026-10-15","2026-10-16","Developer Footage"]);
  assert.equal(batch.changes.filter(v=>v.kind==="new-file").every(v=>!v.blocking),true);
  await x.c.apply(batch);assert.equal(x.inv.clips.length,3);assert.equal(x.sequence.receipts.length,3);
});
test("a failed append remains pending after media import and cannot automatically replay",async()=>{
  const x=await withSequence();x.setFiles([dated()]);x.sequence.apply=async(entry,item,save)=>{entry.attempt={start:0};await save();throw new Error("Host failed after insertion");};
  await x.c.apply(await x.c.scan());assert.equal(x.c.operation.status,"warnings");
  assert.equal(x.inv.clips.length,1);assert.equal(x.c.data.sequenceQueue.length,1);
  const next=await x.c.scan();assert.equal(next.changes.length,1);assert.equal(next.changes[0].kind,"sequence-review");
  await assert.rejects(()=>x.c.apply(next),/Resolve blocking/);assert.equal(x.log.filter(v=>v.kind==="new-file").length,1);
  await x.c.apply(next,undefined,{[next.changes[0].id]:"keep"});assert.equal((await x.c.scan()).changes.length,0);
});

test("the sequence checkbox pauses appends without forgetting the target or backfilling skipped imports",async()=>{
  const x=await withSequence();await x.c.setSequenceEnabled(false);x.setFiles([dated()]);await x.c.apply(await x.c.scan());
  assert.deepEqual(x.c.data.settings.sequenceTarget,target);assert.equal(x.inv.clips.length,1);assert.equal(x.sequence.receipts.length,0);
  await x.c.setSequenceEnabled(true);assert.equal((await x.c.scan()).changes.length,0);
  x.setFiles([dated(),dated("clip2")]);await x.c.apply(await x.c.scan());assert.equal(x.sequence.receipts.length,1);
});

test("an unavailable sequence leaves media import selectable and Import files only skips its append",async()=>{
  const x=await withSequence();x.setFiles([dated()]);x.sequence.snapshot=async()=>{throw Error("Selected sequence is closed");};
  const batch=await x.c.scan();assert.equal(batch.hasBlocking,true);assert.equal(batch.changes.find(c=>c.kind==="new-file").blocking,false);
  await assert.rejects(()=>x.c.apply(batch),/Resolve blocking/);await x.c.apply(batch,undefined,{}, {filesOnly:true});
  assert.equal(x.inv.clips.length,1);assert.equal(x.c.data.sequenceQueue.length,0);assert.equal(x.c.data.sequenceSkipped.length,1);assert.deepEqual(x.c.data.settings.sequenceTarget,target);
  assert.equal((await x.c.scan()).changes.length,0);
});

test("Import files only skips queued appends durably even if the target becomes available later",async()=>{
  const x=await withSequence();x.setFiles([dated()]);const first=await x.c.scan();await x.c.apply(first,first.changes.filter(c=>c.kind==="new-file").map(c=>c.id));
  assert.equal(x.c.data.sequenceQueue.length,1);await x.c.apply(await x.c.scan(),undefined,{}, {filesOnly:true});
  assert.equal(x.c.data.sequenceQueue.length,0);assert.equal((await x.c.scan()).changes.length,0);assert.equal(x.sequence.receipts.length,0);
});

test("a pre-mutation title failure does not prevent other files from importing and requires explicit retry",async()=>{
  const x=await withSequence();x.setFiles([dated(),dated("clip2")]);x.sequence.apply=async()=>{throw Error("Title preparation failed");};
  await x.c.apply(await x.c.scan());assert.equal(x.inv.clips.length,2);assert.equal(x.c.data.sequenceQueue.length,2);
  const batch=await x.c.scan();assert.equal(batch.changes.every(c=>c.kind==="sequence-review"&&c.blocking),true);
  await assert.rejects(()=>x.c.apply(batch),/Resolve blocking/);
});
test("importing only the selected media preserves its deferred sequence append intent",async()=>{
  const x=await withSequence();x.setFiles([dated()]);const batch=await x.c.scan();await x.c.apply(batch,batch.changes.filter(v=>v.kind==="new-file").map(v=>v.id));
  assert.equal(x.inv.clips.length,1);assert.equal(x.c.data.sequenceQueue.length,1);
  await x.c.apply(await x.c.scan());assert.equal(x.sequence.receipts.length,1);assert.equal(x.log.filter(v=>v.kind==="new-file").length,1);
});
test("a missing sequence receipt after Undo/reopen requires review and never duplicates automatically",async()=>{
  const x=await withSequence();x.setFiles([dated()]);await x.c.apply(await x.c.scan());x.sequence.receipts=[];
  const batch=await x.c.scan();assert.equal(batch.changes[0].kind,"sequence-review");await assert.rejects(()=>x.c.apply(batch),/Resolve blocking/);assert.equal(x.log.filter(v=>v.kind==="append").length,1);
});

test("a completed host receipt reconciles an interrupted sidecar checkpoint without replay or source media",async()=>{
  const x=await withSequence();x.setFiles([dated()]);await x.c.apply(await x.c.scan());
  x.c.data.sequenceQueue=[{...x.c.data.sequenceObserved[0],attempt:{start:0}}];
  x.c.data.records={};x.setFiles([]);x.inv.clips=[];
  const batch=await x.c.scan();assert.equal(batch.changes.length,1);assert.equal(batch.changes[0].checkpoint,true);
  await x.c.apply(batch);assert.equal(x.c.data.sequenceQueue.length,0);assert.equal((await x.c.scan()).changes.length,0);
  assert.equal(x.log.filter(v=>v.kind==="append").length,1);assert.equal(x.log.filter(v=>v.kind==="new-file").length,1);
});

test("fragmented footage cannot silently append before its source import is selected",async()=>{
  const x=await withSequence();x.setFiles([{...dated(),fragmented:true}]);const batch=await x.c.scan(),append=batch.changes.find(c=>c.kind==="append-footage");
  await assert.rejects(()=>x.c.apply(batch,[append.id]),/Select and resolve the source import/);
  assert.equal(x.inv.clips.length,0);assert.equal(x.sequence.receipts.length,0);assert.equal(x.log.length,0);
  const source=batch.changes.find(c=>c.kind==="fragmented");await x.c.apply(batch,[source.id,append.id],{[source.id]:"original"});
  assert.equal(x.inv.clips.length,1);assert.equal(x.sequence.receipts.length,1);assert.equal((await x.c.scan()).changes.length,0);
});

test("ignored paths suppress persistent append failures and restore the pending intent without mutation",async()=>{
  const x=await withSequence();x.setFiles([dated()]);x.sequence.apply=async()=>{throw Error("Cannot prepare title");};await x.c.apply(await x.c.scan());
  assert.equal(x.c.operation.status,"warnings");const queue=JSON.stringify(x.c.data.sequenceQueue);
  const rule={kind:"file",path:dated().path};await x.c.setIgnored(rule);
  assert.equal(x.c.operation.warnings.length,0);assert.equal(x.c.operation.status,"completed");
  assert.equal((await x.c.scan()).changes.length,0);assert.equal(JSON.stringify(x.c.data.sequenceQueue),queue);
  await x.c.setIgnored(rule,true);assert.equal((await x.c.scan()).changes[0].kind,"sequence-review");assert.equal(x.inv.clips.length,1);
});

test("ignore is persistent by path, survives replacements, and cannot swallow sibling paths",async()=>{
  const x=setup();await x.c.context();await x.c.setIgnored({kind:"folder",path:"D:/Media/Hidden"});
  x.setFiles([{...dated(),path:"D:/Media/Hidden/a.mp4"},{...dated("b"),path:"D:/Media/Hidden2/b.mp4"}]);
  let batch=await x.c.scan();assert.deepEqual(batch.changes.map(c=>c.path),["D:/Media/Hidden2/b.mp4"]);
  x.setFiles([{...dated(),path:"D:/Media/Hidden/a.mp4",mtime:9,identity:"replacement"}]);assert.equal((await x.c.scan()).changes.length,0);
  await x.c.setIgnored({kind:"folder",path:"d:/MEDIA/hidden"},true);assert.equal((await x.c.scan()).changes.length,1);
});

test("ignored unavailable root is never scanned and no source or folder error is emitted",async()=>{
  const x=setup();await x.c.context();await x.c.setIgnored({kind:"folder",path:"D:/Media"});x.c.scanner.scan=async()=>{throw Error("Must not access the ignored root");};
  const batch=await x.c.scan();assert.deepEqual(batch.changes,[]);assert.equal(batch.hasBlocking,false);assert.equal(x.c.operation.warnings.length,0);
});

test("ignore persistence failure rolls back the rule and preserves the current batch",async()=>{
  const x=setup(),batch=await x.c.scan();x.store.save=async()=>{throw Error("Read only sidecar");};
  await assert.rejects(()=>x.c.setIgnored({kind:"file",path:"D:/Media/a.wav"}),/Read only/);assert.deepEqual(x.c.data.ignored,[]);assert.equal(x.c.batch,batch);
});
