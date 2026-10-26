import {surveyGrid,visibleSurvey} from './rogue-vision.js';
import {HARBOR_PROJECTION as P} from './world-projection.js';

// Read-only rendering of the existing simulation's visibility. Rendering must
// never discover map cells, even while scrolling or zooming an unexplored area.
export function installShoreFog(scene,s,id='shore-fog'){
  const map=s.map,{cols,rows,cell}=surveyGrid(map),rgba=new Uint8Array(cols*rows*4);
  const alpha=state=>{
    if(!state.survey)return new Uint8Array(cols*rows);
    const visible=visibleSurvey(state),remembered=state.survey.length===cols*rows?state.survey:null;
    return Uint8Array.from({length:cols*rows},(_,i)=>visible?.[i]?0:remembered?.[i]?179:255);
  };
  let previous=alpha(s);
  for(let i=0;i<previous.length;i++)rgba[i*4+3]=previous[i];
  scene.pixels(id,cols,rows,rgba);
  const w=cols*cell,h=rows*cell;
  scene.layer(id,id,[{points:[0,0,P.xx*w,P.yx*w,P.xx*w+P.xy*h,P.yx*w+P.yy*h,P.xy*h,P.yy*h]}]);
  return {
    id,
    sync(state){
      if(state.map!==map)throw Error('Reinstall shore fog for a new map');
      const next=alpha(state);let changed=0,regions=0;
      for(let y=0;y<rows;y++){
        let start=-1,end=-1;
        for(let x=0;x<cols;x++){const i=y*cols+x;if(previous[i]!==next[i]){if(start<0)start=x;end=x;changed++;}}
        if(start<0)continue;
        const patch=new Uint8Array((end-start+1)*4);
        for(let x=start;x<=end;x++)patch[(x-start)*4+3]=next[y*cols+x];
        scene.patchPixels(id,start,y,end-start+1,1,patch);regions++;
      }
      previous=next;return {changed,regions};
    },
    dispose(){scene.removeLayer(id);scene.removeAtlas(id);}
  };
}
