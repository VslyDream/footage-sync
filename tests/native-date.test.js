"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),zlib=require("node:zlib"),{generate,gzip,utf8,decode64}=require("../plugin/core/native-date"),Dates=require("../plugin/core/footage-dates");
test("native date project has valid gzip framing, a unique sequence and the requested fixed-width text",()=>{
  const a=generate("2026-12-31",1080),b=generate("2026-12-31",2160),xml=zlib.gunzipSync(a.bytes).toString("utf8");
  assert.notEqual(a.sequenceId,b.sequenceId);assert.match(xml,new RegExp('ObjectUID="'+a.sequenceId+'"'));assert.match(xml,/<MatchName>AE.ADBE Text<\/MatchName>/);
  const payload=decode64(xml.match(/<StartKeyframeValue[^>]*>([\s\S]*?)<\/StartKeyframeValue>/)[1]);
  assert.equal(Buffer.from(payload).toString("ascii",232,242),"2026-12-31");assert.equal(new DataView(payload.buffer).getFloat32(320,true),28);
  assert.doesNotMatch(xml,/2026-10-27|Game_Name|Draft v0/);
});
test("stored deflate blocks round-trip empty, unicode and multi-block template payloads",()=>{
  for(const text of ["","кириллица 🐜","x".repeat(150000)])assert.equal(zlib.gunzipSync(gzip(utf8(text))).toString("utf8"),text);
});
test("footage dates come from folders and reject invalid, conflicting or absent calendar dates",()=>{
  assert.equal(Dates.folderDate("D:/Media/2026-10-27-Developer/nested/a.mp4"),"2026-10-27");
  for(const path of ["D:/Media/2026-02-30/a.mp4","D:/2026-10-27/2026-10-28/a.mp4","D:/Media/2026-10-27.mp4"])assert.throws(()=>Dates.folderDate(path));
  assert.throws(()=>Dates.folderDate("D:/2026-10-27-and-2026-10-28/a.mp4"));
});
test("full footage range accepts native unset/end-of-last-frame values and rejects trimmed clips",()=>{
  const timing={start:3600,duration:300,fps:30};
  assert.equal(Dates.fullRange({...timing,inPoint:3600,outPoint:3899+29/30}),true);
  assert.equal(Dates.fullRange({...timing,inPoint:-400000,outPoint:-400000}),true);
  assert.equal(Dates.fullRange({...timing,inPoint:3601,outPoint:3900}),false);
  assert.equal(Dates.fullRange({...timing,inPoint:3600,outPoint:3899}),false);
});

test("screenshotted date folders parse independently and missing dates use literal folder labels",()=>{
  for(const date of ["2026-10-15","2026-10-16","2026-06-04"])assert.equal(Dates.folderLabel("L:/Iron Frontier/02_Assets/01_VIDEO/"+date+"/Vasiliy_"+date+"-17-42.mp4").text,date);
  for(const folder of ["Developer Footage","2026-02-30","2026-10-27-and-2026-10-28","Съёмка & тест"]){const label=Dates.folderLabel("D:/Media/"+folder+"/clip.mp4");assert.equal(label.text,folder);assert.equal(label.kind,"folder");}
});

test("native folder text supports variable UTF-8 length while preserving all reference offsets and styling",()=>{
  for(const text of ["A","Developer Footage","Съёмка & <пример> 🎬","price $& folder","x".repeat(255)]){
    const xml=zlib.gunzipSync(generate(text).bytes).toString("utf8"),payload=decode64(xml.match(/<StartKeyframeValue[^>]*>([\s\S]*?)<\/StartKeyframeValue>/)[1]),view=new DataView(payload.buffer),length=view.getUint32(228,true);
    assert.equal(Buffer.from(payload).toString("utf8",232,232+length),text);assert.equal(view.getUint32(0,true),payload.length-12);
    assert.equal(view.getUint32(224,true)+224,300+payload.length-344);
    assert.match(xml,/<MatchName>AE.ADBE Text<\/MatchName>/);assert.doesNotMatch(xml,/<Name>[^<]*<пример>/);
  }
});
