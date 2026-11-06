"use strict";
const P=require("./paths");
const VIDEO=/\.(mp4|mov|m4v|mxf|avi|mkv|webm|mts|m2ts)$/i;
function folderDate(path){
  const dates=new Set();
  for(const part of P.dirname(path).split("/")){
    for(const match of part.matchAll(/(?:^|[^0-9])(\d{4})-(\d{2})-(\d{2})(?=$|[^0-9])/g)){
    const date=match.slice(1).join("-"),parsed=new Date(date+"T00:00:00Z");
    if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)throw new Error("Invalid date in folder name: "+part);
    dates.add(date);
    }
  }
  if(dates.size!==1)throw new Error(dates.size?"Conflicting dates in folder names.":"No YYYY-MM-DD date found in the footage folder path.");
  return [...dates][0];
}
const compare=(a,b)=>a.date.localeCompare(b.date)||P.basename(a.path).localeCompare(P.basename(b.path),undefined,{numeric:true})||a.path.localeCompare(b.path);
function folderLabel(path){
  try{return {text:folderDate(path),kind:"date"};}
  catch(e){
    const text=P.basename(P.dirname(path));
    if(!text)throw new Error("The footage folder has no name for its title.");
    return {text,kind:"folder",warning:e.message+" Using folder name: "+text};
  }
}
const enabled=(settings={})=>settings.sequenceEnabled===undefined?Boolean(settings.sequenceTarget):settings.sequenceEnabled===true;
function fullRange({start,duration,inPoint,outPoint,fps}){
  const close=(a,b,tolerance=0.000001)=>Math.abs(a-b)<=tolerance;
  return Number.isFinite(duration)&&duration>0&&Number.isFinite(inPoint)&&Number.isFinite(outPoint)&&fps>0&&(inPoint<0||close(inPoint,0)||close(inPoint,start))&&(outPoint<0||close(outPoint,duration,1/fps+0.000001)||close(outPoint,start+duration,1/fps+0.000001));
}
module.exports={VIDEO,folderDate,folderLabel,enabled,compare,fullRange};
