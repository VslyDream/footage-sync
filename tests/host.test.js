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
  return {host:mod.exports,project,root,one,two,media,actions,node};
}
test("folder rename uses ProjectItem for its parent and preserves the bin",async()=>{
  const x=setup();await x.host.applyChange(x.project,{kind:"folder-move",path:"Renamed",itemId:"one"},await x.host.inventory(x.project));
  assert.equal(x.one.name,"Renamed");assert.equal(x.actions.length,1);assert.equal((await x.host.inventory(x.project)).bins.length,2);
});
test("file rename and move preserve the clip and use documented wrapper methods",async()=>{
  const x=setup();await x.host.applyChange(x.project,{kind:"move-file",path:"D:/Other/renamed.wav",name:"renamed.wav",itemId:"clip",target:"Two"},await x.host.inventory(x.project));
  assert.equal(x.media.mediaPath,"D:\\Other\\renamed.wav");assert.equal(x.media.name,"renamed.wav");assert.equal(x.media.parent,x.two);assert.equal((await x.host.inventory(x.project)).clips.length,1);
});

test("root import checks duplicates, verifies the result and returns the checkpoint inventory with two full walks",async()=>{
  const x=setup(),stages=[];let rootReads=0,imports=0;
  const getItems=x.root.folder.getItems;x.root.folder.getItems=async()=>{rootReads++;return getItems();};
  x.project.importFiles=async(files,suppress,target,stills)=>{
    assert.equal(target,x.root.folder);assert.equal(suppress,true);assert.equal(stills,false);imports++;
    x.node("new","new.wav","clip",x.root,files[0]);return true;
  };
  const after=await x.host.applyChange(x.project,{kind:"new-file",path:"D:/Media/new.wav",target:""},null,(stage,current)=>stages.push({stage,current}));
  assert.equal(imports,1);assert.equal(rootReads,2);assert.equal(after.clips.find(c=>c.id==="new").parentPath,"");
  assert.deepEqual(stages.map(s=>s.stage),["Checking for existing media","Importing media","Verifying import"]);
  await assert.rejects(()=>x.host.applyChange(x.project,{kind:"new-file",path:"D:/Media/new.wav",target:""},null),/imported after analysis/);assert.equal(imports,1);
});

test("a successful import API response without the actual Project Item still fails verification",async()=>{
  const x=setup();x.project.importFiles=async()=>true;
  await assert.rejects(()=>x.host.applyChange(x.project,{kind:"new-file",path:"D:/Media/absent.wav",target:""},null),/could not be verified/);
});

test("stale project views and stale active wrappers do not hide a healthy saved target",async()=>{
  const x=setup(),ppro=x.host.ppro,healthy={path:"D:/Footage.prproj",guid:"healthy"};
  ppro.ProjectUtils={getProjectViewIds:async()=>["closed","healthy"],getProjectFromViewId:async id=>{if(id==="closed")throw Error("a null ptr was detected");return healthy;}};
  ppro.Project={getActiveProject:async()=>({get path(){throw Error("a null ptr was detected");}})};
  assert.equal(await x.host.resolveProject({path:healthy.path}),healthy);
  ppro.ProjectUtils.getProjectFromViewId=async()=>{throw Error("permission denied");};await assert.rejects(()=>x.host.openProjects(),/permission denied/);
});
