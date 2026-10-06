"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"../plugin"); let count=0;
function walk(dir) { for(const name of fs.readdirSync(dir)) { const file=path.join(dir,name); if(fs.statSync(file).isDirectory()) walk(file); else if(name.endsWith(".js")) { new vm.Script(fs.readFileSync(file,"utf8"),{filename:file}); count++; } } }
walk(root);
const manifest=JSON.parse(fs.readFileSync(path.join(root,"manifest.json"),"utf8"));
if(manifest.id!=="com.vsly.footage-sync"||manifest.host.minVersion!=="25.6.0"||!fs.existsSync(path.join(root,manifest.main))) throw new Error("Invalid plugin manifest.");
console.log(`${count} JavaScript files and UXP manifest validated.`);
