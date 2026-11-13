"use strict";
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
function element(attrs=""){
 const children=new Map(),handlers={};let html="";return {style:{},scrollTop:0,offsetHeight:150,className:"",disabled:/\bdisabled\b/.test(attrs),checked:/\bchecked\b/.test(attrs),value:/\bvalue="([^"]*)"/.exec(attrs)?.[1]||"",textContent:"",
 set innerHTML(value){html=value;children.clear();for(const m of value.matchAll(/<[\w-]+\b([^>]*\bid="([^"]+)"[^>]*)>/g))children.set(m[2],element(m[1]));},get innerHTML(){return html;},
 querySelector(selector){const id=selector.slice(1);if(children.has(id))return children.get(id);for(const child of children.values()){const found=child.querySelector(selector);if(found)return found;}return null;},
 setAttribute(){},getAttribute(name){return new RegExp('\\b'+name+'="([^"]*)"').exec(attrs)?.[1];},addEventListener(event,fn){handlers[event]=fn;},async click(){if(!this.disabled)await handlers.click?.();},async change(){await handlers.change?.({target:this});},async input(){await handlers.input?.({target:this});}
 };
}
function setup({picked={nativePath:"D:/Media/interview.txt"},folder={nativePath:"D:/Chosen"}}={}){
 const log=[],project={name:"Footage",path:"D:/Footage.prproj",guid:"project"},entry={path:"D:/Media/interview.mp4",itemId:"clip",projectPath:project.path,projectId:project.guid};
 const c={busy:false,path:project.path,project,workspace:{importProject:project},data:{links:[],history:[],ignored:[],settings:{mode:"ASK",mp4:"ASK"},records:{}},batch:{changes:[],warnings:[],media:[entry],reused:[],links:[],scans:{},projectPath:project.path,projectId:project.guid},onChange(fn){this.notify=fn;},emit(){this.notify?.();},async context(){return project;},async persist(){log.push("persist");},async scan(){log.push("scan");return this.batch;},async assertContext(){},async chooseMarkers(...args){log.push({selection:args});},async apply(...args){log.push({apply:args});},async setIgnored(rule,remove){log.push({rule,remove});this.data.ignored=remove?this.data.ignored.filter(r=>r.path!==rule.path):[...this.data.ignored,rule];}};
 const host={inventory:async()=>({bins:[],clips:[]})},mod={exports:{}};let modalDepth=0;
 vm.runInThisContext("(function(require,module,exports){"+fs.readFileSync("plugin/ui.js","utf8")+"\n})",{filename:path.resolve("plugin/ui.js")})(id=>id==="uxp"?{storage:{localFileSystem:{async getFolder(){if(modalDepth)throw Error("Picker was opened under a modal");log.push("folder-picker");if(folder instanceof Error)throw folder;return folder;},async getFileForOpening(){log.push("picker");return picked;}}}}:id==="./host/premiere"?host:require(id.startsWith(".")?path.resolve("plugin",id):id),mod,mod.exports);
 const ui=new mod.exports.UI(c);ui.modal=async(title,html,bind)=>{log.push(title);const d=element();d.innerHTML=html;d.close=value=>d.result=value;modalDepth++;try{bind?.(d);await ui.interact?.(title,d);return d.result||"cancel";}finally{modalDepth--;}};
 return {ui,c,entry,host,log,element};
}
module.exports={setup,element};
