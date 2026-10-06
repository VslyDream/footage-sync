"use strict";
const test=require("node:test"), assert=require("node:assert/strict"), {planSync}=require("../plugin/core/planner"), P=require("../plugin/core/paths");
function fixture() {
  return {links:[{id:"a",binId:"b",binPath:"Footage/Video",folderPath:"D:/Media",subfolders:true}],scans:{a:{dirs:[{rel:"",identity:"dir0"}],files:[]}},inventory:{bins:[{id:"f",path:"Footage"},{id:"b",path:"Footage/Video"}],clips:[]},records:{}};
}
const file=(path,rel,id)=>({path,rel,identity:id,size:100,mtime:1});
test("Windows drive roots stay absolute through scan and relative-path operations",()=>{
  assert.equal(P.clean("D:\\"),"D:/");
  assert.equal(P.clean("D:/Media/.."),"D:/");
  assert.equal(P.native("D:/"),"D:\\");
  assert.equal(P.dirname("D:/clip.wav"),"D:/");
  assert.equal(P.dirname("clip.wav"),"");
  assert.equal(P.resolve("D:/","Media"),"D:/Media");
  assert.equal(P.relative("D:/","D:/Media"),"Media");
  assert.equal(P.within("D:/Media","D:/"),true);
  assert.equal(P.within("T:/Media","D:/"),false);
});
test("initial reconciliation is read-only and imports only missing media",()=>{
  const x=fixture();x.scans.a.dirs.push({rel:"Day",identity:"dir1"});x.scans.a.files=[file("D:/Media/Day/a.wav","Day/a.wav","i1"),file("D:/Media/Day/b.wav","Day/b.wav","i2")];
  x.inventory.clips=[{id:"c1",mediaPath:"D:/Media/Day/a.wav",parentPath:"Elsewhere"}];
  const original=JSON.stringify(x), p=planSync(x);
  assert.equal(JSON.stringify(x),original);assert.equal(p.changes.filter(c=>c.kind==="new-file").length,1);assert.equal(p.changes.filter(c=>c.kind==="reconcile-item").length,1);assert.equal(p.hasBlocking,false);
});
test("Windows path spelling differences cannot cause duplicate import",()=>{
  const x=fixture();x.scans.a.files=[file("D:/Media/a.wav","a.wav","i")];x.inventory.clips=[{id:"c",mediaPath:"d:\\media\\A.WAV",parentPath:"Footage/Video"}];
  const p=planSync(x);assert.equal(p.changes.length,0);assert.equal(p.reused.filter(c=>c.kind==="file").length,1);
});
test("rename and move preserve an existing Project Item",()=>{
  const x=fixture();x.scans.a.dirs.push({rel:"Day",identity:"dir1"});x.scans.a.files=[file("D:/Media/Day/renamed.wav","Day/renamed.wav","i")];
  x.records.a={dirs:[],files:[{...file("D:/Media/a.wav","a.wav","i"),itemId:"c"}]};x.inventory.clips=[{id:"c",mediaPath:"D:/Media/a.wav",parentPath:"Footage/Video"}];
  const p=planSync(x);assert.equal(p.changes.find(c=>c.kind==="move-file").itemId,"c");assert.equal(p.changes.some(c=>c.kind==="new-file"),false);
});
test("copy with the old path still present is not mistaken for a rename",()=>{
  const x=fixture();x.scans.a.files=[file("D:/Media/a.wav","a.wav","i"),file("D:/Media/b.wav","b.wav","j")];x.records.a={dirs:[],files:[{...x.scans.a.files[0],itemId:"c"}]};x.inventory.clips=[{id:"c",mediaPath:"D:/Media/a.wav",parentPath:"Footage/Video"}];
  const p=planSync(x);assert.equal(p.changes[0].kind,"new-file");assert.equal(p.changes[0].path,"D:/Media/b.wav");
});
test("delete never plans removal and retains the identity for later recovery",()=>{
  const x=fixture();x.records.a={dirs:[],files:[{...file("D:/Media/a.wav","a.wav","i"),itemId:"c"}]};x.inventory.clips=[{id:"c",mediaPath:"D:/Media/a.wav",parentPath:"Footage/Video"}];
  const p=planSync(x);assert.equal(p.changes.length,0);assert.equal(p.next.a.files[0].itemId,"c");
});
test("missing identity blocks ambiguous new media instead of creating duplicate",()=>{
  const x=fixture();x.scans.a.files=[file("D:/Media/b.wav","b.wav",null)];x.records.a={dirs:[],files:[{...file("D:/Media/a.wav","a.wav",null),itemId:"c"}]};x.inventory.clips=[{id:"c",mediaPath:"D:/Media/a.wav",parentPath:"Footage/Video"}];
  const p=planSync(x);assert.equal(p.hasBlocking,true);assert.equal(p.changes[0].kind,"conflict");assert.equal(p.changes.some(c=>c.kind==="new-file"),false);
});
test("folder rename reuses the managed bin",()=>{
  const x=fixture();x.scans.a.dirs.push({rel:"New",identity:"dir1"});x.inventory.bins.push({id:"day",path:"Footage/Video/Old"});x.records.a={files:[],dirs:[{rel:"Old",identity:"dir1",binId:"day"}]};
  const p=planSync(x);assert.equal(p.changes[0].kind,"folder-move");assert.equal(p.changes[0].itemId,"day");assert.equal(p.changes.length,1);
});
test("unavailable source and fragmented media block the whole batch",()=>{
  const x=fixture();x.links.push({id:"off",folderPath:"Z:/Offline"});x.scans.off={error:"Not found"};x.scans.a.files=[{...file("D:/Media/a.mp4","a.mp4","i"),fragmented:true},file("D:/Media/b.wav","b.wav","j")];
  const p=planSync(x);assert.equal(p.hasBlocking,true);assert.equal(p.changes.filter(c=>c.blocking).length,2);assert.equal(p.changes.filter(c=>!c.blocking).length,1);
});
test("existing duplicate items and bin collisions are explicit conflicts",()=>{
  const x=fixture();x.scans.a.files=[file("D:/Media/a.wav","a.wav","i")];x.inventory.clips=[{id:"c1",mediaPath:"D:/Media/a.wav"},{id:"c2",mediaPath:"D:/Media/a.wav"}];
  assert.equal(planSync(x).changes[0].kind,"conflict");
});
test("relative path round trips and rejects a different volume",()=>{
  assert.equal(P.relative("D:/Prod/Footage","D:/Prod/Assets/Video"),"../Assets/Video");assert.equal(P.resolve("D:/Prod/Footage","../Assets/Video"),"D:/Prod/Assets/Video");assert.throws(()=>P.relative("D:/Prod","T:/Video"));
});
test("Premiere extended Windows paths compare and resolve like normal paths",()=>{
  assert.equal(P.key("\\\\?\\D:\\Media\\A.wav"),P.key("D:/Media/a.wav"));
  assert.equal(P.relative("\\\\?\\D:\\Prod\\Footage","D:/Prod/Assets"),"../Assets");
  assert.equal(P.clean("\\\\?\\UNC\\Server\\Share\\Media"),"//Server/Share/Media");
});

test("relative paths reject different UNC shares",()=>{
  assert.equal(P.relative("//Server/Share/Project","//server/share/Media"),"../Media");
  assert.throws(()=>P.relative("//Server/Share/Project","//Server/Other/Media"));
});

test("move between independent links preserves the original item and transfers its record",()=>{
  const x=fixture();x.links.push({id:"b",binId:"b2",binPath:"Audio",folderPath:"D:/Audio"});
  x.inventory.bins.push({id:"b2",path:"Audio"});x.scans.b={dirs:[{rel:"",identity:"dir2"}],files:[file("D:/Audio/a.wav","a.wav","i")]};
  x.inventory.clips=[{id:"c",mediaPath:"D:/Media/a.wav",parentPath:"Footage/Video"}];x.records.a={dirs:[],files:[{...file("D:/Media/a.wav","a.wav","i"),itemId:"c"}]};
  const p=planSync(x);assert.equal(p.changes.length,1);assert.equal(p.changes[0].kind,"move-file");assert.equal(p.changes[0].itemId,"c");assert.equal(p.next.a.files.length,0);assert.equal(p.next.b.files[0].itemId,"c");
});

test("unidentified folder rename blocks descendants rather than importing in a wrong bin",()=>{
  const x=fixture();x.inventory.bins.push({id:"day",path:"Footage/Video/Old"});x.records.a={files:[],dirs:[{rel:"Old",binId:"day",identity:null}]};
  x.scans.a.dirs.push({rel:"New",identity:null});x.scans.a.files=[file("D:/Media/New/a.wav","New/a.wav","i")];
  const p=planSync(x);assert.equal(p.hasBlocking,true);assert.equal(p.changes.length,2);assert.equal(p.changes.every(c=>c.blocking),true);
});

test("growing renamed source is not relinked until settled",()=>{
  const x=fixture();x.inventory.clips=[{id:"c",mediaPath:"D:/Media/a.wav",parentPath:"Footage/Video"}];x.records.a={dirs:[],files:[{...file("D:/Media/a.wav","a.wav","i"),itemId:"c"}]};
  x.scans.a.files=[{...file("D:/Media/b.wav","b.wav","i"),issue:"Still writing"}];
  const p=planSync(x);assert.equal(p.changes[0].kind,"media-error");assert.equal(p.hasBlocking,true);
});
