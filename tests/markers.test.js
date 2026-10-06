"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),{parseMarkers,COLORS}=require("../plugin/core/markers");
test("user TXT example parses seven red source times",()=>{
  const parsed=parseMarkers("0:00:53,1\n0:01:12,1\n0:01:30,1\n0:01:52,1\n0:03:34,1\n0:04:06,1\n0:04:27,1\n");
  assert.deepEqual(parsed.errors,[]);assert.deepEqual(parsed.markers.map(m=>m.seconds),[53,72,90,112,214,246,267]);assert.ok(parsed.markers.every(m=>m.color===1));
});
test("Markerbox indexes and BOM/Windows newlines are retained",()=>{
  assert.deepEqual(COLORS,["green","red","rose","orange","yellow","white","blue","teal"]);
  const parsed=parseMarkers("\uFEFF"+COLORS.map((_,i)=>`1:00:0${i},${i}`).join("\r\n"));
  assert.deepEqual(parsed.markers.map(m=>m.color),[0,1,2,3,4,5,6,7]);assert.equal(parsed.markers[0].seconds,3600);
});
test("bad rows block the entire source with line-specific errors",()=>{
  for(const bad of ["0:00:01,8","0:60:01,1","0:00:60,1","-1:00:00,1","0:00:01.5,1","0:00:01,1,title","0:00:01:12,1","9007199254740991:00:00,1"]){
    const parsed=parseMarkers("0:00:01,1\n"+bad);assert.equal(parsed.markers.length,0);assert.equal(parsed.errors[0].line,2);
  }
});
test("blank marker files cannot be applied",()=>{assert.equal(parseMarkers("\ufeff\r\n  ").errors.length,1);});
test("auto discovery matches the entire TXT basename anywhere in the MP4 basename only in the same folder",()=>{
  const {candidates}=require("../plugin/core/markers"),txts=[{path:"D:/Media/Яблоко.txt"},{path:"D:/Other/Яблоко.txt"},{path:"D:/Media/банан.txt"}];
  for(const name of ["Яблоко банан","яблоко 2","2 яблоко","Яблоко_repack"]){const found=candidates("D:/Media/"+name+".MP4",txts);assert.ok(found.some(t=>t.path===txts[0].path));assert.ok(!found.some(t=>t.path===txts[1].path));}
  assert.equal(candidates("D:/Media/Яблоко.mov",txts).length,0);assert.equal(candidates("D:/Media/Яблоко банан.mp4",txts).length,2);
});
