"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),P=require("../plugin/core/paths"),{planSync}=require("../plugin/core/planner");

test("POSIX root joins stay absolute without becoming a Windows UNC path",()=>{
  assert.equal(P.join("/","Volumes","Media"),"/Volumes/Media");
  assert.equal(P.join("/","/Users/editor"),"/Users/editor");
  assert.equal(P.resolve("/","Volumes/Media"),"/Volumes/Media");
  assert.equal(P.native(P.join("/","Volumes","Media")),"/Volumes/Media");
  assert.equal(P.join("//server/share/","Media"),"//server/share/Media");
  assert.equal(P.join("D:/","Media"),"D:/Media");
});
test("Mac-style user and mounted-volume paths preserve spelling and relative locations",()=>{
  const base="/Volumes/Shared/My Production/00_Footage",media="/Volumes/Shared/My Production/02_Assets/Яблоко банан";
  const relative=P.relative(base,media);
  assert.equal(relative,"../02_Assets/Яблоко банан");assert.equal(P.resolve(base,relative),media);
  assert.equal(P.dirname("/Users/editor/Footage.prproj"),"/Users/editor");
  assert.equal(P.dirname("/Footage.prproj"),"/");assert.equal(P.relative("/",media),media.slice(1));
  assert.notEqual(P.key("/Volumes/Media/A.mp4"),P.key("/Volumes/Media/a.mp4")); // Do not merge files on a case-sensitive volume.
  assert.equal(P.native(media),media);
});
test("POSIX reconciliation reuses existing items and preserves identity on source rename",()=>{
  const original="/Volumes/Shared/Media/Яблоко.mp4",renamed="/Volumes/Shared/Media/Яблоко новое.mp4";
  const args={links:[{id:"a",binId:"bin",binPath:"Footage/Video",folderPath:"/Volumes/Shared/Media",subfolders:true}],
    scans:{a:{dirs:[{rel:"",identity:"dir"}],files:[{path:original,rel:"Яблоко.mp4",identity:"clip-inode",size:100,mtime:1}]}},
    inventory:{bins:[{id:"bin",path:"Footage/Video"}],clips:[{id:"clip",mediaPath:original,parentPath:"Footage/Video"}]},
    records:{a:{files:[{path:original,itemId:"clip",identity:"clip-inode",size:100,mtime:1}],dirs:[]}}};
  assert.equal(planSync(args).changes.length,0);
  args.scans.a.files[0]={...args.scans.a.files[0],path:renamed,rel:"Яблоко новое.mp4"};
  const changes=planSync(args).changes;assert.equal(changes.length,1);assert.equal(changes[0].kind,"rename-file");
  assert.equal(changes[0].itemId,"clip");assert.equal(P.native(changes[0].path),renamed);
});
