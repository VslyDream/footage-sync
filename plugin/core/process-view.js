"use strict";
function willAppend(change, decisions = {}) {
 return (change.kind === "append-footage" || change.kind === "sequence-review") &&
   !change.checkpoint && decisions[change.id] !== "keep";
}
const stages=["Reading project","Scanning folders","Comparing disk and Premiere","Creating bins, renaming and moving","Importing files","Adding to the timeline","Clip markers","Final verification"];
function stage(phase=""){
 if(/Final|finished/.test(phase))return 7;
 if(/Appending/.test(phase))return 5;
 if(/Applying source clip markers/.test(phase))return 6;
 if(/Importing/.test(phase))return 4;
 if(/Creating bins|Updating Premiere|Checking project before change|Changes applied|Saving verified/.test(phase))return 3;
 if(/Comparing|Checking marker|Checking Footage/.test(phase))return 2;
 if(/Scanning/.test(phase))return 1;
 if(/Opening|Reading|Starting/.test(phase))return 0;
 return null;
}
function processStages(op,changes=[],decisions={}){
 const observed=new Map(),events=op.events||[],now=op.finishedAt||Date.now();let current=stage(op.phase);
 if(current===null)for(let i=events.length-1;i>=0;i--){current=stage(events[i].message);if(current!==null)break;}
 for(let i=0;i<events.length;i++){const id=stage(events[i].message);if(id===null)continue;observed.set(id,(observed.get(id)||0)+Math.max(0,(events[i+1]?.time||now)-events[i].time));}
 const counts=[null,null,null,changes.filter(c=>["new-folder","folder-move","rename-file","move-file","reconcile-item"].includes(c.kind)).length,changes.filter(c=>["new-file","fragmented"].includes(c.kind)).length,changes.filter(c=>willAppend(c,decisions)).length,changes.filter(c=>["clip-markers","marker-choice"].includes(c.kind)).length,null];
 return stages.map((name,id)=>({name,id,state:id===current?"current":observed.has(id)?"done":"upcoming",duration:observed.get(id),planned:counts[id]})).filter(s=>observed.has(s.id)||s.id===current||op.label==="Sync"&&s.id>2&&(s.planned||s.id===7));
}
module.exports={processStages,willAppend};
