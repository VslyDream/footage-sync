"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs/promises"),path=require("node:path"),os=require("node:os"),vm=require("node:vm");

// Adapt Node FileHandles to the documented UXP fs positional ArrayBuffer API.
function scannerAPI(noIdentity=false){
  const inodes=new Map();
  const uxpFs={...fs,
    lstat:async file=>{
      const st=await fs.lstat(file),raw=(await fs.lstat(file,{bigint:true})).ino.toString();
      // Node's Windows inode can exceed Number precision. Represent distinct
      // real inodes as safe values to exercise UXP's validated identity branch.
      if(!inodes.has(raw))inodes.set(raw,inodes.size+1);
      Object.defineProperty(st,"ino",{value:noIdentity?0:inodes.get(raw)});return st;
    },
    read:async(fd,buffer,offset,length,position)=>{const r=await fd.read(Buffer.from(buffer),offset,length,position);return {bytesRead:r.bytesRead,buffer};},
    close:fd=>fd.close()
  };
  const filename=path.resolve("plugin/host/filesystem.js"),mod={exports:{}};
  vm.runInThisContext("(function(require,module,exports){"+require("node:fs").readFileSync(filename,"utf8")+"\n})",{filename})(id=>id==="fs"?uxpFs:require(path.resolve("plugin/host",id)),mod,mod.exports);
  return mod.exports;
}
function box(type,payload=Buffer.alloc(0)){const header=Buffer.alloc(8);header.writeUInt32BE(8+payload.length);header.write(type,4,"ascii");return Buffer.concat([header,payload]);}
const ordinary=()=>Buffer.concat([box("ftyp"),box("moov",box("free"))]);
const fragmented=()=>Buffer.concat([box("ftyp"),box("moov",box("mvex"))]);

test("MP4 detection reads moov/mvex and moof, rejects truncated media and preserves bytes",async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),"footage-container-")),api=scannerAPI();
  try{
    for(const [name,bytes,expected] of [["ordinary",ordinary(),false],["mvex",fragmented(),true],["moof",Buffer.concat([box("ftyp"),box("moov"),box("moof")]),true]]){
      const file=path.join(dir,name+".mp4");await fs.writeFile(file,bytes);
      assert.equal(await api.fragmented(file,bytes.length),expected);assert.deepEqual(await fs.readFile(file),bytes);
    }
    const truncated=path.join(dir,"truncated.mp4"),bytes=fragmented().subarray(0,20);await fs.writeFile(truncated,bytes);
    await assert.rejects(()=>api.fragmented(truncated,bytes.length),/Incomplete or invalid/);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test("a replacement MP4 with equal size and timestamp invalidates the cached container decision",async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),"footage-replacement-")),file=path.join(dir,"clip.mp4"),replacement=path.join(dir,"replacement.bin"),s=new (scannerAPI().Scanner)();
  const scan=()=>s.scan({folderPath:dir,subfolders:false},path.join(dir,"Footage.prproj"));
  try{
    await fs.writeFile(file,ordinary());await fs.utimes(file,new Date(1000),new Date(1000));const first=(await scan()).files[0];
    assert.equal(first.fragmented,false);assert.equal(first.issue,null);
    await fs.writeFile(replacement,fragmented());await fs.utimes(replacement,new Date(1000),new Date(1000));
    await fs.unlink(file);await fs.rename(replacement,file);const second=(await scan()).files[0];
    assert.equal(first.size,second.size);assert.equal(first.mtime,second.mtime);assert.notEqual(first.identity,second.identity);
    assert.equal(second.fragmented,true);assert.deepEqual(await fs.readFile(file),fragmented());
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test("without reliable identity MP4 classification is reread instead of reused",async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),"footage-no-identity-")),file=path.join(dir,"clip.mp4"),s=new (scannerAPI(true).Scanner)();
  const scan=()=>s.scan({folderPath:dir,subfolders:false},path.join(dir,"Footage.prproj"));
  try{
    await fs.writeFile(file,ordinary());await fs.utimes(file,new Date(1000),new Date(1000));assert.equal((await scan()).files[0].fragmented,false);
    await fs.writeFile(file,fragmented());await fs.utimes(file,new Date(1000),new Date(1000));const next=(await scan()).files[0];
    assert.equal(next.identity,null);assert.equal(next.fragmented,true);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
