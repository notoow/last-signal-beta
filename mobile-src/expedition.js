// Run-local situations: generated once from the run seed, never rerolled on reload.
export const CONTRACTS=['squall','blackout','leaking'];
export function roll(seed,salt){let n=(seed^Math.imul(salt+1,0x9e3779b9))>>>0;n=Math.imul(n^(n>>>16),0x21f0aaad);n=Math.imul(n^(n>>>15),0x735a2d97);return (n^(n>>>15))>>>0;}
export function contractOffers(v){const start=roll(v.seed,v.leg+31)%3;return [CONTRACTS[start],CONTRACTS[(start+1+roll(v.seed,v.leg+43)%2)%3]];}
export function freshSituation(v){return {contract:contractOffers(v)[0],started:false,patched:false,patch:0,salvaged:false,salvage:0,charge:100,boosting:false,stormNotice:-1,...(v.version>=4?{salvagePlan:'supplies',salvageSlot:0}:{})};}
export function chooseContract(v,id){if(v.version<3||v.phase!=='refit'||!contractOffers(v).includes(id))return false;v.situation.contract=id;return true;}
export function startSituation(s){const v=s.voyage,a=v?.situation;if(!(v?.version>=3)||a.started||v.phase!=='sailing')return;a.started=true;if(a.contract==='blackout'){s.power=false;s.dockLatched=false;s.cargoLatches={};}s.events.push({type:'expeditionStart',contract:a.contract});}
const ZONES={market:{x:1160,y:300,w:470,h:760},sluice:{x:650,y:780,w:850,h:260},landing:{x:800,y:1080,w:650,h:300}};
const CACHES={market:[{x:1175,y:1030},{x:1230,y:270}],sluice:[{x:820,y:850},{x:1570,y:950}],landing:[{x:730,y:1260},{x:1510,y:1040}]};
export function salvageModule(v){return ['pump','tools','motor','battery','turbine'][roll(v.seed,v.leg+127)%5];}
export function chooseSalvagePlan(v,plan,slot=v.situation?.salvageSlot){if(v.version<4||v.phase!=='refit'||![0,1].includes(slot)||!['supplies','module'].includes(plan)||plan==='module'&&v.equipment.includes(salvageModule(v)))return false;v.situation.salvagePlan=plan;v.situation.salvageSlot=slot;return true;}
export function salvageSite(s){const v=s.voyage;if(!(v?.version>=3))return null;return {...CACHES[s.missionId][roll(v.seed,v.leg+101)%2],reward:v.version>=4&&v.situation.salvagePlan==='module'?salvageModule(v):roll(v.seed,v.leg+113)%2?'fuel':'parts'};}
export function stormState(s){const v=s.voyage;if(!(v?.version>=3))return null;const cycle=32+roll(v.seed,v.leg+61)%13,offset=roll(v.seed,v.leg+67)%9,t=(s.time+offset)%cycle,index=Math.floor((s.time+offset)/cycle),warning=t>=cycle-12&&t<cycle-8,active=t>=cycle-8;const sign=roll(v.seed,v.leg*100+index+71)%2?1:-1;return {...ZONES[s.missionId],index,warning,active,seconds:Math.ceil(active?cycle-t:cycle-8-t),ax:sign*(v.situation.contract==='squall'?48:23),ay:0,torque:sign*.035};}
export function boosted(s,input={}){return s.voyage?.version>=3&&input.boost===true&&input.precision!==true&&Math.hypot(input.x||0,input.y||0)>0&&s.voyage.situation.charge>1;}
// Recover drive from an actively ridden gust, never from idling or holding boost.
export function gustRide(s,input={}){
 const g=stormState(s),b=s.boat;
 return !!(g?.active&&s.status==='playing'&&s.voyage.phase==='sailing'&&!input.boost&&!input.precision&&Math.sign(input.x||0)===Math.sign(g.ax)&&b.vx*Math.sign(g.ax)>30&&b.x>=g.x&&b.x<=g.x+g.w&&b.y>=g.y&&b.y<=g.y+g.h);
}
export function gustRideBonus(s,input={}){
 if(!gustRide(s,input))return 0;
 const g=stormState(s),b=s.bus;
 const rescue=s.connected&&(s.connectedBodyId||'bus')==='bus'&&!s.secured.includes('bus')&&b.hp>0&&b.x>=g.x&&b.x<=g.x+g.w&&b.y>=g.y&&b.y<=g.y+g.h&&b.vx*Math.sign(g.ax)>20&&Math.abs(b.omega)<.35&&s.ropeTension<.9;
 return rescue?20:10;
}
export function driveRecharge(s,input={}){return (s.voyage.equipment.includes('battery')?6:2)+gustRideBonus(s,input);}
export function workTarget(s){const v=s.voyage;if(!(v?.version>=3))return null;const a=v.situation;if(a.contract==='leaking'&&!a.patched&&Math.hypot(s.boat.x-s.bus.x,s.boat.y-s.bus.y)<150)return 'patch';const site=salvageSite(s);return !a.salvaged&&Math.hypot(s.boat.x-site.x,s.boat.y-site.y)<75?'salvage':null;}
export function tickSituation(s,dt,input){const v=s.voyage;if(!(v?.version>=3))return;const a=v.situation,storm=stormState(s);
 if(storm.warning&&a.stormNotice!==storm.index){a.stormNotice=storm.index;s.events.push({type:'expeditionStorm'});}
 a.boosting=boosted(s,input);if(a.boosting)a.charge=Math.max(0,a.charge-20*dt);else if(!input.boost)a.charge=Math.min(100,a.charge+driveRecharge(s,input)*dt);
 const target=workTarget(s),slow=Math.hypot(s.boat.vx,s.boat.vy)<22;
 if(input.work&&slow&&target==='patch'&&v.parts>0){a.patch=Math.min(4,a.patch+dt);if(a.patch>=4){a.patched=true;v.parts--;s.events.push({type:'expeditionPatched',parts:v.parts});}}else a.patch=0;
 if(input.work&&slow&&target==='salvage'){a.salvage=Math.min(4,a.salvage+dt);if(a.salvage>=4){const receipt=salvagePreview(s);a.salvaged=true;const reward=salvageSite(s).reward;if(reward==='fuel')v.fuel=Math.min(360,v.fuel+55);else if(reward==='parts')v.parts=Math.min(9,v.parts+2);else if(!v.equipment.includes(reward)){if(v.equipment.length===2)v.equipment.splice(a.salvageSlot,1,reward);else v.equipment.push(reward);}s.events.push({type:'expeditionSalvage',...receipt});}}else a.salvage=0;
 // This is visible damage to the rescue vessel; crew repairs only repair the tug.
 if(a.contract==='leaking'&&!a.patched){s.bus.hp=Math.max(0,s.bus.hp-.45*dt);if(s.bus.hp<=0){s.status='lost';s.mission.reason='passenger-sunk';s.events.push({type:'end'});}}
}
export function situationBonus(v){return v.situation.contract==='blackout'?{fuel:50,parts:0}:v.situation.contract==='leaking'?{fuel:0,parts:3}:{fuel:25,parts:1};}
export function validSituation(v){const a=v.situation,range=(x,min,max)=>Number.isFinite(x)&&x>=min&&x<=max;return !!a&&(v.version<4||['supplies','module'].includes(a.salvagePlan)&&[0,1].includes(a.salvageSlot))&&contractOffers(v).includes(a.contract)&&['started','patched','salvaged','boosting'].every(k=>typeof a[k]==='boolean')&&range(a.patch,0,4)&&range(a.salvage,0,4)&&range(a.charge,0,100)&&Number.isInteger(a.stormNotice)&&a.stormNotice>=-1&&a.stormNotice<1000000&&(v.phase!=='refit'||!a.started)&&(!a.patched||a.contract==='leaking');}
// Exact current payout, shared by navigation and the in-world recovery label.
export function salvagePreview(s){
 const v=s.voyage,site=salvageSite(s);if(!site||v.situation.salvaged)return null;
 const reward=site.reward;
 if(reward==='fuel')return {reward,amount:Math.max(0,Math.min(55,360-v.fuel)),replaced:null};
 if(reward==='parts')return {reward,amount:Math.max(0,Math.min(2,9-v.parts)),replaced:null};
 return {reward,amount:v.equipment.includes(reward)?0:1,replaced:v.equipment.length>=2?v.equipment[v.situation.salvageSlot]:null};
}
