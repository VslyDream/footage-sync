"use strict";
const P=require("./paths");
function rule(value){
  if(!value||!["file","folder"].includes(value.kind)||!P.isAbsolute(value.path)||!P.clean(value.path))throw new Error("Choose an absolute file or folder path to ignore.");
  return {kind:value.kind,path:P.clean(value.path)};
}
function matches(path,rules=[]){return Boolean(path)&&rules.some(r=>r.kind==="folder"?P.within(path,r.path):P.key(path)===P.key(r.path));}
function scan(value,rules=[]){return {...value,ignored:matches(value.root,rules),files:(value.files||[]).filter(f=>!matches(f.path,rules)),dirs:(value.dirs||[]).filter(d=>!matches(d.path||P.join(value.root,d.rel),rules)),txts:(value.txts||[]).filter(t=>!matches(t.path,rules))};}
function records(values,links,projectPath,rules=[]){
  return Object.fromEntries(Object.entries(values).map(([id,record])=>{
    const link=links.find(l=>l.id===id),root=link?P.resolve(P.dirname(projectPath),link.folderPath):"";
    return [id,{files:record.files.filter(f=>!matches(f.path,rules)),dirs:record.dirs.filter(d=>!matches(d.path||P.join(root,d.rel),rules))}];
  }));
}
module.exports={rule,matches,scan,records};
