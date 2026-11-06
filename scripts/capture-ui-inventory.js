"use strict";
// Local documentation renderer. Uses the current runtime UI with simulated host data.
// No Premiere project, installed plugin, source media or user settings are accessed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/ui-inventory-2026-11-04');
const scenarios=[
 ['review-safe-ten','Review — 10 new footage files','review','safe'],
 ['review-mixed-ten','Review — 10 footage files, MP4 decisions and warnings','review','mixed'],
 ['review-original','Review — Import original selected','review','mixed','original'],
 ['review-later','Review — Deferred for this sync','review','mixed','later'],
 ['review-markers','Review — changed TXT, Replace / Add / Skip','review','markers'],
 ['review-marker-selected','Review — Add to existing selected','review','markers','marker'],
 ['review-sequence-error','Review — unavailable sequence destination','review','sequence-error'],
 ['review-sequence-recovery','Review — interrupted sequence append','review','sequence-review'],
 ['review-sequence-keep','Review — Keep current sequence selected','review','sequence-review','keep'],
 ['review-conflicts','Review — conflict, unavailable folder, media error','review','conflicts'],
 ['review-moves','Review — rename, move, folder and existing-item reconciliation','review','moves'],
 ['review-empty','Review — no changes','review','empty'],
 ['initial-ten','Initial Sync — 10 files, existing media reused','initial','safe'],
 ['initial-blocking','Initial Sync — mixed batch with warnings','initial','mixed'],
 ['initial-reused','Initial Sync — all media already imported','initial','empty'],
 ['status-clean','Status — up to date','status','empty'],
 ['status-pending','Status — 10 new footage files','status','safe'],
 ['status-attention','Status — blocking MP4 and TXT warnings','status','mixed'],
 ['status-unavailable','Status — unavailable source','status','conflicts'],
 ['status-txt-warning','Status — TXT warning without blocking media','status','txt'],
 ['status-progress','Status — importing, counters and warnings','status','progress'],
 ['status-waiting','Status — waiting on host','status','waiting'],
 ['status-failed','Status — failed operation','status','failed'],
 ['status-completed','Status — operation completed','status','completed'],
 ['links','Links — active, paused, root and long paths','management','safe'],
 ['links-empty','Links — empty','management','empty','empty-links'],
 ['settings','Settings — ASK / ASK and ignore entry','management','empty','settings'],
 ['ignore-list','Ignored paths — file and folder rules','ignoredPaths','empty'],
 ['ignore-file','Ignore — file scope','ignorePath','empty'],
 ['ignore-folder','Ignore — folder and future children','ignorePath','empty','folder'],
 ['add-link','Add link — two entry flows','add','empty'],
 ['existing-link','Link existing bin — empty form','existing','empty'],
 ['edit-link','Edit existing link','existing','empty','edit'],
 ['existing-validation','Link existing bin — required fields','existing','empty','validation'],
 ['matching','Create matching bins — initial state','matching','empty'],
 ['bin-picker','Choose Premiere bin — hierarchy collapsed','chooseBin','empty'],
 ['bin-picker-expanded','Choose Premiere bin — hierarchy expanded','chooseBin','empty','expand'],
 ['project-picker','Choose import project','chooseProject','empty'],
 ['sequence-picker','Choose Footage sequence','chooseSequence','empty'],
 ['marker-picker','Add markers — matching source selected','addMarkers','safe'],
 ['marker-no-match','Add markers — explicit selection required','addMarkers','safe','no-match'],
 ['error','General error — non-destructive assurance','error','empty'],
 ['panel-clean','Main Panel — vertical idle','panel','empty'],
 ['panel-attention','Main Panel — count and attention','panel','mixed'],
 ['panel-busy','Main Panel — sync spinner','panel','progress'],
 ['panel-horizontal','Main Panel — horizontal with pending count','panel','safe','horizontal']
];
function setup(s){
 const [id,title,method,kind,action]=s;
 return `
 const cfg=${JSON.stringify({id,title,method,kind,action})};
 document.querySelectorAll('body > h1,body > p,body > button').forEach(e=>e.remove());
 const {c,ui}=fixture; c.data.settings={...c.data.settings,mode:'ASK',mp4:'ASK',warnings:true,success:false,autoMarkers:true,sequenceEnabled:true};
 c.data.links=[{id:'link',binPath:'Footage/Video',folderPath:'D:/Media',subfolders:true,relative:false,paused:false},{id:'audio',binPath:'Footage/Audio',folderPath:'D:/Production/Shared production assets/Audio and music',subfolders:true,relative:false,paused:true},{id:'root',binPath:'',folderPath:'../Root media',relative:true,subfolders:false,paused:false}];
 c.data.ignored=[{kind:'file',path:'D:/Media/2026-11-03/Camera_B_incomplete.mp4'},{kind:'folder',path:'D:/Media/Cache and temporary exports'}];
 const files=Array.from({length:10},(_,i)=>({id:'f'+i,kind:'new-file',path:'D:/Media/2026-11-03/'+['Interview_Camera_A_take_01.mp4','Interview_Camera_B_take_01.mp4','B-roll_factory_wide_01.mp4','B-roll_assembly_detail_02.mp4','Интервью_дубль_03.mp4','Drone_exterior_04.mp4','Long_footage_name_with_production_notes_and_camera_metadata_take_05.mp4','B-roll_workers_06.mp4','Interview_pickup_07.mp4','Closing_exterior_08.mp4'][i],blocking:false,linkId:'link',message:i===6?'New footage will be imported into the bin matching its disk folder.':''}));
 files[7].path='D:/Media/Behind the scenes/B-roll_workers_06.mp4';
 c.data.history=[{time:'2026-11-04T09:00:00+03:00',message:'Sync completed',count:2}];
 let changes=files.map(x=>({...x})),warnings=[],sequenceWarnings=[];
 if(cfg.kind==='mixed') { changes[1]={...changes[1],kind:'fragmented',blocking:true,message:'Fragmented MP4 detected. Choose Import original or defer this file for the current sync.'};changes[4]={...changes[4],kind:'fragmented',blocking:true,message:'Fragmented MP4 requires a decision before the dependent footage and title append.'}; changes.push({id:'a1',kind:'append-footage',path:changes[1].path,blocking:false,message:'Append source video to V1/A1 and native date text to V2.'});warnings=[{txtPath:'D:/Media/2026-11-03/Interview.txt',message:'Line 4: Invalid color index 9. Expected a color index from 0 to 7.'}];sequenceWarnings=[{path:files[7].path,message:'No ISO date found in the folder name. The literal folder name will be used for the title.'}]; }
 if(cfg.kind==='markers'){changes=files.slice(0,3);changes.push({id:'marker',kind:'marker-choice',path:files[0].path,blocking:true,message:'The marker TXT has changed since the last import. Choose how to handle existing source clip markers.'});}
 if(cfg.kind.startsWith('sequence-'))changes=[...files,{id:'seq',kind:cfg.kind,path:files[0].path,checkpoint:cfg.kind==='sequence-review',blocking:true,message:cfg.kind==='sequence-error'?'The saved Footage sequence destination is unavailable. Open its project or import files only.':'The previous append was interrupted or undone. Confirm whether to append again or keep the current sequence.'}];
 if(cfg.kind==='conflicts')changes=[...files.slice(0,3),{id:'conflict',kind:'conflict',path:files[3].path,blocking:true,message:'Multiple existing items match this media. Resolve the source or link, then scan again.'},{id:'offline',kind:'unavailable',path:'L:/Production/Offline camera card',blocking:true,message:'The source folder is unavailable. Nothing was removed from Premiere.',linkId:'offline'},{id:'invalid',kind:'media-error',path:files[4].path,blocking:true,message:'Media header could not be read. The file may still be copying.'}];
 if(cfg.kind==='moves')changes=[{id:'folder',kind:'new-folder',path:'Footage/Video/2026-11-04',message:'Create the matching Premiere bin.'},{id:'rename',kind:'rename-file',path:files[0].path,from:'D:/Media/2026-11-03/Camera_A_original.mp4',message:'Relink the existing Project Item without creating a duplicate.'},{id:'move',kind:'move-file',path:files[1].path,from:'D:/Media/Unsorted/Interview_Camera_B_take_01.mp4',message:'Move and relink the existing item.'},{id:'fm',kind:'folder-move',path:'Footage/Video/2026-11-03',from:'Footage/Video/Unsorted',message:'Rename or move the managed bin.'},{id:'ri',kind:'reconcile-item',path:files[2].path,message:'Return the existing item to the bin dictated by disk structure.'}];
 if(['empty','txt','progress','waiting','failed','completed'].includes(cfg.kind))changes=[];
 if(cfg.kind==='txt')warnings=[{txtPath:'D:/Media/2026-11-03/Interview.txt',message:'Line 4: Invalid color index 9. The entire TXT was skipped.'}];
 c.batch={changes,warnings,sequenceWarnings,media:files.map((f,i)=>({path:f.path,name:f.path.split('/').pop(),itemId:'clip-'+i,projectPath:c.path,projectId:'preview',markerState:['mixed','markers'].includes(cfg.kind)&&i<2?'pending':'none'})),reused:Array.from({length:cfg.kind==='empty'?10:3},()=>({kind:'file'})),links:c.data.links,projectPath:c.path,projectId:'preview',hasBlocking:changes.some(x=>x.blocking)};
 fixture.setPicked({nativePath:cfg.action==='no-match'?'D:/Media/Unmatched_notes.txt':'D:/Media/Interview_Camera_A_take_01.txt'});
 if(['progress','waiting','failed','completed'].includes(cfg.kind)){c.busy=!['failed','completed'].includes(cfg.kind);c.operation=new (load('./core/progress').Progress)('Sync');c.operation.startedAt-=43000;c.operation.update('Importing media',{current:files[6].path,completed:6,total:10});if(cfg.kind==='progress')c.operation.warn('Line 4: Invalid color index. Video import can continue.','D:/Media/Interview.txt');if(cfg.kind==='waiting'){c.operation.phase='Waiting for Premiere import';c.operation.updatedAt-=21000;}if(cfg.kind==='failed'){c.operation.finish('Premiere could not complete the import. Check the source and retry.');c.error='The last Sync did not finish.';}if(cfg.kind==='completed'){c.operation.update('Sync completed',{completed:10,total:10});c.operation.finish();}}
 if(cfg.method==='panel'){const host=document.createElement('div');host.innerHTML=${JSON.stringify(fs.readFileSync(path.join(root,'plugin/index.html'),'utf8').match(/<main[\s\S]*<\/main>/)[0])};document.body.append(host);const el=document.querySelector('#main-panel');el.style.cssText='position:relative;width:'+(cfg.action==='horizontal'?280:52)+'px;height:'+(cfg.action==='horizontal'?54:262)+'px';ui.start();}
 else if(cfg.method==='initial')ui.initial([{id:'draft',binPath:'Footage/New camera',folderPath:'D:/New camera',subfolders:true}]);
 else if(cfg.method==='ignorePath')ui.ignorePath(cfg.action==='folder'?'D:/Media/2026-11-03':'D:/Media/2026-11-03/Camera_B_incomplete.mp4',cfg.action==='folder'?'folder':'file');
 else if(cfg.method==='existing')ui.existing(cfg.action==='edit'?c.data.links[0]:null);
 else if(['review','addMarkers'].includes(cfg.method))ui[cfg.method](c.batch);
 else if(cfg.method==='error')ui.error('The source folder cannot be accessed. Check that the drive is connected, then try again.');
 else {if(cfg.action==='empty-links')c.data.links=[];ui[cfg.method]();}
 window.captureAction=()=>{const d=document.querySelector('dialog');if(cfg.action==='settings')ui.settingsView(d);if(cfg.action==='original')document.querySelector('#original-f1').click();if(cfg.action==='later')document.querySelector('#skip-f1').click();if(cfg.action==='marker')document.querySelector('#marker-append-marker').click();if(cfg.action==='keep')document.querySelector('#sequence-keep-seq').click();if(cfg.action==='expand')document.querySelector('#expand-bin-0').click();if(cfg.action==='validation')document.querySelector('#analyze').click();};
 setTimeout(()=>{window.captureAction();window.captureReady=true},0);
 `;
}
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const pwPath=process.env.PLAYWRIGHT_PATH;if(!pwPath)throw Error('Set PLAYWRIGHT_PATH to the installed playwright package');
 const {chromium}=require(pwPath),browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const manifest={date:'2026-11-04',type:'Current runtime UI / browser rendering / simulated host data',nativeAcceptance:false,sources:{},scenarios:[]};
 for(const name of ['plugin/ui.js','plugin/style.css','plugin/main-panel.js','plugin/index.html','scripts/preview-ui.js'])manifest.sources[name]=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex');
 try{for(const s of scenarios){
  const html=require('./preview-ui').html
   .replace("this.input.type='checkbox';","this.input.type='checkbox';this.input.disabled=this.hasAttribute('disabled');")
   .replaceAll('set disabled(v){this.input.disabled=v}', 'get disabled(){return this.input.disabled}set disabled(v){this.input.disabled=v}')
   .replace('</script>','{'+setup(s)+'}</script>');
  fs.writeFileSync(path.join(out,s[0]+'.html'),html);
  const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1,locale:'en-US',timezoneId:'Europe/Moscow'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent(html);await page.waitForTimeout(80);if(errors.length)throw Error(s[0]+': '+errors.join('; '));await page.waitForFunction(()=>window.captureReady);
  const target=page.locator(s[2]==='panel'?'#main-panel':'dialog[open]');await target.waitFor();
  const metrics=await page.evaluate(()=>{const b=document.querySelector('dialog .body');return b?{height:b.clientHeight,total:b.scrollHeight}:{height:0,total:0}});
  const shots=[];const count=metrics.height?Math.max(1,Math.ceil((metrics.total-metrics.height)/(metrics.height-35))+1):1;
  for(let i=0;i<count;i++){if(metrics.height)await page.evaluate(y=>document.querySelector('dialog .body').scrollTop=y,i*(metrics.height-35));const file=s[0]+(count>1?'-'+String(i+1).padStart(2,'0'):'')+'.png';await target.screenshot({path:path.join(out,file)});shots.push(file);}
  const text=await target.innerText();fs.writeFileSync(path.join(out,s[0]+'.txt'),text);
  if(errors.length)throw Error(s[0]+': '+errors.join('; '));
  manifest.scenarios.push({id:s[0],title:s[1],method:s[2],data:s[3],action:s[4]||null,metrics,shots});await page.close();console.log(s[0]+': '+shots.length+' screenshots');
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
 const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
 fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><meta charset="utf-8"><title>Footage Sync — UI inventory 2026-11-04</title><style>body{margin:30px;background:#171719;color:#eee;font:15px Arial}a{color:#93c8ff}nav{display:flex;flex-wrap:wrap;gap:12px}section{margin:40px 0}img{max-width:100%;display:block;margin:14px 0;border:1px solid #555}p{color:#b5b5bc}h2{font-size:20px}</style><h1>Footage Sync · интерфейс на 04.11.2026</h1><p>Текущий runtime-код, браузерный рендер, демонстрационные данные. Spectrum controls приближены стендом. Это не native UXP acceptance и не новое визуальное утверждение. Размеры окон и прокрутка сохранены; высокие экраны показаны несколькими снимками.</p><nav>${manifest.scenarios.map(s=>`<a href="#${s.id}">${esc(s.title)}</a>`).join('')}</nav>${manifest.scenarios.map(s=>`<section id="${s.id}"><h2>${esc(s.title)}</h2><p><a href="${s.id}.html">Открыть зафиксированный стенд</a> · <a href="${s.id}.txt">Текст экрана</a></p>${s.shots.map((f,i)=>`<a href="${f}"><img loading="lazy" src="${f}" alt="${esc(s.title)} — ${i+1}"></a>`).join('')}</section>`).join('')}`);
 console.log(JSON.stringify({out,scenarios:manifest.scenarios.length,screenshots:manifest.scenarios.reduce((n,s)=>n+s.shots.length,0)}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
