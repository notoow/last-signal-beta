import {waterAt,TILE} from './rogue-map.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

// Generation-time route planning; does not move actors or reveal terrain.
export function harborRoute(map,start,target,radius=70,obstacles=[]){
  const clear=p=>waterAt(map,p,radius)&&obstacles.every(b=>{
    const dx=p.x-b.x,dy=p.y-b.y,localX=dx*Math.cos(b.angle)+dy*Math.sin(b.angle);
    const localY=-dx*Math.sin(b.angle)+dy*Math.cos(b.angle),end=(b.length-b.width)/2;
    return Math.hypot(localX-Math.max(-end,Math.min(end,localX)),localY)>radius+b.width/2;
  });
  const segment=(a,b)=>{
    const count=Math.max(1,Math.ceil(distance(a,b)/10));
    for(let i=0;i<=count;i++)if(!clear({x:a.x+(b.x-a.x)*i/count,y:a.y+(b.y-a.y)*i/count}))return false;
    return true;
  };
  const cells=[];
  for(let y=0;y<map.rows;y++)for(let x=0;x<map.cols;x++){
    const p={x:(x+.5)*TILE,y:(y+.5)*TILE,id:y*map.cols+x};
    if(clear(p))cells.push(p);
  }
  const byId=new Map(cells.map(p=>[p.id,p]));
  const nearest=p=>[...cells].sort((a,b)=>distance(a,p)-distance(b,p)).find(q=>segment(p,q));
  const first=nearest(start),last=nearest(target);
  if(!first||!last)throw Error('No safe chart endpoint '+JSON.stringify({start,target,radius}));
  const open=new Set([first.id]),cost=new Map([[first.id,0]]),parent=new Map();
  while(open.size){
    const id=[...open].reduce((best,n)=>cost.get(n)+distance(byId.get(n),last)<cost.get(best)+distance(byId.get(best),last)?n:best);
    if(id===last.id)break;
    open.delete(id);
    const p=byId.get(id),x=id%map.cols,y=Math.floor(id/map.cols);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if(Math.abs(dx)+Math.abs(dy)!==1||x+dx<0||x+dx>=map.cols||y+dy<0||y+dy>=map.rows)continue;
      const q=byId.get((y+dy)*map.cols+x+dx);
      if(!q||!segment(p,q))continue;
      const next=cost.get(id)+distance(p,q);
      if(next<(cost.get(q.id)??Infinity)){cost.set(q.id,next);parent.set(q.id,id);open.add(q.id);}
    }
  }
  if(!cost.has(last.id))throw Error('Chart route disconnected');
  const path=[target];let id=last.id;
  while(id!==first.id){path.unshift(byId.get(id));id=parent.get(id);}
  path.unshift(first);path.unshift(start);
  const result=[];let index=0;
  while(index<path.length-1){
    let far=path.length-1;
    // Keyboard intent has eight headings. Keep orthogonal channel legs rather
    // than commanding a long shallow diagonal as "D+S" and cutting the bank.
    const aligned=p=>{
      const dx=Math.abs(path[index].x-p.x),dy=Math.abs(path[index].y-p.y);
      return Math.min(dx,dy)<.01||Math.abs(dx-dy)<.01;
    };
    while(far>index+1&&(!aligned(path[far])||!segment(path[index],path[far])))far--;
    result.push({x:path[far].x,y:path[far].y});index=far;
  }
  return result;
}
