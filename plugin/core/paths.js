"use strict";
function clean(value) {
  let path = String(value || "").replace(/\\/g, "/");
  // Premiere returns extended Windows paths; normalize them before comparing
  // with ordinary filesystem paths or computing a project-relative location.
  if (/^\/\/\?\/UNC\//i.test(path)) path = "//" + path.slice(8);
  else if (/^\/\/\?\/[a-z]:\//i.test(path)) path = path.slice(4);
  const prefix = path.startsWith("//") ? "//" : path.startsWith("/") ? "/" : "";
  const parts = [];
  for (const part of path.slice(prefix.length).split("/")) {
    if (!part || part === ".") continue;
    if (part === ".." && parts.length && parts[parts.length - 1] !== ".." && !parts[parts.length - 1].endsWith(":")) parts.pop();
    else parts.push(part);
  }
  const result=prefix+parts.join("/");
  return /^[a-z]:\//i.test(path) && parts.length===1 ? result+"/" : result;
}
function key(value) { const p = clean(value); return /^(?:[a-z]:|\/\/)/i.test(p) ? p.toLowerCase() : p; }
function join(...parts) { return clean(parts.filter(Boolean).join("/")); }
function dirname(p) { p = clean(p); const i=p.lastIndexOf("/"); return i<0?"":i===2 && /^[a-z]:\//i.test(p)?p.slice(0,3):p.slice(0,i)||"/"; }
function basename(p) { return clean(p).split("/").pop(); }
function isAbsolute(p) { return /^(?:[a-z]:[\\/]|[\\/])/i.test(p); }
function resolve(base, value) { return isAbsolute(value) ? clean(value) : join(base, value); }
function relative(base, path) {
  const a = clean(base).replace(/\/$/,"").split("/"); const b = clean(path).replace(/\/$/,"").split("/");
  const volume=p=>p[0]==="" && p[1]==="" ? p.slice(0,4).join("/") : p[0];
  if (key(volume(a)) !== key(volume(b))) throw new Error("Relative paths require the folder and project to be on the same volume.");
  const windows=/^(?:[a-z]:|\/\/)/i.test(clean(base)), compare=v=>windows?v.toLowerCase():v;
  let i = 0; while (i < a.length && i < b.length && compare(a[i]) === compare(b[i])) i++;
  return Array(a.length - i).fill("..").concat(b.slice(i)).join("/") || ".";
}
function within(child, parent) { const root=key(parent).replace(/\/$/,""); return key(child)===key(parent) || key(child).startsWith(root+"/"); }
function native(path) { const p=clean(path); return /^(?:[a-z]:|\/\/)/i.test(p)?p.replace(/\//g,"\\"):p; }
module.exports = { clean, key, join, dirname, basename, isAbsolute, resolve, relative, within, native };
