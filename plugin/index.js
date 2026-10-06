"use strict";
const {entrypoints}=require("uxp"), {Controller}=require("./controller"), {UI}=require("./ui");
const controller=new Controller(); let ui;
function init() {
  if(!ui && document.querySelector("#main-panel")) { ui=new UI(controller); ui.start(); controller.start(); controller.scan().catch(e=>{controller.error=e.message;controller.emit();}); }
}
entrypoints.setup({
  plugin:{create(){init();},destroy(){ui?.destroy();controller.stop();}},
  panels:{footageSync:{create(){init();},show(){controller.visible=true;init();ui?.mainPanel?.measure();controller.emit();},hide(){controller.visible=false;controller.diagnostics();}}}
});
document.addEventListener("DOMContentLoaded",init);
