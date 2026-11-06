"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {binRows,markerTargets}=require("../plugin/core/ui-data");

test("bin children are hidden until every ancestor is expanded and collapse restores the top level",()=>{
  const bins=[{id:"a",name:"A",path:"A",parentPath:""},{id:"b",name:"B",path:"A/B",parentPath:"A"},{id:"c",name:"C",path:"A/B/C",parentPath:"A/B"},{id:"d",name:"D",path:"D",parentPath:""}];
  const open=new Set();assert.deepEqual(binRows(bins,open).map(r=>r.bin.id),["a","d"]);
  open.add("b");assert.deepEqual(binRows(bins,open).map(r=>r.bin.id),["a","d"]);
  open.add("a");assert.deepEqual(binRows(bins,open).map(r=>[r.bin.id,r.depth]),[["a",0],["b",1],["c",2],["d",0]]);
  open.delete("a");assert.deepEqual(binRows(bins,open).map(r=>r.bin.id),["a","d"]);
});

test("manual marker matching prefers exact names, uses folder as tie breaker and supports Cyrillic",()=>{
  const media=[{itemId:"1",path:"D:/A/Яблоко банан.mp4"},{itemId:"2",path:"D:/A/ЯБЛОКО.mp4"},{itemId:"3",path:"D:/B/яблоко.mp4"}];
  assert.equal(markerTargets(media,"D:/A/яблоко.txt").suggested.itemId,"2");
  assert.equal(markerTargets([media[0]],"D:/A/яблоко.txt").suggested.itemId,"1");
});

test("ambiguous names and no match do not choose a target silently",()=>{
  const media=[{path:"D:/Media/one.mp4"},{path:"D:/Media/one.mov"}];
  assert.equal(markerTargets(media,"D:/Markers/one.txt").suggested,null);
  assert.equal(markerTargets(media,"D:/Markers/unrelated.txt").suggested,null);
});

test("existing renamed Project Items can be suggested by their visible names",()=>{
  const media=[{path:"D:/Media/A001.mp4",name:"Interview"}];
  assert.equal(markerTargets(media,"D:/Markers/interview.txt").suggested,media[0]);
});
