"use strict";
const raw=require("fs"),P=require("../core/paths");
function fileURL(value) {
  // These inputs are literal native paths, never pre-encoded URLs. Encode '%' first
  // as part of each component, so a literal %23 cannot turn into a different file.
  const path=P.clean(value);
  if(/^(plugin|plugin-data|plugin-temp):/.test(path))return path;
  if(!P.isAbsolute(path))throw new Error("Filesystem access requires an absolute path.");
  const encoded=path.split("/").map((part,i)=>i===0&&/^[a-z]:$/i.test(part)?part:encodeURIComponent(part)).join("/");
  return "file:"+(/^[a-z]:/i.test(encoded)?"/":"")+encoded;
}
function createIO(module,useURLs=false) {
  const api=module.promises||module,input=path=>useURLs?fileURL(path):path;
  return {
    lstat:path=>api.lstat(input(path)),readdir:path=>api.readdir(input(path)),
    readFile:(path,...args)=>api.readFile(input(path),...args),
    writeFile:(path,...args)=>api.writeFile(input(path),...args),
    rename:(from,to)=>api.rename(input(from),input(to)),
    open:(path,...args)=>api.open(input(path),...args),
    read:(fd,buffer,offset,length,position)=>module.promises?fd.read(new Uint8Array(buffer),offset,length,position):api.read(fd,buffer,offset,length,position),
    close:fd=>module.promises?fd.close():api.close(fd)
  };
}
let useURLs=false;try{useURLs=Boolean(require("uxp").storage);}catch(_){} // Node test/preview environment.
module.exports={...createIO(raw,useURLs),createIO,fileURL};
