"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
function setup(){
  let values=[],ledger={version:1,imports:[]},locked=false,active,failColor=false,failMetadata=false;
  const history=[],project={path:"D:/Test/Markers.prproj",guid:"project",lockedAccess:fn=>{locked=true;try{fn();}finally{locked=false;}},executeTransaction:fn=>{const actions=[];fn({addAction:a=>actions.push(a)});history.push({values:values.map(m=>({...m})),ledger:structuredClone(ledger)});actions.forEach(a=>a());return true;}};active=project;
  const item={getProject:async()=>project,isSequence:async()=>false,isOffline:async()=>false};
  function marker(name,seconds,color=0){const m={name,seconds,color,comments:"",duration:0,type:"Comment"};
    m.getName=()=>m.name;m.getStart=()=>({seconds:m.seconds,ticks:String(m.seconds*254016000000)});m.getColorIndex=()=>m.color;m.getComments=()=>m.comments;m.getDuration=()=>({seconds:m.duration});m.getType=()=>m.type;
    m.createSetColorByIndexAction=c=>{assert.ok(locked);if(failColor)throw Error("color failure");return ()=>m.color=c;};m.createSetNameAction=n=>{assert.ok(locked);return ()=>m.name=n;};return m;}
  const collection={getMarkers:()=>values.slice(),createAddMarkerAction:(n,t,start)=>{assert.ok(locked);return ()=>values.push(marker(n,start.seconds));},createRemoveMarkerAction:m=>{assert.ok(locked);return ()=>{values=values.filter(v=>v!==m);};}};
  const State={read:async()=>({ledger:structuredClone(ledger)}),timing:async()=>({start:3600,duration:300}),prepare:async(_,next)=>()=>{assert.ok(locked);if(failMetadata)throw Error("metadata failure");return ()=>{ledger=structuredClone(next);};}};
  State.verify=async(_,expected)=>JSON.stringify(ledger)===JSON.stringify(expected);
  const ppro={ClipProjectItem:{cast:()=>item},Markers:{getMarkers:async()=>collection},Project:{getActiveProject:async()=>active},TickTime:{createWithSeconds:seconds=>({seconds})}};
  const filename=path.resolve("plugin/host/marker-import.js"),mod={exports:{}};
  const describe=m=>({seconds:m.seconds,ticks:m.getStart().ticks,color:m.color,name:m.name,comments:m.comments,duration:m.duration,type:m.type});
  vm.runInThisContext("(function(require,module,exports){"+fs.readFileSync(filename,"utf8")+"\n})",{filename})(id=>id==="premierepro"?ppro:id==="./marker-state"?State:id==="./markers"?{describe}:require(path.resolve("plugin/host",id)),mod,mod.exports);
  const source=(rows=[{seconds:53,color:1},{seconds:72,color:7}],revision=0)=>({path:"D:/Media/a.txt",signature:JSON.stringify(rows),markers:rows,revision});
  return {host:mod.exports,project,item,source,marker,get values(){return values;},get ledger(){return ledger;},undo:()=>{const old=history.pop();values=old.values;ledger=old.ledger;},failColor:v=>failColor=v,failMetadata:v=>failMetadata=v,switch:()=>active={...project,guid:"reopened"}};
}
test("project-owned import uses relative source seconds and repeat preserves manual edits",async()=>{
  const x=setup();await x.host.apply(x.project,x.item,x.source());assert.deepEqual(x.values.map(m=>[m.seconds,m.color,m.name]),[[53,1,""],[72,7,""]]);
  x.values[0].name="Manual";x.values[0].color=4;x.values.pop();assert.equal((await x.host.apply(x.project,x.item,x.source())).added,0);assert.equal(x.values[0].name,"Manual");
});
test("failed metadata action cannot stage markers without their project receipt",async()=>{
  const x=setup();x.failMetadata(true);await assert.rejects(()=>x.host.apply(x.project,x.item,x.source()),/metadata failure/);assert.equal(x.values.length,0);assert.equal(x.ledger.pending,undefined);
});
test("failed replacement preserves original markers and resumes without duplicates",async()=>{
  const x=setup(),manual=x.marker("Manual",9,4);x.values.push(manual);x.failColor(true);await assert.rejects(()=>x.host.apply(x.project,x.item,x.source(),"replace"),/color failure/);
  assert.equal(x.values[0],manual);assert.ok(x.ledger.pending);x.failColor(false);await x.host.apply(x.project,x.item,x.source(),"replace");assert.equal(x.values.length,2);assert.equal(x.ledger.pending,undefined);
});
test("undo finalization restores pending receipt; Undo reconciliation never guesses ownership of finalized markers",async()=>{
  const x=setup();await x.host.apply(x.project,x.item,x.source());x.undo();assert.ok(x.ledger.pending);assert.ok(x.values.every(m=>m.name.startsWith("Footage Sync pending")));x.undo();assert.equal(x.values.length,0);assert.ok(x.ledger.pending);x.undo();assert.deepEqual(x.ledger.imports,[]);assert.equal(x.ledger.pending,undefined);
});
test("skip interrupted TXT removes only unchanged temporary markers",async()=>{
  const x=setup(),manual=x.marker("Manual",9,4);x.values.push(manual);x.failColor(true);await assert.rejects(()=>x.host.apply(x.project,x.item,x.source()),/color failure/);x.failColor(false);
  await x.host.apply(x.project,x.item,x.source(),"skip");assert.equal(x.values.length,1);assert.equal(x.values[0],manual);assert.equal(x.ledger.imports[0].skipped,true);
});
test("manually edited pending marker cannot be removed by Skip",async()=>{
  const x=setup();x.failColor(true);await assert.rejects(()=>x.host.apply(x.project,x.item,x.source()));x.values[0].seconds=80;
  await x.host.apply(x.project,x.item,x.source(),"skip");assert.equal(x.values.length,2);assert.equal(x.values[0].seconds,80);assert.equal(x.ledger.pending,undefined);
});
test("review snapshot and same-path project reopen prevent any marker transaction",async()=>{
  const x=setup();await assert.rejects(()=>x.host.apply(x.project,x.item,x.source(),"append","outdated"),/changed after review/);x.switch();await assert.rejects(()=>x.host.apply(x.project,x.item,x.source()),/active project changed/);assert.equal(x.values.length,0);
});
test("out-of-duration row rejects all markers before staging",async()=>{
  const x=setup();await assert.rejects(()=>x.host.apply(x.project,x.item,x.source([{seconds:300,color:1}])));assert.equal(x.values.length,0);
});
