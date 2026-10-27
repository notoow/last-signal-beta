import {fogState,fogRenderAlpha} from './rogue-vision.js';
import {HARBOR_PROJECTION as P} from './world-projection.js';

// Read-only rendering of the existing simulation's visibility. Rendering must
// never discover map cells, even while scrolling or zooming an unexplored area.
export function installShoreFog(scene,s,id='shore-fog'){
  const map=s.map,initial=fogState(s),{cols,rows,cell}=initial,rgba=new Uint8Array(cols*rows*4);
  let source=initial.alpha,previous=fogRenderAlpha(initial);
  // Match Canvas's navy fog and conservative inward interpolation band.
  // Typed pixel uploads are premultiplied for the renderer's ONE blend mode.
  const pixel=(out,index,a)=>{out[index]=Math.round(7*a/255);out[index+1]=Math.round(20*a/255);out[index+2]=Math.round(27*a/255);out[index+3]=a;};
  for(let i=0;i<previous.length;i++)pixel(rgba,i*4,previous[i]);
  scene.pixels(id,cols,rows,rgba,{nearest:false});
  const w=cols*cell,h=rows*cell;
  scene.layer(id,id,[{points:[0,0,P.xx*w,P.yx*w,P.xx*w+P.xy*h,P.yx*w+P.yy*h,P.xy*h,P.yy*h]}]);
  return {
    id,
    sync(state){
      if(state.map!==map)throw Error('Reinstall shore fog for a new map');
      const field=fogState(state);if(field.alpha===source)return {changed:0,regions:0};
      const next=fogRenderAlpha(field);let changed=0,regions=0;
      for(let y=0;y<rows;y++){
        let start=-1,end=-1;
        for(let x=0;x<cols;x++){const i=y*cols+x;if(previous[i]!==next[i]){if(start<0)start=x;end=x;changed++;}}
        if(start<0)continue;
        const patch=new Uint8Array((end-start+1)*4);
        for(let x=start;x<=end;x++)pixel(patch,(x-start)*4,next[y*cols+x]);
        scene.patchPixels(id,start,y,end-start+1,1,patch);regions++;
      }
      source=field.alpha;previous=next;return {changed,regions};
    },
    dispose(){scene.removeLayer(id);scene.removeAtlas(id);}
  };
}
