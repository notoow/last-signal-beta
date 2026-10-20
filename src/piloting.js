// Held input only: no saved mode, cargo brake or automatic docking.
export const PRECISION_SPEED=.35;
export function precisionActive(s,input={}){
 return s?.kind==='tow'&&s.status==='playing'&&input.precision===true&&!(s.boat.burstLeft>0);
}
export function piloting(s,input={},language='ko'){
 const active=precisionActive(s,input),en=language==='en';
 return {active,label:active?(en?'C · Precision throttle':'C · 정밀 조종 중'):(en?'Hold C · Precision':'C 누르기 · 정밀 조종')};
}
export function drawPrecision(ctx,boat,pilot){
 if(!pilot?.active)return;
 ctx.save();ctx.translate(boat.x,boat.y);ctx.rotate(boat.angle);
 ctx.strokeStyle='#cbe8de';ctx.lineWidth=2;ctx.setLineDash([5,5]);
 ctx.beginPath();ctx.ellipse(0,0,45,30,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
 ctx.beginPath();ctx.moveTo(48,0);ctx.lineTo(58,0);ctx.stroke();ctx.restore();
}
