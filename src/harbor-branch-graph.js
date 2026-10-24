// Original seeded spanning-tree harbor planner. Geometry is carved and
// clearance-validated by rogue-map, not inferred from graph connectivity.
export function branchGraph(nodes, rng) {
  const ids=['arrival','outer-0','outer-1','outer-2','basin-0','basin-1','basin-2','sea-gate'];
  const selected=nodes.filter(n=>ids.includes(n.id));
  const pairs=[['arrival','outer-0'],['arrival','basin-0'],
    ['outer-0','outer-1'],['outer-1','outer-2'],
    ['basin-0','basin-1'],['basin-1','basin-2'],
    ['outer-0','basin-0'],['outer-1','basin-1'],['outer-2','basin-2'],
    ['outer-2','sea-gate'],['basin-2','sea-gate']];
  for(let i=pairs.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[pairs[i],pairs[j]]=[pairs[j],pairs[i]];}
  const parents=new Map(ids.map(id=>[id,id]));
  const root=id=>{while(parents.get(id)!==id)id=parents.get(id);return id;};
  const chosen=[],extra=[];
  for(const pair of pairs){const [a,b]=pair,ra=root(a),rb=root(b);
    if(ra!==rb){parents.set(ra,rb);chosen.push(pair);}else extra.push(pair);
  }
  // Some voyages have a single loop; others two. Dead-end service yards
  // remain possible, so visiting every yard is no longer one fixed chain.
  chosen.push(...extra.slice(0,rng()<.5?1:2));
  const edges=chosen.map(([from,to])=>{
    const a=selected.find(n=>n.id===from),b=selected.find(n=>n.id===to);
    const vertical=from.startsWith('outer')&&to.startsWith('basin');
    // Crosscuts pass beside the warehouse, never through its landing apron.
    const x=b.x+320;
    const points=vertical?[a,{x,y:a.y},{x,y:b.y},b]:
      from==='arrival'?[a,{x:a.x,y:b.y},b]:[a,{x:b.x,y:a.y},b];
    return {from,to,width:from==='arrival'?400:from.startsWith('outer')?320:400,role:vertical?'shortcut':'working',points};
  });
  return {nodes:selected,edges,topology:chosen.map(p=>p.join('>')).sort().join('|')};
}
