"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const {fileURL,createIO}=require("../plugin/host/io");
function scanner(io){
  const mod={exports:{}},filename=path.resolve("plugin/host/filesystem.js");
  vm.runInThisContext("(function(require,module,exports){"+fs.readFileSync(filename,"utf8")+"\n})",{filename})(id=>id==="./io"?io:require(path.resolve("plugin/host",id)),mod,mod.exports);return new mod.exports.Scanner();
}
const stat=(dir,ino)=>({ino,dev:1,birthtimeMs:1,size:16,mtimeMs:1000,isFile:()=>!dir,isDirectory:()=>dir,isSymbolicLink:()=>false});
test("only a settled, successfully read blank marker TXT carries the empty classification",async()=>{
  const io={lstat:async()=>stat(false,1),readFile:async()=>"\uFEFF\r\n  "};
  const read=()=>scanner(io).txt("D:/Media/clip.txt");
  const blank=await read();
  assert.equal(blank.empty,true);
  assert.ok(blank.stamp);
  io.readFile=async()=>"invalid";
  assert.equal((await read()).empty,false);
  io.readFile=async()=>{throw Error("Read failed");};
  assert.equal((await read()).empty,undefined);
});
test("UXP IO encodes literal special characters once at the filesystem boundary",async()=>{
  const seen=[],io=createIO({lstat:async p=>seen.push(p),rename:async(a,b)=>seen.push(a,b)},true);
  await io.lstat("D:/Media/#5 100%23 ?.wav");await io.rename("D:/Media/#a","D:/Media/%23a");
  assert.deepEqual(seen,["file:/D:/Media/%235%20100%2523%20%3F.wav","file:/D:/Media/%23a","file:/D:/Media/%2523a"]);
  assert.equal(fileURL("\\\\server\\share\\#тест"),"file://server/share/%23%D1%82%D0%B5%D1%81%D1%82");
  assert.equal(fileURL("/Volumes/Media/#5.wav"),"file:/Volumes/Media/%235.wav");assert.equal(fileURL("plugin-data:/diagnostics.json"),"plugin-data:/diagnostics.json");
});
test("URL-parsing UXP regression scans hash files and folders without recursive aliases",async()=>{
  const root="D:/Media",tree=new Map([[root,stat(true,1)],[root+"/#5.wav",stat(false,2)],[root+"/#folder",stat(true,3)],[root+"/#folder/100%23.wav",stat(false,4)]]),reads=[];
  const raw={lstat:async url=>{const native=decodeURIComponent(url.replace(/^file:\//,""));if(!tree.has(native))throw new Error("Wrong file path: "+native);return tree.get(native);},readdir:async url=>{reads.push(url);return url.endsWith("%23folder")?["100%23.wav"]:["#5.wav","#folder"];}};
  const result=await scanner(createIO(raw,true)).scan({folderPath:root,subfolders:true},"D:/P.prproj");
  assert.equal(result.error,undefined);assert.equal(result.dirs.length,2);assert.deepEqual(result.files.map(f=>f.path),[root+"/#5.wav",root+"/#folder/100%23.wav"]);assert.equal(reads.length,2);
});
test("ancestor identity alias stops a bad scan without returning a partial sync snapshot",async()=>{
  let reads=0;const io={lstat:async()=>stat(true,1),readdir:async()=>{reads++;return ["#5.mp4"];}};
  const result=await scanner(io).scan({folderPath:"D:/Media",subfolders:true},"D:/P.prproj");
  assert.match(result.error,/ancestor folder again/);assert.match(result.error,/#5.mp4/);assert.equal(reads,1);assert.deepEqual(result.files,[]);assert.deepEqual(result.dirs,[]);
});
test("unknown folder identities still have a bounded recursion depth",async()=>{
  let reads=0;const io={lstat:async()=>stat(true,0),readdir:async()=>{reads++;return ["loop"];}};
  const result=await scanner(io).scan({folderPath:"D:/Media",subfolders:true},"D:/P.prproj");
  assert.match(result.error,/safe nesting depth/);assert.equal(reads,256);assert.deepEqual(result.dirs,[]);
});
