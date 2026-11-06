"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),Core=require("../plugin/core/fill-frame");
test("Fill covers both frame dimensions for portrait, landscape, square and oversized sources",()=>{
  for(const [w,h,expected] of [[600,900,320],[1280,720,150],[800,800,240],[3840,2160,50],[2048,512,210.9375]]){
    const scale=Core.scale({width:w,height:h},{width:1920,height:1080});assert.ok(Math.abs(scale-expected)<.0001);assert.ok(w*scale/100>=1920-.001&&h*scale/100>=1080-.001);
  }
});
test("Fill honors both source and sequence pixel aspect ratios",()=>{
  assert.equal(Core.scale({width:720,height:576,par:16/15},{width:1920,height:1080,par:1}),250);
  assert.equal(Core.scale({width:1920,height:1080,par:1},{width:1440,height:1080,par:4/3}),100);
  assert.equal(Core.scale({width:1920,height:1080},{width:1080,height:1920}),177.7777862548828);
  // Observed native Fill values: PAR 128/117 makes 720 become 788 display pixels.
  assert.equal(Core.scale({width:720,height:576,par:128/117},{width:1920,height:1080}),243.65481567382812);
  assert.equal(Core.scale({width:800,height:800},{width:1920,height:1080}),240.00001525878906);
  assert.deepEqual(Core.dimensions("600 x 900 (1,0)"),{width:600,height:900});assert.equal(Core.ratio("16:15"),16/15);
});
test("missing or invalid dimensions/PAR fail instead of applying a guessed scale",()=>{
  assert.throws(()=>Core.dimensions("unknown"),/did not provide/);assert.throws(()=>Core.scale({width:0,height:20},{width:1920,height:1080}),/valid source width/);
  assert.throws(()=>Core.ratio("1:0"),/valid pixel aspect/);assert.throws(()=>Core.scale({width:1,height:1},{width:NaN,height:1}),/sequence width/);
});

test("native-equivalent Fill writes and verifies both Motion scale channels without changing other controls",async()=>{
  const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path"),mod={exports:{}},values=[320,100],varying=new Set();
  const scales=values.map((_,i)=>({isTimeVarying:()=>varying.has(i),getValueAtTime:async()=>({value:values[i]}),createKeyframe:value=>({value}),createSetValueAction:k=>()=>{values[i]=k.value;}}));
  const uniform={isTimeVarying:()=>false,getValueAtTime:async()=>({value:true})},component={getMatchName:async()=>"AE.ADBE Motion",getParamCount:()=>11,getParam:i=>i===3?uniform:scales[i-1]};
  const item={getComponentChain:async()=>({getComponentCount:()=>1,getComponentAtIndex:()=>component})},ppro={TickTime:{createWithSeconds:s=>s}};
  const filename=path.resolve("plugin/host/fill-frame.js");
  vm.runInThisContext("(function(require,module,exports){"+fs.readFileSync(filename,"utf8")+"\n})",{filename})(id=>id==="./premiere"?{ppro}:Core,mod,mod.exports);
  const fill=await mod.exports.prepare(item,320);assert.equal(await fill.verified(),false);
  const actions=fill.actions();assert.equal(actions.length,2);actions.forEach(a=>a());assert.deepEqual(values,[320,320]);assert.equal(await fill.verified(),true);
  varying.add(1);await assert.rejects(()=>mod.exports.prepare(item,150),/unchanged numeric/);
});
