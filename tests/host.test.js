"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
function setup() {
  const actions=[],nodes=[];
  function node(id,name,type,parent,mediaPath) {
    const n={id,name,type,parent,mediaPath};nodes.push(n);
    n.base={get name(){return n.name;},getId:()=>id,getParentBin:()=>n.parent?.folder,createSetNameAction:name=>()=>{n.name=name;}};
    if(type==="bin") n.folder={get name(){return n.name;},getItems:async()=>nodes.filter(x=>x.parent===n).map(x=>x.base),createRenameBinAction:name=>()=>{n.name=name;},createMoveItemAction:(item,target)=>()=>{nodes.find(x=>x.base===item).parent=nodes.find(x=>x.folder===target);}};
    else n.clip={getMediaFilePath:async()=>n.mediaPath,canChangeMediaPath:async()=>true,changeMediaFilePath:async value=>{n.mediaPath=value;return true;},createSetNameAction:name=>()=>{n.name=name;}};
    return n;
  }
  const root=node("root","","bin"),one=node("one","One","bin",root),two=node("two","Two","bin",root),media=node("clip","a.wav","clip",one,"D:/Media/a.wav");
  const ppro={FolderItem:{cast:item=>nodes.find(n=>n.base===item)?.folder||null},ClipProjectItem:{cast:item=>nodes.find(n=>n.base===item)?.clip||null},ProjectItem:{cast:item=>nodes.find(n=>n.folder===item||n.clip===item)?.base||item}};
  const project={getRootItem:async()=>root.folder,lockedAccess:fn=>fn(),executeTransaction:fn=>{fn({addAction:a=>{actions.push(a);a();}});return true;}};
  const filename=path.resolve("plugin/host/premiere.js"),mod={exports:{}};
  vm.runInThisContext("(function(require,module,exports){"+fs.readFileSync(filename,"utf8")+"\n})",{filename})(id=>id==="premierepro"?ppro:require(path.resolve("plugin/host",id)),mod,mod.exports);
  return {host:mod.exports,project,one,two,media,actions};
}
test("folder rename uses ProjectItem for its parent and preserves the bin",async()=>{
  const x=setup();await x.host.applyChange(x.project,{kind:"folder-move",path:"Renamed",itemId:"one"},await x.host.inventory(x.project));
  assert.equal(x.one.name,"Renamed");assert.equal(x.actions.length,1);assert.equal((await x.host.inventory(x.project)).bins.length,2);
});
test("file rename and move preserve the clip and use documented wrapper methods",async()=>{
  const x=setup();await x.host.applyChange(x.project,{kind:"move-file",path:"D:/Other/renamed.wav",name:"renamed.wav",itemId:"clip",target:"Two"},await x.host.inventory(x.project));
  assert.equal(x.media.mediaPath,"D:\\Other\\renamed.wav");assert.equal(x.media.name,"renamed.wav");assert.equal(x.media.parent,x.two);assert.equal((await x.host.inventory(x.project)).clips.length,1);
});
