"use strict";
// Isolated UXP rendering/picker probe. Fake Controller/H; no Premiere mutations,
// filesystem scan, persistence, background polling or clipboard access.
const fs=require("node:fs"),path=require("node:path"),{html}=require("./preview-ui");
const out=path.resolve("artifacts/ui-redesign/native-probe");fs.mkdirSync(out,{recursive:true});
for(const name of ["index.html","style.css","redesign.css"])fs.copyFileSync(path.resolve("plugin",name),path.join(out,name));
const manifest=JSON.parse(fs.readFileSync("plugin/manifest.json","utf8"));manifest.id="com.vsly.footage-sync.redesign-probe";manifest.name="Footage Sync Redesign Probe";manifest.entrypoints[0].id="redesignProbe";manifest.entrypoints[0].label.default=manifest.name;
fs.writeFileSync(path.join(out,"manifest.json"),JSON.stringify(manifest,null,2));
let script=html.slice(html.indexOf("const sources="),html.lastIndexOf("</script>"));script=script.slice(0,script.indexOf("document.querySelector('#preview-management')"));
script=script.replace("async getFolder(){return {nativePath:'D:/Media'}}","async getFolder(){return require('uxp').storage.localFileSystem.getFolder()}");
script+=`\nc.batch.changes=[{id:'0',kind:'fragmented',path:'D:/Media/Day 01/a.mp4',blocking:true},{id:'1',kind:'new-file',path:'D:/Media/Day 01/c.mp4',file:{size:120000}},{id:'2',kind:'append-footage',path:'D:/Media/Day 01/c.mp4',entry:{key:'c'}}];c.batch.hasBlocking=true;c.data.links[0].subfolders=true;\nfunction start(){if(!ui.mainPanel&&document.querySelector('#main-panel'))ui.start();}\nrequire('uxp').entrypoints.setup({plugin:{create:start,destroy(){ui.destroy()}},panels:{redesignProbe:{create:start,show:start}}});document.addEventListener('DOMContentLoaded',start);\n`;
fs.writeFileSync(path.join(out,"index.js"),script);
console.log("Built isolated redesign probe; fake Controller and host, no project mutations.");
