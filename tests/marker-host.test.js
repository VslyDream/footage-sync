"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
function setup({sequence=false,offline=false}={}) {
  const values=[],snapshots=[],project={path:"D:/Test/Markers.prproj",guid:"test-project"};let active=project,locked=false,failFinalize=false;
  function marker(name,seconds,color=0){const m={name,seconds,color,comments:"",duration:0,type:"Comment"};
    m.getName=()=>m.name;m.getStart=()=>({seconds:m.seconds,ticks:String(m.seconds*254016000000)});m.getColorIndex=()=>m.color;m.getComments=()=>m.comments;m.getDuration=()=>({seconds:m.duration});m.getType=()=>m.type;
    m.createSetColorByIndexAction=color=>{assert.ok(locked);if(failFinalize)throw new Error("injected color failure");return ()=>{m.color=color;};};m.createSetNameAction=name=>{assert.ok(locked);return ()=>{m.name=name;};};return m;}
  const item={isSequence:async()=>sequence,isOffline:async()=>offline};
  const markers={getMarkers:()=>values.slice(),createAddMarkerAction:(name,type,start,duration,comments)=>{assert.ok(locked);return ()=>values.push(marker(name,start.seconds));}};
  project.lockedAccess=fn=>{locked=true;try{fn();}finally{locked=false;}};project.executeTransaction=fn=>{const actions=[];fn({addAction:a=>actions.push(a)});actions.forEach(a=>a());return true;};
  const ppro={ClipProjectItem:{cast:x=>{assert.equal(x,item);return item;}},Markers:{getMarkers:async owner=>{assert.equal(owner,item);return markers;}},Project:{getActiveProject:async()=>active},TickTime:{createWithSeconds:seconds=>({seconds})}};
  const filename=path.resolve("plugin/host/markers.js"),mod={exports:{}};
  vm.runInThisContext("(function(require,module,exports){"+fs.readFileSync(filename,"utf8")+"\n})",{filename})(id=>id==="premierepro"?ppro:require(path.resolve("plugin/host",id)),mod,mod.exports);
  return {host:mod.exports,project,item,values,marker,snapshots,checkpoint:async receipts=>snapshots.push(JSON.parse(JSON.stringify(receipts))),switchProject:()=>{active={...project,guid:"reopened-project"};},fail:()=>{failFinalize=true;},recover:()=>{failFinalize=false;}};
}
test("adapter imports source markers with color and durable repeat protection",async()=>{
  const x=setup(),receipts=[],rows=[{seconds:53,color:1},{seconds:72,color:7}];
  assert.equal((await x.host.append(x.project,x.item,rows,receipts,x.checkpoint)).added,2);
  assert.deepEqual((await x.host.read(x.item)).map(m=>[m.seconds,m.color,m.name]),[[53,1,""],[72,7,""]]);
  await x.host.append(x.project,x.item,rows,receipts,x.checkpoint);assert.equal(x.values.length,2);assert.ok(x.snapshots[0][0].token);assert.ok(x.snapshots[0][0].complete===false);
});
test("repeat import preserves manual marker edits and deletions",async()=>{
  const x=setup(),receipts=[],rows=[{seconds:53,color:1},{seconds:72,color:7}];await x.host.append(x.project,x.item,rows,receipts,x.checkpoint);
  x.values[0].seconds=100;x.values[0].name="Manual";x.values[0].color=4;x.values.pop();await x.host.append(x.project,x.item,rows,receipts,x.checkpoint);
  assert.equal(x.values.length,1);assert.equal(x.values[0].seconds,100);assert.equal(x.values[0].name,"Manual");assert.equal(x.values[0].color,4);
});
test("sequence and offline clip targets are rejected before any marker action",async()=>{
  for(const options of [{sequence:true},{offline:true}]){const x=setup(options);await assert.rejects(()=>x.host.append(x.project,x.item,[{seconds:1,color:0}],[],x.checkpoint));assert.equal(x.values.length,0);}
});
test("bad source data never partially mutates markers",async()=>{
  const x=setup();await assert.rejects(()=>x.host.append(x.project,x.item,[{seconds:1,color:0},{seconds:2,color:8}],[],x.checkpoint),/Invalid/);assert.equal(x.values.length,0);
});
test("project reopened at the same path invalidates an import",async()=>{
  const x=setup();x.switchProject();await assert.rejects(()=>x.host.append(x.project,x.item,[{seconds:1,color:0}],[],x.checkpoint),/active project changed/);assert.equal(x.values.length,0);
});
test("failed color finalization resumes pending marker without duplication",async()=>{
  const x=setup(),receipts=[],rows=[{seconds:1,color:7}];x.fail();await assert.rejects(()=>x.host.append(x.project,x.item,rows,receipts,x.checkpoint),/injected/);
  assert.equal(x.values.length,1);assert.equal(receipts[0].complete,false);x.recover();await x.host.append(x.project,x.item,rows,receipts,x.checkpoint);assert.equal(x.values.length,1);assert.equal(x.values[0].color,7);assert.equal(x.values[0].name,"");
});
test("ambiguous interrupted import stops instead of guessing or duplicating",async()=>{
  const x=setup(),receipts=[{key:"1:7:0",seconds:1,color:7,token:"pending",created:true,complete:false}];
  await assert.rejects(()=>x.host.append(x.project,x.item,[{seconds:1,color:7}],receipts,x.checkpoint),/needs review/);assert.equal(x.values.length,0);
});
test("unrelated existing clip markers are preserved",async()=>{
  const x=setup(),original=x.marker("Manual",53,4);x.values.push(original);await x.host.append(x.project,x.item,[{seconds:53,color:1}],[],x.checkpoint);
  assert.equal(x.values[0],original);assert.equal(original.color,4);assert.equal(original.name,"Manual");assert.equal(x.values.length,2);
});
