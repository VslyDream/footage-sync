"use strict";
function positive(value,label){const n=Number(value);if(!Number.isFinite(n)||n<=0)throw Error("Fill Frame needs valid "+label+".");return n;}
function ratio(value){
  if(typeof value==="number")return positive(value,"pixel aspect ratio");
  const parts=String(value).trim().replace(/,/g,".").split(/[:/]/);
  if(parts.length>2)throw Error("Invalid pixel aspect ratio.");
  return positive(parts[0],"pixel aspect ratio")/(parts.length===2?positive(parts[1],"pixel aspect ratio"):1);
}
function dimensions(info){
  const match=/^\s*(\d+)\s*[x×]\s*(\d+)/i.exec(String(info));
  if(!match)throw Error("Premiere did not provide source frame dimensions for Fill Frame.");
  return {width:positive(match[1],"source width"),height:positive(match[2],"source height")};
}
function scale(source,target){
  // Native Fill uses integer square-pixel widths and single-precision scale.
  const targetWidth=Math.round(positive(target.width,"sequence width")*ratio(target.par??1));
  const sourceWidth=positive(Math.round(positive(source.width,"source width")*ratio(source.par??1)),"source display width");
  const width=targetWidth/sourceWidth;
  const height=positive(target.height,"sequence height")/positive(source.height,"source height");
  return Math.fround(100*Math.fround(Math.max(width,height)));
}
module.exports={ratio,dimensions,scale};
