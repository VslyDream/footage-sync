"use strict";
const fs=require("fs"), P=require("../core/paths");
const defaults=()=>({version:1,links:[],settings:{mode:"ASK",mp4:"ASK",warnings:true,success:false,autoMarkers:true},records:{},markerSources:{},markerObserved:{},history:[]});
async function load(projectPath) {
  const path=P.clean(projectPath)+".footage-sync.json";
  try { await fs.lstat(path); } catch(e) { if(e.code==="ENOENT" || /no such|not found/i.test(e.message)) return defaults(); throw e; }
  const value=JSON.parse(await fs.readFile(path,{encoding:"utf-8"}));
  if(value.version!==1 || !Array.isArray(value.links) || !value.settings || !value.records) throw new Error("Footage Sync settings are invalid. The existing file was preserved.");
  return {...defaults(),...value,settings:{...defaults().settings,...value.settings}};
}
async function save(projectPath,value) {
  const path=P.clean(projectPath)+".footage-sync.json", temp=path+".tmp";
  await fs.writeFile(temp,JSON.stringify(value,null,2),{encoding:"utf-8"});
  await fs.rename(temp,path);
}
async function diagnostic(value) { try { await fs.writeFile("plugin-data:/diagnostics.json",JSON.stringify(value,null,2),{encoding:"utf-8"}); } catch(e) { console.error(e); } }
module.exports={defaults,load,save,diagnostic};
