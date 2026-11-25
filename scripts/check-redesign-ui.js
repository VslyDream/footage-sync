"use strict";
// Real UI source + simulated host, browser-only regression/visual evidence.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
async function main(){
 const {chromium}=require(process.env.PLAYWRIGHT_PATH||"playwright");
 const browser=await chromium.launch({executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true});
 const out=path.resolve("artifacts/ui-redesign"),page=await browser.newPage({viewport:{width:1200,height:820}}),errors=[],captures=[];
 page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
 const click=async id=>{await page.locator("dialog #"+id).click();};const capture=async name=>{await page.locator("dialog").screenshot({path:path.join(out,name+".png")});captures.push(name);};
 const dialogInterior=async source=>{
   const {x,y,width,height}=await source.locator("dialog").boundingBox();
   // Rounded outer corners show the page behind the dialog.
   return source.screenshot({clip:{x:x+6,y:y+6,width:width-12,height:height-12}});
 };
 try{
  await page.goto("file:///"+path.join(out,"preview.html").replace(/\\/g,"/"));
  await page.locator("#preview-management").click();await page.locator("dialog #tab-links.active").waitFor();await capture("links");
  await click("tab-settings");assert.equal(await page.locator("#mode-MANUAL").count(),0);await click("mode-AUTO");assert.equal(await page.evaluate(()=>fixture.c.data.settings.mode),"AUTO");await capture("settings");
  await click("tab-changes");await page.getByRole("heading",{name:"Up to date",exact:true}).waitFor();await capture("up-to-date");
  await page.evaluate(()=>{const {c}=fixture;c.batch.changes=[{id:"0",kind:"fragmented",path:"D:/Media/Day 01/a.mp4",blocking:true},{id:"1",kind:"fragmented",path:"D:/Media/Day 01/b.mp4",blocking:true},{id:"2",kind:"new-file",path:"D:/Media/Day 01/c.mp4",file:{size:120000}},{id:"3",kind:"append-footage",path:"D:/Media/Day 01/c.mp4",entry:{key:"c"}},{id:"4",kind:"marker-choice",path:"D:/Media/interview.mp4",blocking:true,message:"TXT changed"}];c.batch.hasBlocking=true;c.emit();});
  await capture("changes");await click("decision-all-original");assert.equal(await page.evaluate(()=>fixture.ui.view.changes.selection(fixture.c.batch).decisions["0"]),"original");
  await click("expand-group-0");await capture("changes-expanded");await click("file-more-0");await capture("file-menu");await click("menu-dismiss");
  await click("window-more");await capture("window-menu");await click("menu-item-0");await page.locator("#clip-search").waitFor();await click("cancel");await page.locator("#decision-all-original.selected").waitFor();
  assert.equal(await page.locator("dialog").count(),1);await click("tab-links");await click("add");await page.locator("#folder").waitFor();await capture("add-link");
  await page.locator("#folder input").fill("D:/Media");await click("choose-existing");await page.locator("#project-root").waitFor();await capture("bin-tree");await click("bin-expand-0");await click("bin-select-1");
  await page.waitForFunction(()=>!document.querySelector("#analyze").disabled);await click("browse");await page.locator("#folder").waitFor();assert.equal(await page.locator("#folder input").inputValue(),"D:/Media");assert.match(await page.locator("#choose-existing").textContent(),/Footage\/Video/);await click("cancel");
  await click("sequence-enabled");assert.equal(await page.evaluate(()=>fixture.c.data.settings.sequenceEnabled),false);await click("sequence-enabled");
  await click("link-menu-0");await click("menu-item-1");await page.locator("#folder-nodes").waitFor();await capture("exclude-subfolders");await page.locator("#folder-sync-1 input").uncheck();await click("save-exclusions");await page.waitForFunction(()=>fixture.c.data.ignored.some(r=>r.origin==="excluded"));assert.equal(await page.evaluate(()=>fixture.c.data.ignored[0].origin),"excluded");
  await click("tab-history");await page.evaluate(()=>{const {c}=fixture;c.data.history=[{time:new Date().toISOString(),trigger:"Sync",count:2,duration:4400,status:"completed",project:"Footage",changes:[{kind:"new-file",path:"D:/Media/c.mp4",timeline:true},{kind:"clip-markers",path:"D:/Media/interview.mp4",markers:7}]},{time:new Date().toISOString(),trigger:"Sync",count:1,status:"failed",error:"The project is read-only",stage:"Importing files",changes:[{kind:"new-file",path:"D:/Media/a.mp4"}]}];c.emit();});await click("history-group-0");await capture("history");await click("history-run-1");await capture("history-failed");await click("close");await page.waitForFunction(()=>document.querySelectorAll("dialog").length===0);
  await page.evaluate(()=>{
    const {c,ui}=fixture,root="D:/Motion",ignore=load("./core/ignore");
    const draft={id:"preview",binPath:"Motion",folderPath:"../Motion",relative:true,subfolders:true};
    const files=["Outro/Assets/audio.wav","Intro/Assets/anim.mp4","Outro/Assets/anim.mp4"];
    const batch={...c.batch,links:[draft],next:{},warnings:[],changes:files.map((rel,i)=>({
      id:String(i),kind:"new-file",path:root+"/"+rel,linkId:draft.id,file:{size:12800000}
    })),reused:Array.from({length:372},(_,i)=>({kind:"file",path:root+"/Archive/Day "+i+"/existing.mp4"}))};
    batch.reused.push({kind:"file",path:root+"/Intro/Assets/logo.png"});
    c.scan=async()=>({
      ...batch,
      changes:batch.changes.filter(cg=>!ignore.matches(cg.path,c.data.ignored)).map((cg,i)=>({...cg,id:String(i)})),
      reused:batch.reused.filter(file=>!ignore.matches(file.path,c.data.ignored))
    });
    c.apply=async (reviewed,selected)=>{
      c.data.links=reviewed.links;
      window.previewApplied=reviewed.changes.filter(cg=>selected.includes(cg.id)).map(cg=>cg.path);
    };
    ui.initial([draft]);
  });
  await page.locator(".preview-intro").waitFor();
  assert.match(await page.locator(".preview-intro h1").textContent(),/Motion ↔ \.\.\/Motion/);
  const folder=path=>page.locator('.preview-folder[title="'+path+'"]');
  const toggle=async path=>folder(path).locator("[aria-expanded]").click();
  assert.equal(await folder("D:/Motion/Archive").count(),0);
  assert.equal(await page.locator("#preview-reuse").getAttribute("aria-expanded"),"false");
  for(const parent of ["Intro","Outro"]){await toggle("D:/Motion/"+parent);await toggle("D:/Motion/"+parent+"/Assets");}
  assert.equal(await page.locator(".file-name").filter({hasText:"anim.mp4"}).count(),2);
  assert.match(await folder("D:/Motion/Intro/Assets").textContent(),/1 reused/);
  await page.mouse.move(0,0);
  await page.evaluate(()=>document.activeElement?.blur());
  const staticHtml=await page.evaluate(()=>{
    const dialog=document.querySelector("dialog").cloneNode(true);
    dialog.querySelectorAll("input").forEach(input=>input.toggleAttribute("checked",input.checked));
    return "<!doctype html><html lang=en><meta charset=utf-8><title>New link preview</title><style>"+[...document.querySelectorAll("style")].map(s=>s.textContent).join("\n")+"</style><body>"+dialog.outerHTML+"</body></html>";
  });
  const twinPath=path.join(out,"new-link-preview-tree.html");
  fs.writeFileSync(twinPath,staticHtml);
  const twin=await browser.newPage({viewport:page.viewportSize()});
  try {
    await twin.goto(require("node:url").pathToFileURL(twinPath).href);
    assert.ok((await dialogInterior(twin)).equals(await dialogInterior(page)),"The standalone frame differs inside the live dialog");
    await twin.locator("dialog").screenshot({path:path.join(out,"new-link-preview-tree.png")});
    captures.push("new-link-preview-tree");
  } finally {
    await twin.close();
  }
  await folder("D:/Motion/Intro/Assets").locator(".more").click();
  assert.match(await page.locator("#menu-item-1").textContent(),/Show all 2 files/);
  await click("menu-item-1");
  await page.locator('.reused-file [title="D:/Motion/Intro/Assets/logo.png"]').waitFor();
  await click("preview-reuse");
  await page.locator("#change-1 input").uncheck();
  await toggle("D:/Motion/Intro");assert.equal(await page.locator("#change-1").count(),0);
  await click("preview-reuse");assert.equal(await folder("D:/Motion/Archive").count(),1);await click("preview-reuse");
  await click("group-by-Type");await click("group-by-Folder");await toggle("D:/Motion/Intro");
  assert.equal(await page.locator("#change-1 input").isChecked(),false);
  await folder("D:/Motion/Outro/Assets").locator(".more").click();await click("menu-item-2");
  await page.locator("#ignore-search input").fill("audio.wav");await click("ignore-target-0");
  assert.equal(await page.locator("#ignore-path input").inputValue(),"D:/Motion/Outro/Assets/audio.wav");
  await click("ignore-confirm");await page.locator(".preview-intro").waitFor();
  assert.equal(await page.locator("#change-0 input").isChecked(),false);
  assert.equal(await page.locator("#change-1 input").isChecked(),true);
  assert.equal(await page.locator(".file-name").filter({hasText:"audio.wav"}).count(),0);
  await folder("D:/Motion/Outro/Assets").locator(".more").click();await click("menu-item-0");
  await folder("D:/Motion/Outro/Assets").filter({hasText:"excluded"}).waitFor();
  assert.equal(await page.evaluate(()=>fixture.c.data.ignored.some(r=>r.linkId==="preview")),false);
  assert.equal(await page.locator("#change-0 input").isChecked(),false);
  await click("apply");
  await page.waitForFunction(()=>Array.isArray(window.previewApplied));
  assert.deepEqual(await page.evaluate(()=>window.previewApplied),[]);
  assert.equal(await page.evaluate(()=>fixture.c.data.ignored.some(r=>r.linkId==="preview"&&r.path==="D:/Motion/Outro/Assets")),true);
  await page.waitForFunction(()=>document.querySelectorAll("dialog").length===0);
  await page.evaluate(()=>{const {c,ui}=fixture;c.busy=true;const {Progress}=load('./core/progress');c.operation=new Progress('Sync');c.operation.update('Importing media',{current:'D:/Media/c.mp4',completed:1,total:3});ui.status();});await page.locator(".process-card").waitFor();await capture("changes-syncing");assert.equal(await page.locator("#check-now").evaluate(el=>el.disabled),true);await click("close");
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,"browser-result.json"),JSON.stringify({passed:true,screens:captures.length,captures,checks:["four tabs","autosave","grouped decisions","row and window menus","picker restoration","bin tree","saved exclusions","timeline toggle","single modal","history success/failure","new-link preview","live progress"],errors},null,2));console.log("Browser UI checks passed; screenshots in artifacts/ui-redesign.");
 }catch(e){console.error(await page.evaluate(()=>({error:window.fixture?.c.error,text:document.querySelector('dialog')?.innerText})));await page.screenshot({path:path.join(out,"failure.png")});throw e;}finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
