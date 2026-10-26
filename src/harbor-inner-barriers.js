export function restoreInnerBarriers(input){const m=structuredClone(input),barriers=[];
 for(let i=0;i<2;i++){
  const a=m.nodes.find(n=>n.id==='basin-'+i),b=m.nodes.find(n=>n.id==='basin-'+(i+1));
  if(m.edges.some(e=>e.from===a.id&&e.to===b.id))continue;
  const cut=Math.floor(((a.x+b.x)/2-80)/40)*40,columns=2,oldCols=m.cols,tiles=[];
  if([...m.islands,...m.props].some(r=>r.x<cut&&r.x+r.w>cut))throw Error('Insertion crosses solid');
  for(let y=0;y<m.rows;y++){
   const row=m.tiles.slice(y*oldCols,(y+1)*oldCols),at=cut/40;
   const fill=y<2||y>=m.rows-2?4:row[at-1]&&row[at]?row[at]:0;
   row.splice(at,0,...Array(columns).fill(fill));tiles.push(...row);
  }
  const seen=new WeakSet();
  function shift(v){if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v);
   if(typeof v.x==='number'&&v.x>=cut)v.x+=80;
   if(typeof v.homeX==='number'&&v.homeX>=cut)v.homeX+=80;
   for(const child of Object.values(v))shift(child);
  }
  for(const tree of [m.islands,m.props,m.nodes,m.edges,m.berths,m.spawn,m.boss,m.exit,m.landmarks])shift(tree);
  m.tiles=tiles;m.cols+=columns;m.width+=80;m.arenaShiftX=(m.arenaShiftX||0)+80;
  const x=cut+80,y=Math.floor((Math.min(a.y,b.y)-120)/40)*40;
  for(let ty=y/40;ty<1320/40;ty++)for(let tx=x/40;tx<(x+80)/40;tx++)m.tiles[ty*m.cols+tx]=1;
  barriers.push({x,y,w:80,h:1320-y,insertedWidth:80});
 }

return m;}
