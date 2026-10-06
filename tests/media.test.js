"use strict";
const test=require("node:test"), assert=require("node:assert/strict"), fs=require("node:fs/promises"), path=require("node:path"), os=require("node:os");
const {Scanner,boxHeader,identity}=require("../plugin/host/filesystem");
test("container headers handle normal, extended and truncated boxes",()=>{
  const bytes=new Uint8Array(16),v=new DataView(bytes.buffer);v.setUint32(0,16);bytes.set([109,100,97,116],4);
  assert.equal(boxHeader(bytes,0,16).type,"mdat");v.setUint32(0,1);v.setUint32(12,32);assert.equal(boxHeader(bytes,0,32).header,16);assert.throws(()=>boxHeader(bytes,0,20));
});
test("unsafe or missing inode cannot authorize relink",()=>{
  assert.equal(identity({ino:0,dev:1}),null);assert.equal(identity({ino:Number.MAX_SAFE_INTEGER+1,dev:1}),null);assert.equal(identity({ino:123}),null);
});
test("scanner respects Subfolders Off, ignores sidecars, and reports unavailable roots",async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),"footage-sync-test-"));
  try { await fs.mkdir(path.join(dir,"nested"));await fs.writeFile(path.join(dir,"a.wav"),"test");await fs.writeFile(path.join(dir,"config.json"),"{}");await fs.writeFile(path.join(dir,"nested","b.wav"),"test");await fs.utimes(path.join(dir,"a.wav"),new Date(1000),new Date(1000));await fs.utimes(path.join(dir,"nested","b.wav"),new Date(1000),new Date(1000));
    const s=new Scanner(), flat=await s.scan({folderPath:dir,subfolders:false},path.join(dir,"p.prproj")), deep=await s.scan({folderPath:dir,subfolders:true},path.join(dir,"p.prproj"));assert.equal(flat.files.length,1);assert.equal(deep.files.length,2);assert.equal(deep.dirs.length,2);assert.equal(flat.files[0].issue,null);assert.ok((await s.scan({folderPath:path.join(dir,"absent"),subfolders:true},"p.prproj")).error);
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});
test("TXT scan is separate from media and invalid, growing and corrected files are retried",async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),"footage-markers-")),file=path.join(dir,"a.txt"),s=new Scanner();
  try{
    await fs.writeFile(file,"0:00:01,1\n0:00:02,8");await fs.utimes(file,new Date(1000),new Date(1000));
    const scan=await s.scan({folderPath:dir,subfolders:true},path.join(dir,"p.prproj"));assert.equal(scan.files.length,0);assert.equal(scan.txts.length,1);assert.match(scan.txts[0].error,/Line 2/);assert.equal(scan.txts[0].markers.length,0);
    await fs.writeFile(file,"0:00:01,1");assert.match((await s.txt(file)).error,/still being written/);await fs.utimes(file,new Date(2000),new Date(2000));assert.equal((await s.txt(file)).markers.length,1);
    assert.ok((await s.txt(path.join(dir,"absent.txt"))).error);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
