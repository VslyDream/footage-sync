"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
function setup(){
 const file={path:"D:/Media/Apple banana.mp4"},txt={path:"D:/Media/apple.txt",signature:"[[53,1]]",markers:[{line:1,seconds:53,color:1}]};let ledger={version:1,imports:[]};
 const input={inventory:{clips:[],handles:new Map([["clip",{}]])},scans:{link:{files:[file],txts:[txt]}},plan:{changes:[{kind:"new-file",path:file.path}]},data:{settings:{autoMarkers:true},markerSources:{},markerObserved:{}},scanner:{txt:async p=>({...txt,path:p,signature:"manual"})}};
 const filename=path.resolve("plugin/host/marker-service.js"),mod={exports:{}};
 vm.runInThisContext("(function(require,module,exports){"+fs.readFileSync(filename,"utf8")+"\n})",{filename})(id=>id==="./marker-state"?{read:async()=>({ledger}),timing:async()=>({start:3600,duration:300})}:id==="./markers"?{read:async()=>[]}:id==="./marker-import"?{stamp:JSON.stringify,apply:async()=>{}}:require(path.resolve("plugin/host",id)),mod,mod.exports);
 return {input,txt,file,analyze:()=>mod.exports.analyze(input),existing:()=>input.inventory.clips.push({id:"clip",mediaPath:file.path}),setLedger:l=>ledger=l};
}
test("new MP4 receives a safe marker change after its import; TXT errors are warnings",async()=>{
 const x=setup();let r=await x.analyze();assert.equal(r.changes[0].kind,"clip-markers");assert.equal(r.changes[0].blocking,false);x.txt.error="Line 1: Invalid color";r=await x.analyze();assert.equal(r.changes.length,0);assert.match(r.warnings[0].message,/Line 1/);assert.equal(x.input.plan.changes.length,1);
});
test("multiple substring matches skip automatic markers until manual choice",async()=>{
 const x=setup();x.input.scans.link.txts.push({...x.txt,path:"D:/Media/banana.txt"});const r=await x.analyze();assert.equal(r.changes.length,0);assert.match(r.warnings[0].message,/Multiple/);
});
test("manual source has priority and works with automatic discovery off",async()=>{
 const x=setup();x.existing();x.input.data.settings.autoMarkers=false;x.input.data.markerSources.clip={path:"D:/Elsewhere/manual.txt",revision:1};const r=await x.analyze();assert.equal(r.changes[0].source.signature,"manual");assert.equal(r.changes[0].source.revision,1);
});
test("unchanged completed TXT is skipped despite manual marker edits; changed or manually selected TXT needs review",async()=>{
 const x=setup();x.existing();x.setLedger({version:1,imports:[{sourceKey:"d:/media/apple.txt",signature:x.txt.signature,revision:0}]});assert.equal((await x.analyze()).changes.length,0);
 x.txt.signature="changed";assert.equal((await x.analyze()).changes[0].kind,"marker-choice");x.input.data.markerSources.clip={path:x.txt.path,revision:2};assert.equal((await x.analyze()).changes[0].kind,"marker-choice");
});
test("returning to a historically imported TXT still needs review after a different last version",async()=>{
 const x=setup();x.existing();x.setLedger({version:1,imports:[{sourceKey:"d:/media/apple.txt",signature:x.txt.signature,revision:0},{sourceKey:"d:/media/apple.txt",signature:"different",revision:0}]});assert.equal((await x.analyze()).changes[0].kind,"marker-choice");
});
test("undo or unsaved reopen without a project receipt requires review instead of automatic duplication",async()=>{
 const x=setup();x.existing();x.input.data.markerObserved.clip={version:1,imports:[{}]};assert.equal((await x.analyze()).changes[0].blocking,true);
});
test("range validation skips the entire TXT with its original line number",async()=>{
 const x=setup();x.existing();x.txt.markers.push({line:4,seconds:300,color:1});const r=await x.analyze();assert.equal(r.changes.length,0);assert.match(r.warnings[0].message,/Line 4.*outside/);
});
test("blocking media reconciliation cannot acquire clip markers prematurely",async()=>{
 const x=setup();x.input.plan.changes[0].blocking=true;assert.equal((await x.analyze()).changes.length,0);
});
