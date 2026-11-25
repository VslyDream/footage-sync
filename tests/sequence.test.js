"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");

function hostFixture({nativeTitlesHaveProjectItems=true}={}){
  const target={sequenceId:"target"};
  const videos=[],titles=[],temporary=[];
  let metadata="",nextId=0,locked=false;
  const time=seconds=>({seconds});
  function clip({id="clip"+ ++nextId,name="Clip",mediaPath="",start=0,end=2}={}){
    const base=id===null?null:{getId:()=>id,getMediaFilePath:()=>mediaPath};
    return {id,name,mediaPath,start,end,getProjectItem:()=>base,getName(){return this.name;},
      getStartTime(){return time(this.start);},getEndTime(){return time(this.end);},
      createSetEndAction(value){assert.ok(locked);return ()=>{this.end=value.seconds;};},
      createSetNameAction(value){assert.ok(locked);return ()=>{this.name=value;};}};
  }
  function sequence(guid,tracks){
    return {guid,getProjectItem:()=>({guid}),getVideoTrackCount:()=>tracks.length,
      getVideoTrack:index=>({getTrackItems:()=>tracks[index].slice()}),
      getEndTime:()=>time(Math.max(0,...tracks.flat().map(c=>c.end))),
      getFrameSize:()=>({width:1920,height:1080}),getTimebase:()=>8467200000};
  }
  const destination=sequence("target",[videos,titles]);
  const project={guid:"project",getSequence:id=>id==="target"?destination:temporary.find(s=>s.guid===id),
    importSequences:(_,ids)=>{temporary.push(sequence(ids[0],[[],[clip({name:"Generated"})]]));return true;},
    getSequences:()=>[destination,...temporary],deleteSequence:source=>{temporary.splice(temporary.indexOf(source),1);return true;},
    lockedAccess(fn){locked=true;try{fn();}finally{locked=false;}},
    executeTransaction(fn){const actions=[];fn({addAction:action=>actions.push(action)});actions.forEach(action=>action());return true;}};
  const ppro={
    ClipProjectItem:{cast:x=>x},Guid:{fromString:x=>x},TickTime:{createWithSeconds:time},
    Constants:{TrackItemType:{CLIP:1},MediaType:{VIDEO:1},MetadataType:{TEXT:1}},
    SequenceEditor:{getEditor:()=>({
      createInsertProjectItemAction(source,start){assert.ok(locked);return ()=>videos.push(clip({mediaPath:source.mediaPath,start:start.seconds,end:start.seconds+2}));},
      createCloneTrackItemAction(source,start){assert.ok(locked);return ()=>titles.push(clip({id:nativeTitlesHaveProjectItems?undefined:null,name:source.name,start:start.seconds,end:start.seconds+2}));}
    })},
    Metadata:{getProjectMetadata:()=>metadata,addPropertyToProjectMetadataSchema:()=>true,
      createSetProjectMetadataAction:(_,value)=>()=>{metadata=value;}}
  };
  class XMPMeta{
    constructor(value){this.value=value;}
    getProperty(){return this.value?{value:this.value}:undefined;}
    setProperty(_,field,value){this.value=value;}
    serialize(){return this.value;}
  }
  const mocks={
    "./premiere":{ppro,resolveProject:async()=>project},
    "./io":{writeFile:async()=>{}},
    "../core/native-date":{generate:()=>({sequenceId:"temp",bytes:new Uint8Array()})},
    "uxp":{xmp:{XMPMeta},storage:{localFileSystem:{getTemporaryFolder:async()=>({nativePath:"D:/Temp"})}}},
    "./fill-frame":{geometry:async()=>({scale:100}),prepare:async()=>({actions:()=>[],verified:async()=>true})},
    "./marker-state":{timing:async()=>({start:0,duration:2})}
  };
  const filename=path.resolve("plugin/host/sequence.js"),mod={exports:{}};
  vm.runInThisContext("(function(require,module,exports){"+fs.readFileSync(filename,"utf8")+"\n})",{filename})(
    id=>mocks[id]||require(path.resolve("plugin/host",id)),mod,mod.exports);
  function entry(key){return {key,target,path:"D:/Media/2026-11-20/"+key+".mp4",date:"2026-11-20"};}
  function append(change,save=async()=>{}){
    const media={mediaPath:change.path,isSequence:()=>false,isOffline:()=>false,
      getFootageInterpretation:()=>({getFrameRate:()=>30}),getInPoint:()=>time(0),getOutPoint:()=>time(2)};
    return mod.exports.apply(change,media,save);
  }
  return {clip,entry,append,videos,titles,temporary,receipts:()=>mod.exports.readReceipts(target),writeReceipts:value=>{metadata=JSON.stringify(value);}};
}

test("same-date consecutive appends extend the verified managed V2 title",async()=>{
  const x=hostFixture();
  assert.deepEqual(await x.append(x.entry("first")),{appended:true});
  const id=x.titles[0].id;
  assert.deepEqual(await x.append(x.entry("second")),{appended:true});
  assert.deepEqual(x.videos.map(c=>[c.start,c.end]),[[0,2],[2,4]]);
  assert.deepEqual(x.titles.map(c=>[c.id,c.name,c.start,c.end]),[[id,"2026-11-20",0,4]]);
  assert.deepEqual((await x.receipts()).imports.map(r=>[r.key,r.titleItemId]),[["first",id],["second",id]]);
  assert.deepEqual(x.temporary,[]);
});

test("Premiere graphics without Project Items extend one V2 title across seven receipts",async()=>{
  const x=hostFixture({nativeTitlesHaveProjectItems:false});
  const seed=x.clip({name:"Seed",mediaPath:"D:/Media/seed.mp4"});
  x.videos.push(seed);
  const entries=Array.from({length:7},(_,index)=>x.entry(String(index)));
  for(const entry of entries)assert.deepEqual(await x.append(entry),{appended:true});

  assert.equal(x.videos.length,8);
  assert.deepEqual([x.videos[0],seed.name,seed.start,seed.end],[seed,"Seed",0,2]);
  assert.deepEqual(x.titles.map(c=>[c.id,c.name,c.start,c.end]),[[null,"2026-11-20",2,16]]);
  const {imports}=await x.receipts();
  assert.deepEqual(imports.map(r=>[r.key,r.titleItemId,r.titleStart,r.start,r.end]),
    entries.map((entry,index)=>[entry.key,null,2,2+index*2,4+index*2]));
  for(const entry of entries)assert.deepEqual(await x.append(entry),{reused:true});
  assert.equal(x.videos.length,8);
  assert.equal(x.titles.length,1);
  assert.deepEqual(x.temporary,[]);
});

test("replacing the managed title with a same-name edit does not extend someone else's V2 item",async()=>{
  const x=hostFixture();
  await x.append(x.entry("first"));
  const replacement=x.clip({name:x.titles[0].name});
  x.titles.splice(0,1,replacement);
  await x.append(x.entry("second"));
  assert.equal(replacement.end,2);
  assert.deepEqual(x.titles.map(c=>[c.start,c.end]),[[0,2],[2,4]]);
});

test("a legacy prefix title with a continuous receipted V1 span is extended and renamed",async()=>{
  const x=hostFixture(),first=x.entry("first");
  x.videos.push(x.clip({mediaPath:first.path}));
  const title=x.clip({name:"Footage Sync date "+first.date});
  x.titles.push(title);
  x.writeReceipts({version:1,imports:[{key:first.key,path:first.path,date:first.date,start:0,end:2}]});
  await x.append(x.entry("second"));
  assert.deepEqual(x.titles.map(c=>[c.id,c.name,c.start,c.end]),[[title.id,first.date,0,4]]);
});

test("a legacy lookalike with an unverified V1 span keeps its original name and duration",async()=>{
  const x=hostFixture(),first=x.entry("first");
  x.videos.push(x.clip({mediaPath:"D:/Media/User.mp4"}));
  const title=x.clip({name:"Footage Sync date "+first.date});
  x.titles.push(title);
  x.writeReceipts({version:1,imports:[{key:first.key,path:first.path,date:first.date,start:0,end:2}]});
  await x.append(x.entry("second"));
  assert.deepEqual(x.titles.map(c=>[c.name,c.start,c.end]),[[title.name,0,2],[first.date,2,4]]);
});

test("a timeline edit during the attempt save is preserved and stops insertion",async()=>{
  const x=hostFixture(),change=x.entry("first");
  await assert.rejects(x.append(change,async()=>{x.videos.push(x.clip({name:"Editor's edit"}));}),/changed before insertion/);
  assert.deepEqual(x.videos.map(c=>c.name),["Editor's edit"]);
  assert.deepEqual(x.titles,[]);
  assert.deepEqual(x.temporary,[]);
  assert.deepEqual((await x.receipts()).imports,[]);
  await assert.rejects(x.append(change),/interrupted sequence append/);
});

test("a failed attempt save removes the temporary sequence and makes no edits",async()=>{
  const x=hostFixture();
  await assert.rejects(x.append(x.entry("first"),async()=>{throw Error("Save failed");}),/Save failed/);
  assert.deepEqual(x.videos,[]);
  assert.deepEqual(x.titles,[]);
  assert.deepEqual(x.temporary,[]);
});
