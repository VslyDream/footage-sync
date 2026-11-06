"use strict";
const template=require("../assets/date-template.json");
const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function decode64(value){const s=value.replace(/\s/g,""),bytes=[];let bits=0,n=0;for(const c of s){if(c==="=")break;const x=alphabet.indexOf(c);if(x<0)throw new Error("Invalid native template encoding.");bits=(bits<<6)|x;n+=6;if(n>=8){n-=8;bytes.push((bits>>>n)&255);}}return new Uint8Array(bytes);}
function encode64(bytes){let value="";for(let i=0;i<bytes.length;i+=3){const n=(bytes[i]<<16)|((bytes[i+1]||0)<<8)|(bytes[i+2]||0);value+=alphabet[(n>>>18)&63]+alphabet[(n>>>12)&63]+(i+1<bytes.length?alphabet[(n>>>6)&63]:"=")+(i+2<bytes.length?alphabet[n&63]:"=");}return value;}
function utf8(value){const out=[];for(const c of value){const n=c.codePointAt(0);if(n<128)out.push(n);else if(n<2048)out.push(192|(n>>6),128|(n&63));else if(n<65536)out.push(224|(n>>12),128|((n>>6)&63),128|(n&63));else out.push(240|(n>>18),128|((n>>12)&63),128|((n>>6)&63),128|(n&63));}return new Uint8Array(out);}
function gzip(bytes){
  // RFC 1952 + stored DEFLATE blocks. This tiny template needs no compression runtime.
  const blocks=Math.max(1,Math.ceil(bytes.length/65535)),out=new Uint8Array(10+blocks*5+bytes.length+8),view=new DataView(out.buffer);
  out.set([31,139,8,0,0,0,0,0,0,3]);let at=10,pos=0,crc=0xffffffff;
  for(let i=0;i<blocks;i++){const size=Math.min(65535,bytes.length-pos);out[at++]=i===blocks-1?1:0;view.setUint16(at,size,true);view.setUint16(at+2,(~size)&65535,true);at+=4;out.set(bytes.subarray(pos,pos+size),at);at+=size;pos+=size;}
  for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  view.setUint32(at,(crc^0xffffffff)>>>0,true);view.setUint32(at+4,bytes.length>>>0,true);return out;
}
const uuid=()=>"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return(c==="x"?r:(r&3)|8).toString(16);});
const xmlText=value=>value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
function textPayload(original,text,fontSize){
  // Validated offsets for this bundled 25.6.2 FormattedTextData graph. Keep
  // the 2-aligned style vtable at 246 and rebase every pointer crossing it.
  const refs=[[12,24],[24,18],[28,128],[128,34],[144,200],[204,216],[216,208],[220,228],[224,300],[300,246],[312,328],[328,336],[308,324],[324,336],[140,172],[176,180],[136,156],[156,336],[160,336],[164,336],[168,336],[332,336]];
  const input=new DataView(original.buffer,original.byteOffset,original.byteLength);
  if(original.length!==344||input.getUint32(0,true)!==332||input.getUint32(228,true)!==10)throw new Error("Unknown native text payload.");
  for(let i=0;i<10;i++)if(original[232+i]!==template.date.charCodeAt(i))throw new Error("Native date placeholder is missing.");
  const tables=new Set([24,128,216,300,324,328,332,156,160,164,168]);
  // Table references store (position - vtable), which may be negative.
  for(const [at,target] of refs)if(input.getInt32(at,true)!==(tables.has(at)?at-target:target-at))throw new Error("Native text offsets changed.");
  const encoded=utf8(text),span=4+encoded.length+1,padded=span+((18-span)%4+4)%4,delta=padded-18;
  const out=new Uint8Array(original.length+delta),view=new DataView(out.buffer),shift=p=>p>=246?p+delta:p;
  out.set(original.subarray(0,228));out.set(original.subarray(246),246+delta);
  view.setUint32(228,encoded.length,true);out.set(encoded,232);view.setUint32(0,332+delta,true);
  for(const [at,target] of refs)view.setInt32(shift(at),tables.has(at)?shift(at)-shift(target):shift(target)-shift(at),true);
  view.setFloat32(template.fontOffset+delta,fontSize,true);return out;
}
function generate(date,height=1080,width=1920){
  if(typeof date!=="string"||!date.trim()||/[\u0000-\u001f\u007f]/.test(date)||!Number.isFinite(height)||height<=0||!Number.isFinite(width)||width<=0)throw new Error("Invalid native title request.");
  let xml=template.xml;const ids=new Map();
  const fontSize=Math.min(28*height/1080,0.86*width/(0.62*date.length));
  // The native text is centre-aligned. Include its half-width when positioning
  // it near the left edge, including on portrait sequences.
  xml=xml.replace("0.04:0.07",(0.06+0.31*date.length*fontSize/width)+":0.07");
  for(const m of xml.matchAll(/ObjectUID="([^"]+)"/g))ids.set(m[1],uuid());
  xml=xml.replace(/(ObjectUID|ObjectURef)="([^"]+)"/g,(all,key,value)=>`${key}="${ids.get(value)||value}"`);
  xml=xml.replace(/<MZ.Project.GUID>[^<]+</g,"<MZ.Project.GUID>"+uuid()+"<").replaceAll(template.sequenceId,ids.get(template.sequenceId));
  let patched=0;
  xml=xml.replace(/<StartKeyframeValue\b([^>]*)>([\s\S]*?)<\/StartKeyframeValue>/g,(all,attrs,encoded)=>{
    const bytes=textPayload(decode64(encoded),date,fontSize);patched++;
    return `<StartKeyframeValue${attrs.replace(/BinaryHash="[^"]+"/,`BinaryHash="${uuid()}"`)}>${encode64(bytes)}</StartKeyframeValue>`;
  });
  if(patched!==1)throw new Error("Expected one native date payload.");
  xml=xml.replaceAll(template.date,()=>xmlText(date)).replaceAll("Footage Sync Date Template",()=>"Footage Sync Date "+xmlText(date));
  return {bytes:gzip(utf8(xml)),sequenceId:ids.get(template.sequenceId),name:"Footage Sync Date "+date};
}
module.exports={generate,gzip,utf8,decode64,encode64,textPayload};
