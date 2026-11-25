"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),{ChangesState,countChanges,summary}=require("../plugin/core/changes-view");
const batch=()=>({changes:[{id:"0",kind:"fragmented",path:"D:/a.mp4",blocking:true,file:{identity:"a",size:10,mtime:1}},{id:"1",kind:"new-file",path:"D:/b.mp4"},{id:"2",kind:"append-footage",path:"D:/a.mp4",entry:{key:"a"}},{id:"3",kind:"append-footage",path:"D:/b.mp4",entry:{key:"b"}}]});
test("editor counts fold timeline options into their new videos",()=>{assert.equal(countChanges(batch().changes),2);assert.deepEqual(summary(batch()),{count:2,needs:1,unavailable:0});});
test("undecided and skipped MP4 imports withhold their dependent append",()=>{const b=batch(),s=new ChangesState();assert.deepEqual(s.selection(b).selected,["1","3"]);s.decide(b.changes[0],"original");assert.deepEqual(s.selection(b).selected,["0","1","2","3"]);s.decide(b.changes[0],"defer");assert.deepEqual(s.selection(b).selected,["1","3"]);assert.equal(s.selection(b).waiting,0);});
test("decision and unchecked state survive planner ID reassignment but source replacement invalidates decisions",()=>{const b=batch(),s=new ChangesState();s.decide(b.changes[0],"original");s.check(b.changes[1],false);const changed={changes:b.changes.slice().reverse().map((c,i)=>({...c,id:String(i+8)}))};assert.equal(s.decision(changed.changes[3]),"original");assert.equal(s.selected(changed.changes[2],changed),false);changed.changes[3].file={identity:"new",size:10,mtime:1};assert.equal(s.decision(changed.changes[3]),undefined);});
test("per-file timeline opt-out persists a skip only when its source is imported",()=>{const b=batch(),s=new ChangesState();s.check(b.changes[3],false);assert.deepEqual(s.selection(b).options.skipSequenceKeys,["b"]);s.check(b.changes[1],false);assert.deepEqual(s.selection(b).options.skipSequenceKeys,[]);});
test("unavailable sources are link state and completed checkpoints need no new import",()=>{const b=batch(),s=new ChangesState();b.changes.push({id:"4",kind:"unavailable",blocking:true,path:"D:/offline"});b.changes[2].checkpoint=true;assert.equal(s.selected(b.changes[2],b),true);assert.equal(summary(b).needs,1);assert.equal(summary(b).unavailable,1);});
test('unchecking a required bin withholds its child media without discarding their choices',()=>{const b={changes:[{id:'0',kind:'new-folder',path:'Video/Day'},{id:'1',kind:'new-file',path:'D:/Media/a.mp4',target:'Video/Day'}]},s=new ChangesState();s.check(b.changes[0],false);assert.deepEqual(s.selection(b).selected,[]);s.check(b.changes[0],true);assert.deepEqual(s.selection(b).selected,['0','1']);});
test('Skip this time is cleared for the next explicit run',()=>{const b=batch(),s=new ChangesState();s.decide(b.changes[0],'defer');s.clearDeferred();assert.equal(s.decision(b.changes[0]),undefined);assert.equal(s.selection(b).waiting,1);});
test("deep new-bin selection visits each ancestor and preserves nested opt-outs",()=>{
  const state=new ChangesState(), bins=[];
  let target="Footage";
  for(let depth=1;depth<=32;depth++){
    target+="/Day"+depth;
    bins.push({id:String(depth),kind:"new-folder",path:target});
  }
  const file={id:"video",kind:"new-file",path:"D:/source.mp4",target};
  const batch={changes:[...bins,file]};
  assert.equal(state.selection(batch).count,33);
  state.check(bins[15],false);
  state.check(file,false);
  assert.equal(state.selection(batch).count,15);
  state.check(bins[15],true);
  assert.equal(state.selection(batch).count,32);
});
