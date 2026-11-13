"use strict";
const fs=require("./io"),P=require("../core/paths"),{identity}=require("./filesystem");
const MEDIA=/\.(mp4|mov|m4v|mxf|avi|mkv|webm|mts|m2ts|wav|mp3|aac|m4a|aif|aiff|flac|ogg|png|jpg|jpeg|tif|tiff|psd|exr|bmp)$/i;
// Metadata only, on demand. No file payload reads, watcher or extra process.
async function folderSummary(root,{cancelled=()=>false,onUpdate=()=>{}}={}){
  const nodes=[],ancestors=new Set();let visited=0,last=0;
  async function walk(path,depth,parent,stat=null,node=null){
    if(cancelled())return null;if(depth>=256||++visited>100000)throw new Error("Folder summary reached the safe scan limit.");
    const st=stat||await fs.lstat(path);if(cancelled()||st.isSymbolicLink?.()||!st.isDirectory())return null;
    const id=identity(st);if(id&&ancestors.has(id))throw new Error("The filesystem returned an ancestor folder again.");if(id)ancestors.add(id);
    if(!node){node={path,parent,depth,files:0,size:0,complete:false};nodes.push(node);onUpdate(nodes);}
    const children=[];
    try{for(const name of await fs.readdir(path)){
      if(cancelled())return null;if(!name||name==="."||name===".."||/[\\/]/.test(name))throw new Error("Invalid directory entry.");
      const child=P.join(path,name),stat=await fs.lstat(child);if(cancelled())return null;if(stat.isSymbolicLink?.())continue;
      if(stat.isDirectory()){const next={path:child,parent:path,depth:depth+1,files:0,size:0,complete:false};nodes.push(next);children.push({path:child,stat,node:next});}
      else if(stat.isFile()&&MEDIA.test(name)){node.files++;node.size+=Number(stat.size);}
      if(Date.now()-last>60){last=Date.now();onUpdate(nodes);await new Promise(r=>setTimeout(r,0));}
    }onUpdate(nodes);for(const child of children){if(cancelled())return null;const result=await walk(child.path,depth+1,path,child.stat,child.node);if(result){node.files+=result.files;node.size+=result.size;}}node.complete=true;onUpdate(nodes);return node;}finally{if(id)ancestors.delete(id);}
  }
  await walk(P.clean(root),0,null);return nodes;
}
module.exports={folderSummary};
