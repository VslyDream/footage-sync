"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {setup} = require("./helpers/ui");
const {planSync} = require("../plugin/core/planner");

function fixture() {
  const x = setup();
  const root = "D:/Media";
  const draft = {id:"draft", binPath:"Footage", folderPath:"Media", relative:true};
  const existing = Array.from({length:372}, (_, i) => "Archive/Day " + i + "/existing.mp4");
  existing.push("East/Assets/mixed.mp4");
  const fresh = ["East/Assets/new.mp4","West/Assets/Nested/new.mp4","root.wav"];
  const paths = ["", "Archive", "East", "East/Assets", "West", "West/Assets", "West/Assets/Nested",
    ...existing.slice(0,-1).map(file => file.slice(0,file.lastIndexOf("/")))];
  const dirs = paths.map(rel => ({rel, path:rel ? root+"/"+rel : root}));
  const bins = paths.filter(rel => !rel.startsWith("West")).map(rel => ({id:"bin-"+rel, path:rel ? "Footage/"+rel : "Footage"}));
  const clips = existing.map(rel => ({id:"clip-"+rel, mediaPath:root+"/"+rel, parentPath:"Footage/"+rel.slice(0,rel.lastIndexOf("/"))}));
  // Reproduce the normal planner, including changing action IDs after an exclusion.
  x.c.scan = async links => {
    const kept = path => !x.c.data.ignored.some(r => path===r.path || path.startsWith(r.path+"/"));
    const scans = {draft:{root, dirs:dirs.filter(d => kept(d.path)), files:[...existing,...fresh]
      .map(rel => ({rel, path:root+"/"+rel, size:1024})).filter(f => kept(f.path))}};
    return {...planSync({links,scans,inventory:{bins,clips},records:{}}),links,scans,projectPath:x.c.path};
  };
  return {...x,draft};
}

test("new link puts actions first, keeps file and branch selection across folding, reuse details and Type grouping", async () => {
  const {ui,c,draft,log} = fixture();
  const initialBatch = await c.scan([draft]);
  const westIds = initialBatch.changes.filter(change => change.path.includes("West")).map(c => c.id);
  const eastId = initialBatch.changes.find(change => change.path.endsWith("East/Assets/new.mp4")).id;
  ui.interact = async (title,d) => {
    const content = d.querySelector("#management-content");
    const click = async id => {const el=d.querySelector("#"+id);assert.ok(el,id);await el.click();};
    const box = async (id,value) => {const el=d.querySelector("#"+id);assert.ok(el,id);el.checked=value;await el.change();};
    const row = path => {
      const match=content.innerHTML.match(new RegExp('title="'+path+'" style="padding-left:[^"]+">((?:(?!</div></div>).)*?)(?=<div class="group-row|<div style="padding-left|</div></div>|$)'));
      assert.ok(match,path);
      return +/id="preview-(?:check|expand|more)-(\d+)"/.exec(match[1])[1];
    };
    assert.match(content.innerHTML,/373 files already in the project are reused/);
    assert.doesNotMatch(content.innerHTML,/Archive|Day 371/);
    assert.equal(d.querySelector("#change-"+eastId),null);
    await click("preview-expand-"+row("D:/Media/East"));
    await click("preview-expand-"+row("D:/Media/East/Assets"));
    await box("change-"+eastId,false);
    await click("preview-expand-"+row("D:/Media/East"));
    assert.equal(d.querySelector("#change-"+eastId),null);
    await click("preview-expand-"+row("D:/Media/West"));
    await click("preview-expand-"+row("D:/Media/West/Assets"));
    assert.match(content.innerHTML,/West\/Assets\/Nested/);
    await box("preview-check-"+row("D:/Media/West"),false);
    await click("preview-reuse");
    assert.match(content.innerHTML,/Archive/);
    await click("preview-reuse");
    await click("group-by-Type");
    assert.doesNotMatch(content.innerHTML,/Archive/);
    await click("group-by-Folder");
    await click("preview-expand-"+row("D:/Media/East"));
    assert.equal(d.querySelector("#change-"+eastId).checked,false);
    await click("apply");
  };
  await ui.initial([draft]);
  const [,ids] = log.find(entry => entry.apply).apply;
  assert.deepEqual(ids,initialBatch.changes.filter(c => !westIds.includes(c.id) && c.id!==eastId).map(c => c.id));
});
