"use strict";

// CSS/UXP content pixels, independent of monitor resolution and native panel chrome.
const BREAKPOINT=160;
function panelLayout(width,height) {
  width=Number(width); height=Number(height);
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0) return null;
  const vertical=width<BREAKPOINT, cross=vertical?width:height, length=vertical?height:width;
  const padding=Math.min(6,cross*.06,length*.04), gap=Math.min(4,cross*.04,length*.02);
  const button=Math.max(0,Math.min(56,cross-padding*2,(length-padding*2-gap*2)/3));
  const icon=Math.min(32,button*.60);
  return {vertical,width,height,padding,gap,button,icon};
}
module.exports={panelLayout,BREAKPOINT};
