// Bounded local diagnostics. No timers, DOM access, persistence or network.
// Caller supplies raw RAF milliseconds BEFORE simulation dt clamping.
export function frameSampler(capacity=300){
 if(!Number.isInteger(capacity)||capacity<1||capacity>1800)throw Error('Invalid capacity');
 const groups=new Map();let previous=null,lastKey=null;
 return {
  sample(now,{mode,renderer,active}){
   if(!active||!Number.isFinite(now)){previous=null;lastKey=null;return;}
   if(!['sailing','moored','ashore'].includes(mode)||!['gpu','canvas','unknown'].includes(renderer)){previous=null;lastKey=null;return;}
   const key=mode+':'+renderer,delta=now-previous;
   if(previous!==null&&lastKey===key&&delta>0){
    let g=groups.get(key);if(!g){g={values:new Float64Array(capacity),count:0,next:0,total:0};groups.set(key,g);}
    g.values[g.next]=delta;g.next=(g.next+1)%capacity;g.count=Math.min(capacity,g.count+1);g.total++;
   }
   previous=now;lastKey=key;
  },
  summary(){
   return {schema:1,capacity,groups:[...groups].map(([key,g])=>{
    const sorted=Array.from(g.values.subarray(0,g.count)).sort((a,b)=>a-b),quantile=p=>sorted[Math.max(0,Math.ceil(sorted.length*p)-1)];
    const [mode,renderer]=key.split(':');
    return {mode,renderer,samples:g.count,totalSamples:g.total,medianMs:quantile(.5),p95Ms:quantile(.95),maxMs:sorted.at(-1),over50:sorted.filter(v=>v>50).length};
   })};
  }
 };
}
