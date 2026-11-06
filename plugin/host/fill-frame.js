"use strict";
const {ppro}=require("./premiere"),Core=require("../core/fill-frame");
async function geometry(sourceItem,sequence){
  const source=ppro.ClipProjectItem.cast(sourceItem),columns=JSON.parse(await ppro.Metadata.getProjectColumnsMetadata(sourceItem));
  const size=Core.dimensions(columns.find(c=>c.ColumnID==="Column.Intrinsic.VideoInfo")?.ColumnValue);
  const frame=await sequence.getFrameSize(),settings=await sequence.getSettings();
  const input={...size,par:(await source.getFootageInterpretation()).getPixelAspectRatio()};
  const target={width:Number(frame.width||frame.right-frame.left),height:Number(frame.height||frame.bottom-frame.top),par:await settings.getVideoPixelAspectRatio()};
  return {source:input,target,scale:Core.scale(input,target)};
}
async function motion(item){
  const chain=await item.getComponentChain();
  for(let i=0;i<chain.getComponentCount();i++){const component=chain.getComponentAtIndex(i);if(await component.getMatchName()==="AE.ADBE Motion")return component;}
  throw Error("Premiere did not expose Motion for Fill Frame.");
}
async function prepare(item,value){
  const component=await motion(item);
  if(component.getParamCount()<7)throw Error("Unexpected Motion controls for Fill Frame.");
  const scales=[component.getParam(1),component.getParam(2)],uniform=component.getParam(3),time=ppro.TickTime.createWithSeconds(0);
  if(uniform.isTimeVarying()||(await uniform.getValueAtTime(time)).value!==true)throw Error("Fill Frame needs an unchanged, uniformly scaled new footage clip.");
  for(const scale of scales)if(scale.isTimeVarying()||typeof (await scale.getValueAtTime(time)).value!=="number")throw Error("Fill Frame needs unchanged numeric Motion scale controls.");
  // Native Fill Frame updates both scale channels even with Uniform Scale enabled.
  return {actions:()=>scales.map(scale=>scale.createSetValueAction(scale.createKeyframe(value),true)),async verified(){for(const scale of scales){const actual=(await scale.getValueAtTime(time)).value;if(Math.abs(actual-value)>Math.max(0.0001,value*0.000001))return false;}return true;}};
}
module.exports={geometry,motion,prepare};
