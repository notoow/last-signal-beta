// Render-only gait: travelled distance drives the cycle; it never changes game state.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mix=(a,b,t)=>a+(b-a)*t;
const wrap=x=>((x%1)+1)%1;
const smooth=x=>x*x*(3-2*x);

export function solveLeg(hip,ankle,thigh,shin,bend=1){
  const dx=ankle.x-hip.x,dy=ankle.y-hip.y,d=Math.hypot(dx,dy);
  if(!(thigh>0&&shin>0&&Number.isFinite(d)))throw Error('Invalid leg geometry');
  const reach=clamp(d,Math.abs(thigh-shin)+1e-6,thigh+shin-1e-6);
  const ux=d>1e-9?dx/d:0,uy=d>1e-9?dy/d:1;
  const along=(thigh*thigh-shin*shin+reach*reach)/(2*reach);
  const normal=Math.sqrt(Math.max(0,thigh*thigh-along*along))*Math.sign(bend||1);
  const knee={x:hip.x+ux*along+uy*normal,y:hip.y+uy*along-ux*normal};
  return {hip:{...hip},knee,ankle:{x:hip.x+ux*reach,y:hip.y+uy*reach},
    reachable:Math.abs(d-reach)<1e-5,requestedAnkle:{...ankle}};
}

// During stance, body translation plus foot-relative translation is constant.
// Swing uses equal endpoint tangents, avoiding a reversal jerk at contact.
export function footPath(phase,{cycle=208,stance=.58,lift=25}={}){
  phase=wrap(phase);
  const span=cycle*stance;
  if(phase<stance)return {x:span/2-phase*cycle,lift:0,planted:true};
  const t=(phase-stance)/(1-stance),t2=t*t,t3=t2*t;
  const back=-span/2,front=span/2,tangent=-cycle*(1-stance);
  return {x:(2*t3-3*t2+1)*back+(t3-2*t2+t)*tangent+(-2*t3+3*t2)*front+(t3-t2)*tangent,
    lift:lift*Math.sin(Math.PI*t)**2,planted:false};
}

export function advanceGait(previous,{travel=0,dt=0,moving=false},cycle=208){
  if(!Number.isFinite(travel)||travel<0||!Number.isFinite(dt)||dt<0||!(cycle>0))throw Error('Invalid gait input');
  const state=previous||{phase:0,blend:0};
  return {phase:wrap(state.phase+(moving?travel/cycle:0)),
    blend:clamp(state.blend+(moving?1:-1)*Math.min(dt,.1)/.12,0,1)};
}

// Seven-part art variant: sole support comes from the actual isolated boot
// alpha bounds. The boot itself stays horizontal; only thigh/shin rotate.
export function sampleLayeredLegs({phase,blend},metadata,{cycle=180,ground=480,hipX=250,restHipY=365,walkHipY=381,lift=24,reduced=false}={}){
  const weight=smooth(clamp(blend,0,1)),scale=metadata.commonScale;
  const hipY=mix(restHipY,walkHipY,weight)+(reduced?0:(1-Math.cos(phase*Math.PI*4))*weight);
  if(!(scale>0))throw Error('Invalid common part scale');
  return ['far','near'].map((name,index)=>{
    const thigh=metadata.parts.find(p=>p.id===name+'-thigh'),shin=metadata.parts.find(p=>p.id===name+'-shin'),boot=metadata.parts.find(p=>p.id===name+'-boot');
    const foot=footPath(phase+(index?0:.5),{cycle,lift}),height=(boot.bounds[3]+1-boot.pivot[1])*scale;
    const hip={x:hipX+(index?3:-3),y:hipY};
    const ankle={x:hipX+mix(index?16:-16,foot.x,weight),y:ground-height-foot.lift*weight};
    return {name,planted:weight===1&&foot.planted,soleY:ankle.y+height,
      ...solveLeg(hip,ankle,thigh.boneLengthAtReference,shin.boneLengthAtReference)};
  });
}
