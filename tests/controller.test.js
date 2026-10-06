"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
function setup() {
  const project={path:"D:/Prod/Footage.prproj",name:"Footage"}, log=[];
  const data={version:1,links:[{id:"a",binId:"b",binPath:"Video",folderPath:"D:/Media",subfolders:true}],settings:{mode:"ASK",mp4:"ASK"},records:{},history:[]};
  const inv={bins:[{id:"b",path:"Video"}],clips:[],handles:new Map()};
  let active=project, files=[{path:"D:/Media/a.wav",rel:"a.wav",size:100,mtime:1,identity:"i"}];
  const host={ppro:{Project:{getActiveProject:async()=>active}},inventory:async()=>inv,applyChange:async(p,c)=>{log.push(c);if(c.kind==="new-file"||c.kind==="fragmented") inv.clips.push({id:"c"+log.length,mediaPath:c.path,parentPath:c.target});}};
  const store={defaults:()=>JSON.parse(JSON.stringify(data)),load:async()=>JSON.parse(JSON.stringify(data)),save:async()=>{log.push({kind:"persist"});},diagnostic:async()=>{}};
  class Scanner {async scan(){return {dirs:[{rel:"",identity:"dir"}],files};} async validate(f){if(!files.some(x=>x.path===f.path && x.size===f.size && x.mtime===f.mtime)) throw new Error("Source changed after analysis.");}}
  const filename=path.resolve("plugin/controller.js"), mod={exports:{}};
  const wrapper=vm.runInThisContext("(function(require,module,exports){"+fs.readFileSync(filename,"utf8")+"\n})",{filename});
  wrapper(id=>id==="./host/premiere"?host:id==="./host/store"?store:id==="./host/filesystem"?{Scanner}:id==="./host/marker-service"?{analyze:async()=>({media:[],warnings:[],changes:[]})}:require(path.resolve("plugin",id)),mod,mod.exports);
  const c=new mod.exports.Controller();return {c,log,inv,setActive:p=>active=p,setFiles:f=>files=f,project};
}
test("scan does not mutate the project or persist a link",async()=>{
  const x=setup();await x.c.scan();assert.equal(x.c.batch.changes.length,1);assert.equal(x.log.length,0);
});
test("unresolved fragmented media prevents every mutation in the batch",async()=>{
  const x=setup();x.setFiles([{path:"D:/Media/a.mp4",rel:"a.mp4",size:100,mtime:1,identity:"i",fragmented:true},{path:"D:/Media/b.wav",rel:"b.wav",size:10,mtime:1,identity:"j"}]);const batch=await x.c.scan();await assert.rejects(()=>x.c.apply(batch),/Resolve blocking/);assert.equal(x.log.length,0);
});
test("project switch after review cannot mutate either project",async()=>{
  const x=setup(),batch=await x.c.scan();x.setActive({path:"D:/Other.prproj"});await assert.rejects(()=>x.c.apply(batch),/active project changed/);assert.equal(x.log.length,0);
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
test("unimplemented Ignore or Repackage decisions cannot authorize import or safe mutations",async()=>{
  for(const decision of ["ignore","remux","repackage"]){
    const x=setup();x.setFiles(fragmentedBatch());const batch=await x.c.scan(),media=batch.changes.find(c=>c.kind==="fragmented");
    await assert.rejects(()=>x.c.apply(batch,undefined,{[media.id]:decision}),/Resolve blocking/);assert.equal(x.log.length,0);
  }
});
