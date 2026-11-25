"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {redesign}=require("../plugin/workspace-ui");

function workspace(actions,selection){
  const draft={id:"draft",folderPath:"D:/Media",binPath:"Media"};
  const batch={changes:[{id:"file",kind:"new-file"},{id:"append",kind:"append-footage"}]};
  const controller={busy:false,path:"D:/Projects/Footage.prproj",data:{links:[],ignored:[]},scan:async()=>batch};
  const titles=[];
  let complete,applyStarted=false,flows=0;
  controller.apply=async()=>{
    applyStarted=true;
    controller.busy=true;
    await new Promise(resolve=>{complete=resolve;});
    controller.busy=false;
  };
  class Base {
    constructor(c){this.c=c;}
    async dialogFlow(run){flows++;try{return await run();}finally{flows--;}}
    async modal(title){
      titles.push(title);
      const action=actions.shift();
      if(action==="draft")return {draft};
      if(action==="apply")return {action,batch,selection};
      return action?{action}:null;
    }
  }
  const UI=redesign(Base,{H:{inventory:async()=>({bins:[]})}});
  const ui=new UI(controller);
  controller.context=async()=>({guid:"project"});
  return {ui,controller,titles,started:()=>applyStarted,flows:()=>flows,complete:()=>complete()};
}
const selection=(selected,options={})=>({selected,options,count:1,decisions:{}});

test("Changes Apply closes the management flow during an actual append and Status can reopen it",async()=>{
  const x=workspace(["apply"],selection(["file","append"]));
  await x.ui.openWindow();
  assert.ok(x.started());
  assert.ok(x.controller.busy);
  assert.deepEqual(x.titles,["Footage Sync"]);
  assert.equal(x.flows(),0);
  await x.ui.status();
  assert.deepEqual(x.titles,["Footage Sync","Footage Sync"]);
  x.complete();
});

test("New link with timeline appends exits both the preview and the parent Links flow",async()=>{
  const x=workspace(["add","draft","apply"],selection(["file","append"]));
  await x.ui.openWindow("links");
  assert.ok(x.started());
  assert.ok(x.controller.busy);
  assert.deepEqual(x.titles,["Footage Sync","Add link","New link"]);
  assert.equal(x.flows(),0);
  x.complete();
});

test("media-only Apply preserves the management window workflow",async()=>{
  const x=workspace(["apply"],selection(["file"],{filesOnly:true}));
  await x.ui.openWindow();
  assert.ok(x.controller.busy);
  assert.deepEqual(x.titles,["Footage Sync","Footage Sync"]);
  x.complete();
});

test("media-only New link waits for Apply before returning to Links",async()=>{
  const x=workspace(["add","draft","apply"],selection(["file"],{filesOnly:true}));
  const opened=x.ui.openWindow("links");
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(x.started());
  assert.deepEqual(x.titles,["Footage Sync","Add link","New link"]);
  x.complete();
  await opened;
  assert.deepEqual(x.titles,["Footage Sync","Add link","New link","Footage Sync"]);
});
