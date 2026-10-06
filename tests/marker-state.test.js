"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
function setup(visibleAfter){
  let reads=0,waits=0;
  const expected={version:1,imports:[{sourceKey:"a",signature:"[[10,1]]"}]};
  const ppro={Metadata:{getProjectMetadata:async()=>JSON.stringify(++reads>visibleAfter?expected:{version:1,imports:[]})}};
  class XMPMeta{constructor(xml){this.xml=xml;}getProperty(){return {value:this.xml};}}
  const mod={exports:{}};
  vm.runInNewContext(fs.readFileSync("plugin/host/marker-state.js","utf8"),{require:id=>id==="premierepro"?ppro:{xmp:{XMPMeta}},module:mod,setTimeout:fn=>{waits++;fn();}});
  return {verify:()=>mod.exports.verify({},expected),get reads(){return reads;},get waits(){return waits;}};
}
test("metadata verification waits for host visibility without repeating writes",async()=>{
  const x=setup(2);assert.equal(await x.verify(),true);assert.equal(x.reads,3);assert.equal(x.waits,2);
});
test("metadata verification stops after bounded reads when host state does not match",async()=>{
  const x=setup(Infinity);assert.equal(await x.verify(),false);assert.equal(x.reads,11);assert.equal(x.waits,10);
});
