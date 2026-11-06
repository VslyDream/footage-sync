"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path"),Ignore=require("../plugin/core/ignore");
test("ignore rules respect path boundaries, Windows aliases and POSIX case",()=>{
  const rules=[Ignore.rule({kind:"folder",path:"\\\\?\\D:\\Media\\#Съёмка\\"}),{kind:"file",path:"D:/Media/a.wav"}];
  assert.equal(Ignore.matches("d:/media/#СЪЁМКА/sub/a.mp4",rules),true);assert.equal(Ignore.matches("D:/Media/#Съёмка2/a.mp4",rules),false);
  assert.equal(Ignore.matches("D:/Media/a.wav.bak",rules),false);assert.equal(Ignore.matches("d:/MEDIA/A.WAV",rules),true);
  assert.equal(Ignore.matches("/Media/a.wav",[{kind:"folder",path:"/media"}]),false);
  assert.throws(()=>Ignore.rule({kind:"file",path:"relative.mp4"}),/absolute/);
});
test("ignored tombstones are excluded from rename matching while original records stay intact",()=>{
  const values={a:{files:[{path:"D:/Media/hidden/a.wav",itemId:"clip"}],dirs:[{rel:"hidden",binId:"bin"}]}};
  const filtered=Ignore.records(values,[{id:"a",folderPath:"D:/Media"}],"D:/P.prproj",[{kind:"folder",path:"D:/Media/hidden"}]);
  assert.deepEqual(filtered.a,{files:[],dirs:[]});assert.equal(values.a.files.length,1);
});
test("scanner prunes ignored files and folders before stat, descent and TXT parsing",async()=>{
  const reads=[],root="D:/Media",io={lstat:async p=>{reads.push(p);if(p.includes("hidden")||p.endsWith("bad.mp4"))throw Error("Ignored path was accessed");return {ino:p===root?1:2,dev:1,birthtimeMs:1,size:10,mtimeMs:1000,isFile:()=>p!==root,isDirectory:()=>p===root,isSymbolicLink:()=>false};},readdir:async()=>["hidden","bad.mp4","safe.wav"]};
  const filename=path.resolve("plugin/host/filesystem.js"),mod={exports:{}};
  vm.runInThisContext("(function(require,module,exports){"+fs.readFileSync(filename,"utf8")+"\n})",{filename})(id=>id==="./io"?io:require(path.resolve("plugin/host",id)),mod,mod.exports);
  const scanner=new mod.exports.Scanner(),rules=[{kind:"folder",path:root+"/hidden"},{kind:"file",path:root+"/bad.mp4"}];
  const scan=await scanner.scan({folderPath:root,subfolders:true},"D:/P.prproj",null,rules);assert.equal(scan.error,undefined);assert.deepEqual(scan.files.map(f=>f.path),[root+"/safe.wav"]);assert.deepEqual(reads,[root,root+"/safe.wav"]);
});
