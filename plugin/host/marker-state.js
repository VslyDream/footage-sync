"use strict";
const ppro=require("premierepro"),{XMPMeta}=require("uxp").xmp;
const NS="http://ns.adobe.com/premierePrivateProjectMetaData/1.0/",FIELD="FootageSyncMarkerImports";
async function read(item) {
  const xml=await ppro.Metadata.getProjectMetadata(item),meta=new XMPMeta(xml),value=meta.getProperty(NS,FIELD)?.value;
  const ledger=value?JSON.parse(String(value)):{version:1,imports:[]};
  if(ledger.version!==1||!Array.isArray(ledger.imports)||ledger.imports.some(r=>typeof r.sourceKey!=="string"||typeof r.signature!=="string")||ledger.pending&&(!Array.isArray(ledger.pending.names)||!Array.isArray(ledger.pending.rows)||ledger.pending.names.length!==ledger.pending.rows.length||!Array.isArray(ledger.pending.baseline)))throw new Error("Clip marker import state is invalid. Existing markers were preserved.");
  return {xml,ledger};
}
async function prepare(item,ledger) {
  await ppro.Metadata.addPropertyToProjectMetadataSchema(FIELD,"Footage Sync marker imports",ppro.Constants.MetadataType.TEXT);
  const meta=new XMPMeta(await ppro.Metadata.getProjectMetadata(item));meta.setProperty(NS,FIELD,JSON.stringify(ledger));
  const xml=meta.serialize();return ()=>ppro.Metadata.createSetProjectMetadataAction(item,xml,[FIELD]);
}
async function verify(item,ledger) {
  const expected=JSON.stringify(ledger);
  // Project metadata can remain stale briefly after executeTransaction in 25.6.2.
  // Retry reads only; never replay a marker or metadata mutation.
  for(let attempt=0;attempt<11;attempt++) {
    if(JSON.stringify((await read(item)).ledger)===expected)return true;
    if(attempt<10)await new Promise(resolve=>setTimeout(resolve,100));
  }
  return false;
}
// Column values are ticks, not the formatted timecode returned by getProjectMetadata.
async function timing(item) {
  const columns=JSON.parse(await ppro.Metadata.getProjectColumnsMetadata(item));
  const ticks=id=>{const raw=columns.find(c=>c.ColumnID==="Column.Intrinsic."+id)?.ColumnValue;return raw!==undefined&&/^-?\d+$/.test(String(raw))?Number(raw)/254016000000:NaN;};
  const duration=ticks("MediaDuration"),start=ticks("MediaStart");
  if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(start))throw new Error("Premiere did not provide source timing. Marker TXT was skipped.");
  return {start,duration};
}
module.exports={read,prepare,verify,timing};
