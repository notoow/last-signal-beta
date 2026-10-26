// Retained shore renderer with Canvas fallback and session-scoped cleanup.
import {ShoreGpuQuay} from './shore-gpu-quay.js';
import {drawQuay as nativeQuay} from './quay-view.js';
export {prepareQuayArt} from './quay-view.js';
const adapters=new WeakMap();
const failures=new WeakMap();
let activeCanvas=null;
export function hideGpuQuay(canvas){
  for(const owner of [canvas,activeCanvas]){const entry=owner&&adapters.get(owner);if(entry)entry.surface.style.display='none';}
  activeCanvas=null;
}
export function disposeGpuQuay(canvas){const entry=adapters.get(canvas);if(entry){entry.signal?.removeEventListener('abort',entry.onAbort);entry.renderer.dispose();entry.surface.remove();adapters.delete(canvas);}if(activeCanvas===canvas)activeCanvas=null;failures.delete(canvas);delete canvas.dataset.shoreGpuReady;delete canvas.dataset.shoreGpuError;}
export function drawQuay(context,state,frame,options){
  const canvas=context.canvas;let entry=adapters.get(canvas);
  if(options?.signal?.aborted){disposeGpuQuay(canvas);return {ready:false};}
  if(failures.has(canvas))return nativeQuay(context,state,frame,options);
  try{
    if(!entry){
      const surface=document.createElement('canvas');surface.dataset.shoreGpu='development';
      surface.style.cssText='position:fixed;pointer-events:none;display:none;';
      surface.setAttribute('aria-hidden','true');canvas.before(surface);
      try{entry={surface,renderer:new ShoreGpuQuay(surface)};adapters.set(canvas,entry);}
      catch(error){surface.remove();throw error;}
    }
    if(options?.signal&&entry.signal!==options.signal){
      entry.signal?.removeEventListener('abort',entry.onAbort);
      entry.signal=options.signal;entry.onAbort=()=>disposeGpuQuay(canvas);
      entry.signal.addEventListener('abort',entry.onAbort,{once:true});
    }
    const rect=canvas.getBoundingClientRect();
    Object.assign(entry.surface.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',zIndex:getComputedStyle(canvas).zIndex});
    const result=entry.renderer.draw(state,frame,{...options,overlay:context,applyLighting:false,dpr:canvas.width/frame.width});
    canvas.dataset.shoreGpuReady=String(result.ready);
    if(result.ready){if(activeCanvas&&activeCanvas!==canvas)hideGpuQuay(activeCanvas);activeCanvas=canvas;delete canvas.dataset.shoreGpuError;entry.surface.style.display='block';return result;}
    entry.surface.style.display='none';
  }catch(error){
    disposeGpuQuay(canvas);failures.set(canvas,error.message);canvas.dataset.shoreGpuError=error.message;canvas.dataset.shoreGpuReady='false';
  }
  return nativeQuay(context,state,frame,options);
}
