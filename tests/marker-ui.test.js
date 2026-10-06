"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
function setup(picked){
  const calls=[],entry={path:"D:/Media/clip.mp4",itemId:"clip",projectPath:"D:/Footage.prproj",projectId:"project"};
  const c={onChange(){},data:{links:[],history:[]},batch:{changes:[],media:[entry]},path:entry.projectPath,project:{name:"Footage"},async scan(){calls.push("scan");return this.batch;},async chooseMarkers(media,txt){calls.push({media,txt});}};
  const filename=path.resolve("plugin/ui.js"),mod={exports:{}};
  const wrapper=vm.runInThisContext("(function(require,module,exports){"+fs.readFileSync(filename,"utf8")+"\n})",{filename});
  wrapper(id=>id==="uxp"?{storage:{localFileSystem:{async getFileForOpening(options){calls.push(options);return picked;}}}}:id==="./host/premiere"?{}:require(id.startsWith(".")?path.resolve("plugin",id):id),mod,mod.exports);
  const ui=new mod.exports.UI(c);let previews=0;
  ui.modal=async()=>{previews++;return previews===1?{marker:entry}:"cancel";};
  return {ui,c,calls,entry,previews:()=>previews};
}
test("Status manual TXT opens the picker, saves the exact clip selection and reopens a fresh Status",async()=>{
  const x=setup({nativePath:"D:/Markers/chosen.txt"});await x.ui.status();
  assert.equal(x.previews(),2);assert.equal(x.calls.filter(v=>v==="scan").length,2);
  assert.deepEqual(x.calls.find(v=>v?.media),{media:x.entry,txt:"D:/Markers/chosen.txt"});
  assert.deepEqual(x.calls.find(v=>v?.types),{types:["txt"]});
});
test("cancelling the marker picker refreshes Status without saving a selection or applying changes",async()=>{
  const x=setup(null);await x.ui.status();assert.equal(x.previews(),2);
  assert.equal(x.calls.filter(v=>v?.media).length,0);assert.equal(x.calls.filter(v=>v==="scan").length,2);
});
test("closing Status while Review opens does not leave background sync paused",async()=>{
  const x=setup(null),oldDocument=globalThis.document,resolvers=[];
  globalThis.document={createElement:()=>({style:{},remove(){},uxpShowModal:()=>new Promise(resolve=>resolvers.push(resolve))}),body:{appendChild(){}}};
  x.ui.update=()=>{};
  try {
    const modal=Object.getPrototypeOf(x.ui).modal;
    const status=modal.call(x.ui,"Status",""),review=modal.call(x.ui,"Review","");
    assert.equal(x.c.dialogOpen,true);resolvers[0]("cancel");await status;
    assert.equal(x.c.dialogOpen,true);resolvers[1]("cancel");await review;
    assert.equal(x.c.dialogOpen,false);
  }finally{globalThis.document=oldDocument;}
});
