// Presentation only. Persistent exploration and logical LOS remain untouched.
// A subcell distance band avoids dilating the entire source cell just to keep
// bilinear sampling opaque over unknown ground. Rebuild only on a new field.
const cache=new WeakMap(),FACTOR=4;
export function fogRenderField(field){
  const old=cache.get(field.alpha);if(old&&old.sourceCols===field.cols&&old.sourceRows===field.rows)return old;
  const {cols:sourceCols,rows:sourceRows,alpha:source,cell}=field,cols=sourceCols*FACTOR,rows=sourceRows*FACTOR,alpha=new Uint8Array(cols*rows),higher=new Uint16Array(27);
  for(let y=0;y<sourceRows;y++)for(let x=0;x<sourceCols;x++){
    const base=source[y*sourceCols+x];let count=0;
    if(base<255)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const nx=Math.max(0,Math.min(sourceCols-1,x+dx)),ny=Math.max(0,Math.min(sourceRows-1,y+dy)),value=source[ny*sourceCols+nx];
      if(value>base){higher[count++]=dx+1;higher[count++]=dy+1;higher[count++]=value;}
    }
    if(!count){for(let sy=0;sy<FACTOR;sy++){const start=(y*FACTOR+sy)*cols+x*FACTOR;alpha.fill(base,start,start+FACTOR);}continue;}
    for(let sy=0;sy<FACTOR;sy++)for(let sx=0;sx<FACTOR;sx++){
      let value=base;const px=(sx+.5)/FACTOR-.5,py=(sy+.5)/FACTOR-.5;
      for(let i=0;i<count;i+=3){
        const d=Math.hypot(Math.max(0,Math.abs(px-(higher[i]-1))-.5),Math.max(0,Math.abs(py-(higher[i+1]-1))-.5));
        // The opaque inner quarter-cell includes diagonal bilinear neighbours.
        const t=Math.max(0,Math.min(1,(d-.26)/.79)),weight=1-t*t*(3-2*t);
        value=Math.max(value,base+(higher[i+2]-base)*weight);
      }
      alpha[(y*FACTOR+sy)*cols+x*FACTOR+sx]=Math.round(value);
    }
  }
  const result={cols,rows,cell:cell/FACTOR,alpha,sourceCols,sourceRows};cache.set(source,result);return result;
}
