"use strict";
// Resume only the generated comparison projects; UI invokes the native command.
module.exports=async function(root){
 const H=require("./runtime/host/premiere"),fs=require("./runtime/host/io"),P=require("./runtime/core/paths"),Fill=require("./runtime/host/fill-frame"),ppro=H.ppro;
 const result=JSON.parse(await fs.readFile(root+"/result.json",{encoding:"utf-8"}));
 const write=()=>fs.writeFile(root+"/result.json",JSON.stringify(result,null,2),{encoding:"utf-8"});
 const params=async item=>{const c=await Fill.motion(item),out=[];for(let i=0;i<c.getParamCount();i++)out.push({index:i,value:(await c.getParam(i).getValueAtTime(ppro.TickTime.createWithSeconds(0))).value});return out;};
 let timer;
 try{
  await ppro.Project.open(P.native(result.source));await ppro.Project.open(P.native(result.target));
  const project=await H.resolveProject({path:result.target}),sequences=await project.getSequences(),native=sequences.find(s=>s.name==="Native Fill reference"),auto=sequences.find(s=>s.name==="Automatic Fill");
  if(!native||!auto)throw Error("Comparison sequences missing");
  let index=0,busy=false;
  const select=async()=>{await project.openSequence(native);await native.setPlayerPosition(ppro.TickTime.createWithSeconds(result.cases[index].start+.5));result.status="awaiting native Fill Frame";result.current=index;delete result.error;await write();};
  await select();
  timer=setInterval(async()=>{if(busy)return;busy=true;try{
   const refs=await (await native.getVideoTrack(0)).getTrackItems(ppro.Constants.TrackItemType.CLIP,false),row=result.cases[index],values=await params(refs[index+1]);if(Math.abs(values[1].value-47)<.0001)return;
   row.native=values;row.motionMatch=values.every((v,i)=>Array.isArray(v.value)?JSON.stringify(v.value)===JSON.stringify(row.automatic[i].value):typeof v.value==="number"?Math.abs(v.value-row.automatic[i].value)<.0001:v.value===row.automatic[i].value);
   row.nativeScale=values[1].value;row.automaticScale=row.automatic[1].value;
   if(++index<result.cases.length)await select();else{
    clearInterval(timer);await project.save();result.status="exporting frames";await write();
    for(let n=0;n<result.cases.length;n++){
     const row=result.cases[n];row.exports=[];
     for(const [name,seq] of [["auto",auto],["native",native]]){
      try{const ok=await ppro.Exporter.exportSequenceFrame(seq,ppro.TickTime.createWithSeconds(row.start+.5),name+"-"+n+".png",P.native(root+"/frames"),1920,1080);row.exports.push({name,ok});}
      catch(e){row.exports.push({name,error:String(e?.message||e)});}
     }await write();
    }
    result.status=result.cases.every(v=>v.motionMatch)?"complete":"mismatch";await write();await project.openSequence(auto);
   }
  }catch(e){clearInterval(timer);result.status="failed";result.error=String(e?.message||e);await write();}finally{busy=false;}},300);
 }catch(e){if(timer)clearInterval(timer);result.status="failed";result.error=String(e?.message||e);await write();}
};
