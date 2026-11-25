"use strict";
const COLORS=["green","red","rose","orange","yellow","white","blue","teal"];
const P=require("./paths");
// TXT color numbers are 1–8, as Polden OBS writes them. `color` stays the Premiere marker color index 0–7.
// The signature keeps the number as written, so receipts of TXT files processed before the 1–8 switch still match.
function signature(markers) {return JSON.stringify(markers.map(m=>[m.seconds,m.color+1]));}
function candidates(mediaPath,txtFiles) {
  if(!/\.mp4$/i.test(mediaPath))return [];
  const name=P.basename(mediaPath).slice(0,-4).toLowerCase();
  return txtFiles.filter(f=>P.key(P.dirname(f.path))===P.key(P.dirname(mediaPath))&&name.includes(P.basename(f.path).slice(0,-4).toLowerCase()));
}
function parseMarkers(text) {
  if(typeof text!=="string") throw new Error("Marker TXT must be text.");
  const markers=[],errors=[];
  text.replace(/^\uFEFF/,"").split(/\r?\n/).forEach((line,index)=>{
    if(!line.trim()) return;
    const match=/^\s*(\d+):([0-5]\d):([0-5]\d)\s*,\s*([1-8])\s*$/.exec(line);
    if(!match) { errors.push({line:index+1,message:"Expected H:MM:SS,color (1–8)."}); return; }
    const seconds=Number(match[1])*3600+Number(match[2])*60+Number(match[3]);
    if(!Number.isSafeInteger(seconds)) { errors.push({line:index+1,message:"Marker time is too large."}); return; }
    markers.push({seconds,color:Number(match[4])-1,line:index+1});
  });
  if(!markers.length&&!errors.length) errors.push({line:0,code:"empty",message:"Marker TXT is empty."});
  // A malformed source never yields a partially applicable marker list.
  return {markers:errors.length?[]:markers,errors};
}
module.exports={COLORS,parseMarkers,signature,candidates};
