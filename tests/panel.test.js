"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const {panelLayout}=require("../plugin/core/panel-layout");

test("all three buttons and icons fit narrow, short and wide panel content without scrolling",()=>{
  for(const [width,height] of [[50,250],[40,90],[50,70],[40,48],[159,90],[160,48],[340,150],[1920,48],[24,24]]) {
    const l=panelLayout(width,height),cross=l.vertical?width:height,long=l.vertical?height:width;
    assert.ok(l.button>0&&l.icon>0);
    assert.ok(l.button+2*l.padding<=cross+1e-8);
    assert.ok(3*l.button+2*l.gap+2*l.padding<=long+1e-8);
    assert.ok(l.icon<l.button);
  }
  assert.equal(panelLayout(50,250).vertical,true);
  assert.equal(panelLayout(340,150).vertical,false);
  assert.ok(panelLayout(50,70).icon<panelLayout(50,250).icon);
  assert.ok(panelLayout(40,250).icon<panelLayout(50,250).icon);
  for(const size of [[0,250],[50,0],[NaN,100],[50,Infinity]])assert.equal(panelLayout(...size),null);
});

function setup({observer=true,width=50,height=250}={}) {
  const timers=new Map();let timerId=0;
  const node=()=>({style:{},attrs:{},events:{},className:"",textContent:"",disabled:false,setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];}});
  const root=node(),actions=node(),links=node(),sync=node(),status=node(),badge=node(),attention=node(),spinner=node(),syncIcon=node();
  const dots=Array.from({length:8},node),icons=[node(),syncIcon,spinner,node()];
  spinner.querySelectorAll=()=>dots;
  Object.assign(root,{clientWidth:width,clientHeight:height,querySelector:s=>({".main-actions":actions,"#links":links,"#sync":sync,"#status":status,"#badge":badge,"#attention":attention,"#sync-spinner":spinner,"#sync-icon":syncIcon})[s],querySelectorAll:()=>icons});
  const context={module:{exports:{}},require:id=>require(path.resolve("plugin",id)),setInterval(fn){timers.set(++timerId,fn);return timerId;},clearInterval(id){timers.delete(id);}};
  if(observer)context.ResizeObserver=class{constructor(fn){this.fn=fn;}observe(el){this.target=el;}disconnect(){this.disconnected=true;}};
  vm.runInNewContext(fs.readFileSync("plugin/main-panel.js","utf8"),context);
  const panel=new context.module.exports.MainPanel(root);panel.start();
  const state={busy:false,batch:{changes:Array.from({length:17},()=>({kind:"new-file"})),warnings:[],hasBlocking:false},error:null};
  return {panel,root,links,sync,status,badge,attention,spinner,syncIcon,dots,timers,state};
}
test("blocking/error/warning preserves numeric count and exposes separate attention; unavailable disables sync",()=>{
  const x=setup();x.state.batch.hasBlocking=true;x.panel.update(x.state);
  assert.equal(x.badge.textContent,"17");assert.equal(x.attention.style.display,"block");assert.equal(x.sync.disabled,false);
  x.state.batch.changes[0].kind="unavailable";x.panel.update(x.state);assert.equal(x.sync.disabled,true);assert.match(x.sync.attrs.title,/unavailable/);
  x.state.batch.changes=[];x.state.batch.hasBlocking=false;x.state.error="Offline";x.panel.update(x.state);
  assert.equal(x.badge.style.display,"none");assert.equal(x.attention.style.display,"block");
  x.state.error=null;x.state.batch.warnings=[{}];x.panel.update(x.state);assert.equal(x.attention.style.display,"block");
  x.state.batch.warnings=[];x.panel.update(x.state);assert.equal(x.attention.style.display,"none");assert.equal(x.sync.disabled,false);
  x.state.batch.changes=Array(12345).fill({});x.panel.update(x.state);assert.equal(x.badge.textContent,"12345");assert.ok(parseFloat(x.badge.style.fontSize)*(.65*5+1)<=x.panel.layout.button);
  x.panel.destroy();assert.equal(x.timers.size,0);
});
test("spinner advances only while busy and stops on completion, failure, hidden size and destruction",()=>{
  const x=setup();assert.equal(x.timers.size,0);
  x.state.busy=true;x.panel.update(x.state);assert.equal(x.timers.size,1);assert.equal(x.sync.disabled,true);assert.equal(x.spinner.style.display,"block");
  const first=x.dots.map(d=>d.attrs.fill);[...x.timers.values()][0]();assert.notDeepEqual(x.dots.map(d=>d.attrs.fill),first);
  x.panel.update(x.state);assert.equal(x.timers.size,1);
  x.panel.resize(0,0);assert.equal(x.timers.size,0);
  x.panel.resize(50,250);assert.equal(x.timers.size,1);
  x.state.busy=false;x.state.error="Test failure";x.panel.update(x.state);assert.equal(x.timers.size,0);assert.equal(x.syncIcon.style.display,"block");assert.equal(x.spinner.style.display,"none");
  x.state.busy=true;x.panel.update(x.state);x.panel.destroy();assert.equal(x.timers.size,0);
});
test("observer resizes only its root and fallback polling is disposed without touching dialogs",()=>{
  const x=setup(),observer=x.panel.observer;
  assert.equal(observer.target,x.root);
  observer.fn([{target:{},contentRect:{width:850,height:570}}]);assert.equal(x.panel.layout.width,50);
  observer.fn([{target:x.root,contentRect:{width:340,height:100}}]);assert.equal(x.panel.layout.vertical,false);
  x.panel.destroy();assert.equal(observer.disconnected,true);
  const y=setup({observer:false,width:0,height:0});assert.equal(y.timers.size,1);assert.equal(y.panel.layout,null);
  y.root.clientWidth=50;y.root.clientHeight=250;[...y.timers.values()][0]();assert.equal(y.panel.layout.vertical,true);
  y.panel.destroy();assert.equal(y.timers.size,0);
});
