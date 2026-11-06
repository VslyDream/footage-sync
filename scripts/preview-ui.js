"use strict";
// Browser-only review fixture: real UI source, fake Premiere/UXP data, no project mutations.
const fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const sources={};
for(const name of ["core/paths","core/footage-dates","core/ignore","core/ui-data","core/panel-layout","core/progress","main-panel","ui"])sources["./"+name]=fs.readFileSync(path.join(__dirname,"../plugin",name+".js"),"utf8");
const css=fs.readFileSync(path.join(__dirname,"../plugin/style.css"),"utf8");
const html=`<!doctype html><meta charset="utf-8"><title>Footage Sync · UI review fixture</title><style>${css}
body{padding:24px}button{margin:8px;padding:12px;background:#303034;color:#eee;border:1px solid #555;border-radius:4px}dialog{position:fixed;inset:0;margin:auto}sp-button{display:inline-block;padding:9px 14px;background:#353539;border:1px solid #555;border-radius:4px;text-align:center;cursor:pointer}sp-button[variant=cta]{background:#2671c4}sp-button[disabled]{opacity:.5;pointer-events:none}sp-textfield{display:block}sp-textfield input{box-sizing:border-box;width:100%;padding:9px;background:#1e1e22;color:#eee;border:1px solid #555;border-radius:4px}sp-checkbox{display:inline-flex;align-items:center;margin-top:10px}sp-checkbox input{margin-right:6px}.preview-note{max-width:700px}</style>
<h1>Footage Sync · UI review fixture</h1><p class="preview-note">Browser rendering of current plugin UI with simulated data. No Premiere API, disk picker or media changes. This is not native UXP acceptance.</p>
<button id="preview-management">Import and sequence targets</button><button id="preview-bin">Choose Premiere bin</button><button id="preview-link">Link existing bin</button><button id="preview-markers">Add markers</button><button id="preview-status">Live progress</button>
<script>
customElements.define('sp-button',class extends HTMLElement{get disabled(){return this.hasAttribute('disabled')}set disabled(v){this.toggleAttribute('disabled',!!v)}});
customElements.define('sp-textfield',class extends HTMLElement{connectedCallback(){this.input=document.createElement('input');this.input.value=this.getAttribute('value')||'';this.input.placeholder=this.getAttribute('placeholder')||'';this.append(this.input)}get value(){return this.input.value}set value(v){this.input.value=v}set disabled(v){this.input.disabled=v}});
customElements.define('sp-checkbox',class extends HTMLElement{connectedCallback(){this.input=document.createElement('input');this.input.type='checkbox';this.input.checked=this.hasAttribute('checked');this.prepend(this.input)}get checked(){return this.input.checked}set checked(v){this.input.checked=v}set disabled(v){this.input.disabled=v}});
const nativeClose=HTMLDialogElement.prototype.close;
HTMLDialogElement.prototype.close=function(value){this.result=value;nativeClose.call(this)};
HTMLDialogElement.prototype.uxpShowModal=function(){this.showModal();return new Promise(resolve=>this.addEventListener('close',()=>resolve(this.result),{once:true}))};
const sources=${JSON.stringify(sources).replace(/</g,"\\u003c")},cache={};
const bins=[{id:'footage',name:'Footage',path:'Footage',parentPath:''},{id:'video',name:'Video',path:'Footage/Video',parentPath:'Footage'},{id:'day',name:'Day 01',path:'Footage/Video/Day 01',parentPath:'Footage/Video'},{id:'audio',name:'Audio',path:'Footage/Audio',parentPath:'Footage'},{id:'exports',name:'Exports',path:'Exports',parentPath:''}];
const project={name:'Footage.prproj',guid:'preview',path:'D:/Production/Footage.prproj'};
let picked={nativePath:'D:/Media/Interview.txt'};
const media=[{path:'D:/Media/Interview.mp4',name:'Interview.mp4',itemId:'clip-1',projectPath:project.path,projectId:'preview'},{path:'D:/Media/B-roll.mp4',name:'B-roll.mp4',itemId:'clip-2',projectPath:project.path,projectId:'preview'}];
const c={project,path:project.path,workspace:{importProject:project},busy:false,dialogOpen:false,error:null,data:{settings:{sequenceTarget:{projectName:'Selects.prproj',projectPath:'D:/Production/Selects.prproj',sequenceName:'Footage',sequenceId:'preview-sequence'}},links:[{id:'link',binPath:'Footage/Video',folderPath:'D:/Media'}],history:[{time:new Date().toISOString(),message:'Sync completed',count:2}]},batch:{changes:[],warnings:[],media},listeners:[],onChange(fn){this.listeners.push(fn)},emit(){this.listeners.forEach(fn=>fn())},async context(){return project},async selectProject(p){this.workspace.importProject=p},async selectSequence(s){this.data.settings.sequenceTarget=s},async scan(){return this.batch},async persist(){},async chooseMarkers(entry,txt){window.savedSelection={entry,txt}},async apply(){},async analyze(){return this.batch}};
function load(name){if(name==='uxp')return {storage:{localFileSystem:{async getFileForOpening(){return picked},async getFolder(){return {nativePath:'D:/Media'}}}}};if(name==='./host/premiere')return {async inventory(){return {bins}},async openProjects(){return [{...project,async getSequences(){return [{name:'Footage',guid:'preview-sequence'}]}}]}};if(name==='fs'||name==='./host/io')return {};if(cache[name])return cache[name].exports;const m={exports:{}};cache[name]=m;new Function('require','module','exports',sources[name])((id)=>load(name.startsWith('./core/')?'./core/'+id.slice(2):id),m,m.exports);return m.exports}
const originalLoad=load;load=function(name){return name==='./host/sequence'?{async context(){return {}}}:originalLoad(name)};
c.setSequenceEnabled=async value=>{c.data.settings.sequenceEnabled=value};
c.data.ignored=[];c.setIgnored=async (value,remove=false)=>{c.data.ignored=remove?c.data.ignored.filter(r=>r.path!==value.path||r.kind!==value.kind):c.data.ignored.concat(value)};
const {UI}=load('./ui'),{Progress}=load('./core/progress'),ui=new UI(c);window.fixture={ui,c,bins,media,setPicked(value){picked=value}};
document.querySelector('#preview-management').onclick=()=>ui.management();
document.querySelector('#preview-bin').onclick=()=>ui.chooseBin();
document.querySelector('#preview-link').onclick=()=>ui.existing();
document.querySelector('#preview-markers').onclick=()=>ui.addMarkers(c.batch);
document.querySelector('#preview-status').onclick=()=>{c.busy=true;c.operation=new Progress('Sync');c.operation.startedAt-=23000;c.operation.update('Importing media',{current:'D:/Media/Interview.mp4',completed:2,total:5});c.operation.warn('Line 4: Invalid color index. Video import can continue.','D:/Media/B-roll.txt');ui.status()};
</script>`;
module.exports={html};
if(require.main===module) {
  if(process.argv[2]==="--write") {
    fs.writeFileSync(process.argv[3],html,"utf8");console.log("Wrote standalone UI review fixture.");
  } else {
    const server=http.createServer((req,res)=>{res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});res.end(html);});
    server.listen(4318,"127.0.0.1",()=>console.log("UI review fixture: http://127.0.0.1:4318 (Ctrl+C to stop)"));
  }
}
