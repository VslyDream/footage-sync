"use strict";
const {panelLayout}=require("./core/panel-layout");

class MainPanel {
  constructor(root) {
    this.root=root; this.actions=root.querySelector(".main-actions");
    this.buttons=["links","sync","status"].map(id=>root.querySelector("#"+id));
    this.icons=[...root.querySelectorAll(".action-icon")];
    this.sync=root.querySelector("#sync"); this.status=root.querySelector("#status");
    this.badge=root.querySelector("#badge"); this.attention=root.querySelector("#attention");
    this.spinner=root.querySelector("#sync-spinner"); this.syncIcon=root.querySelector("#sync-icon");
    this.dots=[...this.spinner.querySelectorAll("circle")]; this.frame=0; this.count=0;
  }
  start() {
    if(this.started) return;
    this.started=true;
    // Observe our root, not window media queries: dialogs share this document.
    if(typeof ResizeObserver==="function") {
      this.observer=new ResizeObserver(entries=>{
        const box=entries.find(e=>e.target===this.root)?.contentRect;
        if(box) this.resize(box.width,box.height);
      });
      this.observer.observe(this.root);
    } else {
      // Baseline fallback only; observer-enabled hosts do no resize polling.
      this.resizeTimer=setInterval(()=>this.measure(),300);
    }
    this.measure();
  }
  measure() { this.resize(this.root.clientWidth,this.root.clientHeight); }
  resize(width,height) {
    const layout=panelLayout(width,height);
    if(!layout) { this.layout=null; this.animate(false); return; }
    if(this.layout?.width===layout.width&&this.layout?.height===layout.height) return;
    this.layout=layout;
    this.root.className="main-panel "+(layout.vertical?"vertical":"horizontal");
    this.actions.style.flexDirection=layout.vertical?"column":"row";
    this.actions.style.padding=layout.padding+"px";
    for(let i=0;i<this.buttons.length;i++) {
      const b=this.buttons[i];
      b.style.width=layout.button+"px"; b.style.height=layout.button+"px";
      b.style.marginRight=!layout.vertical&&i<2?layout.gap+"px":"0px";
      b.style.marginBottom=layout.vertical&&i<2?layout.gap+"px":"0px";
    }
    for(const svg of this.icons) {
      svg.setAttribute("width",String(layout.icon)); svg.setAttribute("height",String(layout.icon));
      svg.style.width=layout.icon+"px"; svg.style.height=layout.icon+"px";
    }
    this.attention.style.fontSize=Math.min(10,layout.button*.25)+"px";
    this.fitCount(); this.animate(this.busy);
  }
  fitCount() {
    if(!this.layout) return;
    const digits=String(this.count).length;
    // Keep the exact count visible, including large batches; never replace it with '!'.
    const font=Math.min(10,this.layout.button*.24,(this.layout.button-4)/(digits*.65+1));
    this.badge.style.fontSize=Math.max(1,font)+"px";
    this.badge.style.padding="1px "+Math.min(4,this.layout.button*.06)+"px";
  }
  update(controller) {
    const n=controller.batch?.changes?.length||0;
    const unavailable=Boolean(controller.batch?.changes?.some(c=>c.kind==="unavailable"));
    const warnings=controller.batch?.warnings?.length||0;
    const attention=Boolean(controller.error||controller.batch?.hasBlocking||warnings||unavailable);
    this.count=n; this.busy=Boolean(controller.busy);
    this.sync.disabled=this.busy||unavailable;
    this.sync.className="main-action"+(this.sync.disabled?" disabled":"")+(this.busy?" working":"");
    this.sync.setAttribute("aria-disabled",String(this.sync.disabled));
    this.sync.setAttribute("title",this.busy?"Sync — scanning / syncing…":unavailable?"Sync unavailable — open Status to reconnect the source":"Sync — scan and sync this project");
    this.status.className="main-action"+(attention?" needs-attention":"");
    this.status.setAttribute("title",`Status — ${n} pending changes${attention?" · Needs attention":""}${warnings?` · ${warnings} warnings`:""}`);
    this.badge.textContent=String(n); this.badge.style.display=n?"block":"none";
    this.attention.style.display=attention?"block":"none";
    this.syncIcon.style.display=this.busy?"none":"block";
    this.spinner.style.display=this.busy?"block":"none";
    this.fitCount(); this.animate(this.busy);
  }
  animate(running) {
    if(!running||!this.layout||!this.started) {
      if(this.animationTimer) clearInterval(this.animationTimer);
      this.animationTimer=null; return;
    }
    if(this.animationTimer) return;
    this.paintFrame();
    // SVG fill updates work on baseline UXP without CSS animation/transform flags.
    this.animationTimer=setInterval(()=>this.paintFrame(),100);
  }
  paintFrame() {
    this.frame=(this.frame+1)%this.dots.length;
    const shades=["#83baff","#70a2de","#5f8abd","#50739c","#425d7c","#374d65","#2e4053","#273647"];
    this.dots.forEach((dot,i)=>dot.setAttribute("fill",shades[(i-this.frame+this.dots.length)%this.dots.length]));
  }
  destroy() {
    this.started=false; this.observer?.disconnect(); this.observer=null;
    if(this.resizeTimer) clearInterval(this.resizeTimer);
    this.resizeTimer=null; this.animate(false);
  }
}
module.exports={MainPanel};
