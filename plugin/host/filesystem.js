"use strict";
const fsModule=require("fs"), fs=fsModule.promises||fsModule, P=require("../core/paths"), {parseMarkers,signature}=require("../core/markers");
const MEDIA=/\.(mp4|mov|m4v|mxf|avi|mkv|webm|mts|m2ts|wav|mp3|aac|m4a|aif|aiff|flac|ogg|png|jpg|jpeg|tif|tiff|psd|exr|bmp)$/i;
const yieldUI=()=>new Promise(r=>setTimeout(r,0));
function identity(stat) {
  // Never use filename/size as proof of identity. Unsupported/unsafe inode values disable matching.
  const ino=Number(stat.ino); if(!Number.isSafeInteger(ino)||ino<=0 || stat.dev===undefined) return null;
  return String(stat.dev)+":"+String(ino)+":"+String(Number(stat.birthtimeMs || new Date(stat.birthtime).getTime()) || 0);
}
async function readAt(fd,pos,length) {
  const data=new ArrayBuffer(length); const r=await fs.read(fd,data,0,length,pos);
  return new Uint8Array(r.buffer||data,0,r.bytesRead);
}
function boxHeader(bytes,offset,end) {
  if(bytes.length<8) throw new Error("Incomplete MP4 box header.");
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength); let length=v.getUint32(0), header=8;
  if(length===1) { if(bytes.length<16) throw new Error("Incomplete extended MP4 header."); length=v.getUint32(8)*4294967296+v.getUint32(12); header=16; }
  if(length===0) length=end-offset;
  if(!Number.isSafeInteger(length)||length<header||offset+length>end) throw new Error("Incomplete or invalid MP4 container.");
  return {length,header,type:String.fromCharCode(...bytes.slice(4,8))};
}
async function fragmented(path,size) {
  const fd=await fs.open(path,"r");
  try {
    let pos=0, count=0, moov=false;
    while(pos<size && count++<10000) {
      const box=boxHeader(await readAt(fd,pos,Math.min(16,size-pos)),pos,size);
      if(box.type==="moof") return true;
      if(box.type==="moov") {
        moov=true; let child=pos+box.header;
        while(child<pos+box.length && count++<10000) {
          const sub=boxHeader(await readAt(fd,child,Math.min(16,pos+box.length-child)),child,pos+box.length);
          if(sub.type==="mvex") return true; child+=sub.length;
        }
      }
      pos+=box.length;
    }
    if(count>=10000) throw new Error("MP4 box scan limit reached.");
    if(!moov) throw new Error("MP4 has no complete movie header yet.");
    return false;
  } finally { await fs.close(fd); }
}
class Scanner {
  constructor() { this.cache=new Map(); }
  async validate(file) {
    const st=await fs.lstat(file.path), mtime=Number(st.mtimeMs || new Date(st.mtime).getTime());
    if(!st.isFile() || Number(st.size)!==file.size || mtime!==file.mtime || (file.identity && identity(st)!==file.identity)) throw new Error("Source changed after analysis. Scan again.");
  }
  async txt(path) {
    try {
      const st=await fs.lstat(path), size=Number(st.size),mtime=Number(st.mtimeMs||new Date(st.mtime).getTime());
      const source={path:P.clean(path),size,mtime,identity:identity(st)};
      if(!st.isFile()||st.isSymbolicLink?.())throw new Error("Marker source is not a regular TXT file.");
      if(size>1024*1024)throw new Error("Marker TXT exceeds the 1 MB read limit.");
      if(Date.now()-mtime<2000)return {...source,error:"Marker TXT is still being written. Wait for the next scan."};
      const stamp=size+":"+mtime+":"+source.identity,key="txt:"+P.key(path);let cached=this.cache.get(key);
      if(!cached||cached.stamp!==stamp) {
        const parsed=parseMarkers(await fs.readFile(path,{encoding:"utf-8"}));
        cached={stamp,markers:parsed.markers,signature:signature(parsed.markers),error:parsed.errors.map(e=>(e.line?"Line "+e.line+": ":"")+e.message).join(" ")};
        await this.validate(source);this.cache.set(key,cached);
      }
      return {...source,...cached};
    }catch(e){return {path:P.clean(path),error:e.message};}
  }
  async scan(link,projectPath) {
    const root=P.resolve(P.dirname(projectPath),link.folderPath), files=[], dirs=[], txts=[],started=Date.now();
    try {
      const rootStat=await fs.lstat(root); if(!rootStat.isDirectory()) throw new Error("Source is not a folder.");
      async function walk(scanner,path,rel,stat) {
        dirs.push({path,rel,identity:identity(stat)});
        const entries=await fs.readdir(path);
        for(const name of entries) {
          const child=P.join(path,name), childRel=P.join(rel,name), st=await fs.lstat(child);
          if(st.isSymbolicLink && st.isSymbolicLink()) continue;
          if(st.isDirectory()) { if(link.subfolders) await walk(scanner,child,childRel,st); }
          else if(st.isFile() && /\.txt$/i.test(name)) txts.push(await scanner.txt(child));
          else if(st.isFile() && MEDIA.test(name)) {
            const mtime=Number(st.mtimeMs || new Date(st.mtime).getTime()), size=Number(st.size), fileIdentity=identity(st), stamp=size+":"+mtime+":"+fileIdentity;
            let cached=scanner.cache.get(P.key(child));
            if(!cached || cached.stamp!==stamp) {
              cached={stamp,fragmented:false,issue:null};
              if(Date.now()-mtime<2000) cached.issue="Source is still being written. Wait for the next scan.";
              else if(/\.mp4$/i.test(name)) { try { cached.fragmented=await fragmented(child,size); } catch(e) { cached.issue=e.message; } }
              // A transient/growing file must be retried even if its size is unchanged.
              if(!cached.issue && fileIdentity) scanner.cache.set(P.key(child),cached);
            }
            files.push({path:child,rel:childRel,size,mtime,identity:fileIdentity,fragmented:cached.fragmented,issue:cached.issue});
          }
          if((files.length+dirs.length)%25===0) await yieldUI();
        }
      }
      await walk(this,root,"",rootStat);
      return {root,files,dirs,txts,duration:Date.now()-started};
    } catch(e) { return {root,files:[],dirs:[],txts:[],error:e.message,duration:Date.now()-started}; }
  }
}
module.exports={Scanner,identity,fragmented,boxHeader,MEDIA};
