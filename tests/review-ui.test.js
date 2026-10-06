"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
function setup(actions){
  const applied=[],batch={changes:[{id:"0",kind:"fragmented",path:"D:/a.mp4",blocking:true,message:"Decision needed"},{id:"1",kind:"new-file",path:"D:/b.wav",blocking:false}],media:[]};
  const c={onChange(){},async apply(...args){applied.push(args);}},filename=path.resolve("plugin/ui.js"),mod={exports:{}};
  vm.runInThisContext("(function(require,module,exports){"+fs.readFileSync(filename,"utf8")+"\n})",{filename})(id=>id==="uxp"||id==="./host/premiere"?{}:require(id.startsWith(".")?path.resolve("plugin",id):id),mod,mod.exports);
  const ui=new mod.exports.UI(c),elements=new Map();
  for(const id of ["close-x","later","apply","original-0","skip-0","change-0","change-1"]){
    const handlers={};elements.set(id,{disabled:id==="change-0",checked:id==="change-1",getAttribute:()=>"button",addEventListener:(event,fn)=>handlers[event]=fn,async click(){await handlers.click?.();}});
  }
  ui.modal=async(title,html,bind)=>{
    let result;const d={querySelector:selector=>elements.get(selector.slice(1)),close:value=>result=value};
    bind(d);for(const id of actions){await elements.get(id).click();if(id!=="apply")assert.equal(applied.length,0,"A decision alone must not mutate the project");}return result;
  };
  return {ui,batch,applied,elements};
}
test("Review Later applies no changes even after an Import original decision",async()=>{
  const x=setup(["original-0","later"]);await x.ui.review(x.batch);assert.equal(x.applied.length,0);
});
test("Review Import original applies only after the single Sync selected confirmation",async()=>{
  const x=setup(["original-0","apply"]);await x.ui.review(x.batch);
  assert.equal(x.applied.length,1);assert.deepEqual(x.applied[0],[x.batch,["0","1"],{"0":"original"}]);
});
test("deferring an MP4 clears an earlier original decision and leaves the safe selection",async()=>{
  const x=setup(["original-0","skip-0","apply"]);await x.ui.review(x.batch);
  assert.deepEqual(x.applied[0],[x.batch,["1"],{}]);assert.equal(x.elements.get("change-0").checked,false);assert.equal(x.elements.get("change-0").disabled,true);
});
