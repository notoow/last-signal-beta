export const layouts={
 service:{buildings:[['workshop',20,7,8,4.33],['warehouse',4,13,8,4.33]],supplies:[[5,10,2,1.5]],landing:16.5,loot:[10,10],rescue:[25,4.5]},
 cargo:{buildings:[['warehouse',12.5,17,8,4.33]],supplies:[[3.5,9,2,1.5],[6,9,2,1.5],[6,11,2,1.5],[25,9,2,1.5],[25,11,2,1.5],[27.5,11,2,1.5]],landing:16.5,loot:[10.5,12],rescue:[22.5,8]},
 shelter:{buildings:[['workshop',4,10.5,8,4.33]],supplies:[[4.5,8,2,1.5]],landing:23,loot:[9.5,8.5],rescue:[18,8.5]}
};
export function applyLayout(map,b,kind){
 const a=layouts[kind],r=map.islands[b.island],M=4.8,edge=r.y+r.h;
 const point=([x,d])=>({x:r.x+x*M,y:edge-d*M});
 const rect=([x,d,w,h])=>({x:r.x+x*M,y:edge-(d+h)*M,w:w*M,h:h*M});
 map.props=map.props.filter(p=>!(p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<edge));
 r.buildings=a.buildings.map(([visual,...coords])=>({kind:'warehouse',visual,...rect(coords)}));
 map.props.push(...a.supplies.map(coords=>({kind:'crates',visual:'supplies',...rect(coords)})));
 // Shore variety must not move the certified marine approach or towing pocket.
 b.ladder={x:b.x,y:edge};b.landing={x:b.x,y:edge-6};b.loot=point(a.loot);b.searchPoint={x:b.loot.x,y:b.loot.y+.85*M};
 map.props.push({kind:'cache',visual:'cache',berth:b.id,x:b.loot.x-.45*M,y:b.loot.y-.5*M,w:.9*M,h:.5*M});
 return {rescue:point(a.rescue),yard:r};
}

