"use strict";
class Progress {
  constructor(label) {
    this.label=label;this.status="running";this.startedAt=Date.now();this.updatedAt=this.startedAt;
    this.phase="Starting";this.current="";this.completed=0;this.total=null;
    this.warnings=[];this.errors=[];this.events=[];
  }
  update(phase,{current="",completed=0,total=null}={}) {
    const changed=this.phase!==phase;this.phase=phase;this.current=current;this.completed=completed;this.total=total;this.updatedAt=Date.now();
    if(changed)this.events.push({time:this.updatedAt,message:phase});
    this.events=this.events.slice(-40);
  }
  warn(message,path="") {
    if(!this.warnings.some(w=>w.message===message&&w.path===path))this.warnings.push({message,path});
  }
  finish(error) {
    this.status=error?"failed":this.warnings.length?"warnings":"completed";
    if(error)this.errors.push({message:error,current:this.current,phase:this.phase});
    this.finishedAt=Date.now();this.updatedAt=this.finishedAt;
    this.events.push({time:this.finishedAt,message:error?"Failed":this.status==="warnings"?"Completed with warnings":"Completed"});
  }
}
module.exports={Progress};
