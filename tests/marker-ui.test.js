"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),{setup}=require('./helpers/ui');
test('window TXT picker saves the exact clip only after confirmation',async()=>{const x=setup();x.ui.interact=async(title,d)=>{assert.equal(x.log[0],'picker');await d.querySelector('#use-clip').click();};await x.ui.addMarkers(x.c.batch);assert.deepEqual(x.log.find(v=>v.selection).selection,[x.entry,'D:/Media/interview.txt']);});
test('row TXT flow confirms the already selected clip and Cancel saves nothing',async()=>{const x=setup();x.ui.interact=async(title,d)=>{assert.match(d.innerHTML,/Source clip: interview.mp4/);assert.equal(d.querySelector('#clip-search'),null);await d.querySelector('#cancel').click();};await x.ui.addMarkers(x.c.batch,x.entry);assert.equal(x.log.some(v=>v.selection),false);});
test('ambiguous names require an explicit source clip selection',async()=>{const x=setup();x.c.batch.media.push({...x.entry,path:'D:/Media/interview.mov',itemId:'other'});x.ui.interact=async(title,d)=>{assert.equal(d.querySelector('#use-clip').disabled,true);await d.querySelector('#cancel').click();};await x.ui.addMarkers(x.c.batch);assert.equal(x.log.some(v=>v.selection),false);});
test('cancelled native TXT picker opens no dialog and saves nothing',async()=>{const x=setup({picked:null});await x.ui.addMarkers(x.c.batch);assert.deepEqual(x.log,['picker']);assert.equal(x.c.dialogOpen,false);});
test("closing Changes acknowledges displayed empty TXT warnings while opening only Links preserves them",async()=>{
 const x=setup(),warning={path:x.entry.path,txtPath:"D:/Media/interview.txt",message:"Marker TXT is empty.",emptyVersion:"version",itemId:"clip"};
 x.c.batch.warnings=[warning];
 x.c.acknowledgeMarkerWarnings=async batch=>{if(batch)x.log.push({reviewed:batch});};
 x.ui.interact=async(_title,d)=>{await d.querySelector("#close").click();};
 await x.ui.management();
 assert.equal(x.log.some(event=>event.reviewed),false);
 x.ui.interact=async(_title,d)=>{assert.match(d.querySelector("#management-content").innerHTML,/Marker TXT is empty/);await d.querySelector("#close").click();};
 await x.ui.status();
 assert.equal(x.log.find(event=>event.reviewed).reviewed,x.c.batch);
});
