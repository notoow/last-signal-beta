// Presentation only. Persistent exploration and logical LOS remain untouched.
// A subcell distance band avoids dilating the entire source cell just to keep
// bilinear sampling opaque over unknown ground. Rebuild only on a new field.
const cache=new WeakMap(),FACTOR=4;
// These weights depend only on subcell position and neighbour offset, not on
// exploration or opacity. Preserve the exact falloff while avoiding a hypot
// and smoothstep for every neighbour of every rebuilt fog cell.
const weights=Array.from({length:FACTOR*FACTOR},(_,sub)=>{
  const px=(sub%FACTOR+.5)/FACTOR-.5,py=(Math.floor(sub/FACTOR)+.5)/FACTOR-.5;
  return Array.from({length:9},(_,n)=>{
    const dx=n%3-1,dy=Math.floor(n/3)-1;
    const d=Math.hypot(Math.max(0,Math.abs(px-dx)-.5),Math.max(0,Math.abs(py-dy)-.5));
    const t=Math.max(0,Math.min(1,(d-.26)/.79));return 1-t*t*(3-2*t);
  });
});
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
      let value=base;const subWeights=weights[sy*FACTOR+sx];
      for(let i=0;i<count;i+=3){
        // The opaque inner quarter-cell includes diagonal bilinear neighbours.
        const weight=subWeights[higher[i+1]*3+higher[i]];
        value=Math.max(value,base+(higher[i+2]-base)*weight);
      }
      alpha[(y*FACTOR+sy)*cols+x*FACTOR+sx]=Math.round(value);
    }
  }
  const result={cols,rows,cell:cell/FACTOR,alpha,sourceCols,sourceRows};cache.set(source,result);return result;
}
