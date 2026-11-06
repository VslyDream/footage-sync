"use strict";
const P=require("./paths");

function binRows(bins,expanded) {
  const children=new Map();
  for(const bin of bins) {
    const parent=bin.parentPath??P.dirname(bin.path);
    if(!children.has(parent))children.set(parent,[]);
    children.get(parent).push(bin);
  }
  const rows=[];
  function visit(parent,depth) {
    for(const bin of children.get(parent)||[]) {
      rows.push({bin,depth,hasChildren:Boolean(children.get(bin.path)?.length)});
      if(expanded.has(bin.id))visit(bin.path,depth+1);
    }
  }
  visit("",0);return rows;
}

function markerTargets(media,txtPath) {
  const stem=path=>P.basename(path).replace(/\.[^.]+$/,"").toLowerCase();
  const name=stem(txtPath),folder=P.key(P.dirname(txtPath));
  const ranked=media.filter(m=>m.path).map(entry=>{
    const names=[stem(entry.path),stem(entry.name||"")];
    const match=names.includes(name)?2:names.some(n=>name&&n.includes(name))?1:0;
    return {entry,score:match?match*2+Number(P.key(P.dirname(entry.path))===folder):0};
  }).sort((a,b)=>b.score-a.score||a.entry.path.localeCompare(b.entry.path));
  const suggested=ranked[0]?.score>0&&ranked[0].score!==ranked[1]?.score?ranked[0].entry:null;
  return {ranked,suggested};
}
module.exports={binRows,markerTargets};
