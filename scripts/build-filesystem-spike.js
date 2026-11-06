"use strict";
// Read-only host probe: examines only generated fixtures, never project media.
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),target=path.join(root,"artifacts/filesystem-spike"),fixtures=path.join(root,"artifacts/filesystem-host-test");
fs.mkdirSync(target,{recursive:true});fs.mkdirSync(fixtures,{recursive:true});
fs.cpSync(path.join(root,"plugin"),path.join(target,"runtime"),{recursive:true});
for(const name of ["#5.mp4","100%25 #тест.wav","plain.wav"])fs.writeFileSync(path.join(fixtures,name),"filesystem probe");
fs.mkdirSync(path.join(fixtures,"#folder"),{recursive:true});
fs.writeFileSync(path.join(fixtures,"#folder","child.wav"),"nested probe");
const manifest={manifestVersion:5,id:"com.vsly.footage-sync.filesystem-spike",name:"Footage Sync Filesystem Probe",version:"0.1.0",main:"index.html",host:{app:"premierepro",minVersion:"25.6.0"},entrypoints:[{type:"panel",id:"filesystemProbe",label:{default:"Footage Sync Filesystem Probe"}}],requiredPermissions:{localFileSystem:"fullAccess"}};
fs.writeFileSync(path.join(target,"manifest.json"),JSON.stringify(manifest,null,2));
fs.writeFileSync(path.join(target,"index.html"),'<!doctype html><html><head><link rel="stylesheet" href="runtime/style.css"></head><body><p id="result">Read-only filesystem probe</p><script src="index.js"></script></body></html>');
fs.writeFileSync(path.join(target,"index.js"),`"use strict";
const fs=require("fs"),uxp=require("uxp"),ppro=require("premierepro");
const fixtures=${JSON.stringify(fixtures.replace(/\\/g,"/"))},output=fixtures+"/probe-result.json";
let started=false;
async function run(){
 if(started)return;started=true;
 const result={versions:uxp.versions,paths:[],projects:[]};
 for(const name of ["","#5.mp4","100%25 #тест.wav","plain.wav","#folder"]){
  const native=fixtures+(name?"/"+name:"");
  for(const [kind,input] of [["raw",native],["backslashes",native.replace(/\\//g,"\\\\")],["file-raw","file:/"+native],["file-encoded","file:/"+native.split("/").map((s,i)=>i===0?s:encodeURIComponent(s)).join("/")]]){
   const row={name,kind,input};try{const s=await fs.lstat(input);Object.assign(row,{isFile:s.isFile(),isDirectory:s.isDirectory(),ino:s.ino,dev:s.dev,size:s.size});if(s.isDirectory())row.entries=await fs.readdir(input);}catch(e){row.error=e.message;}result.paths.push(row);
  }
 }
 try{result.projectUtils={getProjectViewIds:typeof ppro.ProjectUtils?.getProjectViewIds,getProjectFromViewId:typeof ppro.ProjectUtils?.getProjectFromViewId};for(const id of await ppro.ProjectUtils.getProjectViewIds()){const p=await ppro.ProjectUtils.getProjectFromViewId(id);result.projects.push({name:p.name,path:p.path,guid:String(p.guid)});}}catch(e){result.projectError=e.message;}
 try{result.fixedScan=await new (require("./runtime/host/filesystem").Scanner)().scan({folderPath:fixtures,subfolders:true},fixtures+"/Probe.prproj");}catch(e){result.scanError=e.message;}
 await fs.writeFile(output,JSON.stringify(result,null,2),{encoding:"utf-8"});document.querySelector("#result").textContent="Probe complete. Results: "+output;
}
uxp.entrypoints.setup({plugin:{create(){run().catch(console.error);}},panels:{filesystemProbe:{create(){run().catch(console.error);},show(){run().catch(console.error);}}}});
document.addEventListener("DOMContentLoaded",()=>run().catch(console.error));
document.addEventListener("DOMContentLoaded",()=>{
 const c={data:{links:[],history:[]},path:fixtures+"/Probe.prproj",onChange(){},emit(){},context:async()=>({name:"Filesystem Probe",path:fixtures+"/Probe.prproj",guid:"probe"}),project:{getRootItem:async()=>({getItems:async()=>[]})}};
 const ui=new (require("./runtime/ui").UI)(c);ui.initial=async drafts=>{await fs.writeFile(fixtures+"/browse-result.json",JSON.stringify(drafts),{encoding:"utf-8"});};
 const b=document.createElement("button");b.textContent="Test Browse (fixture only)";b.onclick=()=>ui.existing().catch(console.error);document.body.appendChild(b);
});
`);
console.log("Prepared read-only filesystem probe and local fixtures.");
