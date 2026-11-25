"use strict";
// Run as an isolated development UXP plugin. root is a new fixture directory.
module.exports = async function measure(root, mediaRoot) {
  const H = require("./runtime/host/premiere");
  const S = require("./runtime/host/sequence");
  const P = require("./runtime/core/paths");
  const fs = require("./runtime/host/io");
  const { Controller } = require("./runtime/controller");
  const { ppro } = H;
  const report = { status: "starting", calls: {}, counters: [] };
  const write = () => fs.writeFile(root + "/result.json", JSON.stringify(report, null, 2), { encoding: "utf-8" });
  const timed = (obj, key) => {
    const original = obj[key];
    obj[key] = async function (...args) {
      const started = Date.now();
      try { return await original.apply(this, args); }
      finally {
        const m = report.calls[key] ||= { calls: 0, ms: 0 };
        m.calls++; m.ms += Date.now() - started;
      }
    };
    return () => { obj[key] = original; };
  };
  const undo = [];
  let timer;
  try {
    await write();
    const source = await ppro.Project.createProject(P.native(root + "/Performance_Footage.prproj"));
    const target = await ppro.Project.createProject(P.native(root + "/Performance_Selects.prproj"));
    if (!await target.importFiles([mediaRoot + "/seed.mp4"], true, await target.getRootItem(), false)) throw Error("Seed import failed");
    const inventory = await H.inventory(target);
    const seed = inventory.clips.find(v => /seed\.mp4$/i.test(v.mediaPath));
    const sequence = await target.createSequenceFromMedia("Performance", [ppro.ClipProjectItem.cast(inventory.handles.get(seed.id))], await target.getRootItem());
    const binding = { projectPath: P.clean(target.path), projectName: target.name, sequenceId: String(sequence.guid), sequenceName: sequence.name };
    const c = new Controller();
    await c.selectProject({ path: source.path });
    c.data.links = [{ id: "fixture", folderPath: mediaRoot + "/Media", binPath: "", binId: null, subfolders: true }];
    c.data.settings.autoMarkers = false;
    await c.selectSequence(binding);
    const batch = await c.scan();
    const expected = batch.changes.filter(v => v.kind === "append-footage");
    if (!expected.length || batch.hasBlocking) throw Error("Expected an actionable timeline batch");
    for (const [obj, key] of [[H, "inventory"], [S, "apply"], [S, "snapshot"], [c, "persist"]]) undo.push(timed(obj, key));
    const start = Date.now();
    let last = start, phase = "", counter = "";
    report.heartbeat = { intervalMs: 50, ticks: 0, maxGapMs: 0 };
    report.status = "applying";
    await write();
    c.onChange(() => {
      const op = c.operation;
      if (op?.phase !== phase || counter !== op?.completed) {
        report.counters.push([Date.now() - start, op?.phase, op?.completed, op?.total, op?.unit]);
        phase = op?.phase; counter = op?.completed;
      }
    });
    timer = setInterval(() => {
      const now = Date.now();
      report.heartbeat.maxGapMs = Math.max(now - last, report.heartbeat.maxGapMs);
      last = now; report.heartbeat.ticks++;
    }, 50);
    await c.apply(batch);
    report.applyMs = Date.now() - start;
    report.heartbeat.maxGapMs = Math.max(Date.now() - last, report.heartbeat.maxGapMs);
    clearInterval(timer);
    while (undo.length) undo.pop()();
    const state = await S.snapshot(binding);
    const audio = await (await sequence.getAudioTrack(0)).getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
    const repeat = await c.scan();
    report.timeline = {
      video: state.video.map(v => [P.basename(v.path), v.start, v.end]),
      audio: audio.length,
      titles: state.titles.map(t => [t.name, t.start, t.end]),
      receipts: state.ledger.imports.map(r => [P.basename(r.path), r.start, r.end, r.fillScale]),
      repeat: repeat.changes.map(v => [v.kind, v.path])
    };
    if (state.video.length !== expected.length + 1 || audio.length !== expected.length + 1 ||
        state.ledger.imports.length !== expected.length || repeat.changes.length) throw Error("Timeline verification failed");
    if (!await source.save() || !await target.save()) throw Error("Could not save fixture projects");
    report.status = "complete";
  } catch (e) {
    report.status = "failed"; report.error = String(e.message || e);
  } finally {
    clearInterval(timer);
    while (undo.length) undo.pop()();
    await write();
  }
};
