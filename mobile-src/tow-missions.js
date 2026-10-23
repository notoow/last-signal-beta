// Immutable mission content. Physics consumes definitions; saved runs hold identity and state.
const deepFreeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;};
const bus07={
 id:'bus07',radioIds:['learnBusLines'],revision:1,kind:'tow',layouts:['ac','full'],
 world:{width:1800,height:1200,unit:24,
  walls:[{id:'work-pontoon',x:416,y:401,w:68,h:45},{id:'north-yard',x:35,y:40,w:590,h:180},{id:'south-yard',x:35,y:520,w:510,h:160},{id:'safe-quay',x:1570,y:735,w:195,h:330}],
  berth:{x:1330,y:805,w:240,h:130,angle:0},winch:{x:1528,y:870}},
 crossing:{winch:{x:1200,y:704},cable:{id:'merge-cable',x:1196,y:712,w:8,h:198},debris:{id:'fallen-boom',x:1228,y:948,w:144,h:28},sluice:{x:650,y:465},flow:{x:550,y:420,w:170,h:390}},
 crossingWalls:[{id:'s-upper',x:710,y:40,w:330,h:240},{id:'s-mid',x:655,y:500,w:425,h:260},{id:'s-lower',x:900,y:1100,w:350,h:65}],
 spawn:{boat:{x:165,y:400,angle:0,length:48,width:24,mass:1.4},bus:{x:325,y:345,angle:.22,length:144,width:60,mass:5}},
 moorings:[{id:'bow',x:420,y:305,end:1},{id:'stern',x:260,y:400,end:-1}],powerBox:{x:448,y:423},
 recoveryBoat:{x:530,y:345,angle:0},
 routeRegions:{inner:{minY:520,maxX:655},outer:{minX:800,maxY:500}},
 guidance:{nearDockX:1180,manualDockX:1250,crossingExitX:1210},
 visual:{cargo:'waterbus',mark:'07'},
 textKeys:{title:'towTitle',brief:'towBrief',power:'towPowerChoice',arrival:'towComplete',record:'towRecord'}
};
const market={
 id:'market',revision:1,radioIds:['marketArrival','marketPassengerFree','marketIceFree'],kind:'tow',layouts:['full'],requires:['bus07'],
 world:{width:1900,height:1400,unit:24,walls:[{id:'market-hall',x:50,y:40,w:1060,h:180},{id:'west-quay',x:50,y:500,w:320,h:300},{id:'market-island',x:520,y:500,w:620,h:450},{id:'east-seawall',x:1660,y:280,w:190,h:650},{id:'safe-quay',x:1740,y:980,w:120,h:350},{id:'power-pontoon',x:675,y:980,w:35,h:35}],berth:{x:1400,y:1080,w:300,h:150,angle:0},winch:{x:1620,y:1155}},
 crossing:{merge:false,mode:'steady',sluice:{x:355,y:840},flow:{x:1200,y:350,w:350,h:650}},crossingWalls:[],
 flows:[{id:'east-crossflow',x:1200,y:350,w:350,h:650,ax:26,ay:0,torque:.07},{id:'west-drain',x:385,y:770,w:210,h:195,ax:0,ay:16,torque:0,controlled:true}],
 spawn:{boat:{x:445,y:1020,angle:-Math.PI/2,length:48,width:24,mass:1.4},bus:{x:650,y:330,angle:0,length:144,width:60,mass:5}},
 cargo:[{id:'ice',x:445,y:620,angle:Math.PI/2,length:132,width:70,mass:4,visual:'ice'}],
 moorings:[{id:'market-passenger-line',bodyId:'bus',x:565,y:275,end:-1},{id:'ice-line',bodyId:'ice',x:410,y:545,end:-1}],powerBox:{x:692,y:997},
 stations:[{id:'ice-pocket',x:210,y:965,zone:{x:120,y:865,w:320,h:190},angle:Math.PI,allowed:['ice'],nameKey:'marketIcePocket'}],
 recoveryBoat:{x:445,y:1020,angle:-Math.PI/2},routeRegions:{inner:{minY:700,maxX:540},outer:{minX:1140,maxY:950}},guidance:{nearDockX:1300,manualDockX:1350,crossingExitX:1250},
 visual:{cargo:'waterbus',mark:'M',theme:'market'},textKeys:{title:'marketTitle',brief:'marketBrief',power:'marketPower',arrival:'marketComplete',record:'marketRecord'}
};
const sluice={
 id:'sluice',revision:1,kind:'tow',layouts:['full'],requires:['market'],manualSluice:true,arrivalRadio:'sluiceArrival',arrivalRadioByCrew:{operator:'sluiceArrivalOperator'},
 radioIds:['learnSluiceLines','learnSluiceChoice','learnSluiceControl','sluiceArrival','sluiceArrivalOperator','sluiceOneLine','sluiceFree','sluiceDischarge','sluiceRelief'],cutRadio:{one:'sluiceOneLine',free:'sluiceFree'},gateRadio:{'1':'sluiceDischarge','-1':'sluiceRelief'},
 world:{width:2000,height:1400,unit:24,walls:[{id:'pump-yard',x:50,y:50,w:650,h:350},{id:'basin-wall',x:50,y:800,w:600,h:500},{id:'turning-island',x:900,y:500,w:310,h:260},{id:'shelter-pier',x:1100,y:320,w:430,h:160},{id:'control-jetty',x:1760,y:180,w:150,h:190},{id:'south-breakwater',x:1060,y:1060,w:350,h:60},{id:'safe-quay',x:1890,y:1090,w:75,h:260},{id:'power-pontoon',x:740,y:990,w:50,h:50}],berth:{x:1500,y:1180,w:350,h:150,angle:0},winch:{x:1765,y:1255}},
 crossing:{merge:false,mode:'steady',sluice:{x:1725,y:285},flow:{x:600,y:440,w:400,h:350}},crossingWalls:[],
 flows:[{id:'basin-discharge',x:600,y:440,w:400,h:350,ax:18,ay:0,torque:0,states:{'1':{ax:18,ay:0,torque:0},'-1':{ax:-14,ay:0,torque:0}}},{id:'central-spill',x:1215,y:490,w:390,h:510,ax:0,ay:24,torque:.04,states:{'1':{ax:0,ay:24,torque:.04},'-1':{ax:0,ay:0,torque:0}}}],
 spawn:{boat:{x:530,y:710,angle:-Math.PI/2,length:48,width:24,mass:1.4},bus:{x:350,y:600,angle:0,length:176,width:58,mass:5.5}},
 moorings:[{id:'inspection-bow',bodyId:'bus',x:475,y:490,end:1,nameKey:'sluiceBowLine'},{id:'inspection-stern',bodyId:'bus',x:225,y:690,end:-1,nameKey:'sluiceSternLine'}],powerBox:{x:765,y:1015},
 stations:[{id:'inspection-pocket',x:1435,y:205,zone:{x:1100,y:115,w:420,h:175},angle:0,allowed:['bus'],nameKey:'sluicePocket'}],
 recoveryBoat:{x:530,y:710,angle:-Math.PI/2},routeRegions:{inner:{minY:700,maxX:1060},outer:{minX:1050,maxY:320}},guidance:{nearDockX:1450,manualDockX:1450,crossingExitX:1500},
 visual:{cargo:'inspection',mark:'03',theme:'sluice',busNameKey:'sluiceBoat',mapLegendKey:'sluiceMapLegend',sluiceNameKey:'sluiceControl',ashore:{x:1905,y:1230}},
 textKeys:{title:'sluiceTitle',brief:'sluiceBrief',power:'sluicePower',arrival:'sluiceComplete',record:'sluiceRecord',outcome:'sluiceOutcome',launch:'sluiceLaunch',unmoor:'sluiceUnmoor',choose:'sluiceChoose',tow:'sluiceTow',routeHint:'sluiceRouteHint',cutHint:'sluiceCutHint',guide:'sluiceGuide'}
};
const landing={
 "id": "landing",
 "revision": 1,
 "kind": "tow",
 "layouts": [
  "full"
 ],
 "requires": [
  "sluice"
 ],
 "arrivalRadio": "landingArrival",
 "radioIds": [
  "learnLandingBridge", "learnLandingPeople", "learnLandingInstall", "learnLandingReturn",
  "landingArrival",
  "landingPassengerFree",
  "landingPontoonFree"
 ],
 "cutRadioByBody": {
  "bus": "landingPassengerFree",
  "pontoon": "landingPontoonFree"
 },
 "goalRequires": [
  "pontoon"
 ],
 "world": {
  "width": 2100,
  "height": 1500,
  "unit": 24,
  "walls": [
   {
    "id": "repair-yard",
    "x": 50,
    "y": 50,
    "w": 1000,
    "h": 200
   },
   {
    "id": "storage-quay",
    "x": 50,
    "y": 600,
    "w": 350,
    "h": 430
   },
   {
    "id": "repair-island",
    "x": 750,
    "y": 500,
    "w": 450,
    "h": 480
   },
   {
    "id": "broken-east-pier",
    "x": 1600,
    "y": 500,
    "w": 200,
    "h": 380
   },
   {
    "id": "holding-jetty",
    "x": 1250,
    "y": 820,
    "w": 200,
    "h": 50
   },
   {
    "id": "shelter-quay",
    "x": 1880,
    "y": 1140,
    "w": 170,
    "h": 300
   },
   {
    "id": "power-pontoon",
    "x": 1135,
    "y": 1215,
    "w": 30,
    "h": 30
   }
  ],
  "berth": {
   "x": 1490,
   "y": 1100,
   "w": 330,
   "h": 130,
   "angle": 0
  },
  "winch": {
   "x": 1745,
   "y": 1165
  }
 },
 "crossing": {
  "merge": false,
  "mode": "steady",
  "sluice": {
   "x": 420,
   "y": 1080
  },
  "flow": {
   "x": 1830,
   "y": 450,
   "w": 220,
   "h": 560
  }
 },
 "crossingWalls": [],
 "flows": [
  {
   "id": "eastern-drift",
   "x": 1830,
   "y": 450,
   "w": 220,
   "h": 560,
   "ax": -18,
   "ay": 0,
   "torque": -0.02
  },
  {
   "id": "yard-drain",
   "x": 440,
   "y": 780,
   "w": 250,
   "h": 250,
   "ax": 0,
   "ay": 14,
   "torque": 0,
   "controlled": true
  }
 ],
 "spawn": {
  "boat": {
   "x": 480,
   "y": 1060,
   "angle": -1.5707963267948966,
   "length": 48,
   "width": 24,
   "mass": 1.4
  },
  "bus": {
   "x": 900,
   "y": 350,
   "angle": 0,
   "length": 144,
   "width": 60,
   "mass": 5
  }
 },
 "cargo": [
  {
   "id": "pontoon",
   "x": 480,
   "y": 600,
   "angle": 1.5707963267948966,
   "length": 120,
   "width": 70,
   "mass": 4,
   "visual": "pontoon",
   "nameKey": "landingPontoon",
   "dock": {
    "berth": {
     "x": 1670,
     "y": 1230,
     "w": 190,
     "h": 140,
     "angle": 0
    },
    "winch": {
     "x": 1825,
     "y": 1300
    },
    "nameKey": "landingInstallPocket"
   }
  }
 ],
 "moorings": [
  {
   "id": "landing-passenger-line",
   "bodyId": "bus",
   "x": 825,
   "y": 285,
   "end": -1,
   "nameKey": "landingPassengerLine"
  },
  {
   "id": "pontoon-line",
   "bodyId": "pontoon",
   "x": 535,
   "y": 535,
   "end": -1,
   "nameKey": "landingPontoonLine"
  }
 ],
 "powerBox": {
  "x": 1150,
  "y": 1230
 },
 "stations": [
  {
   "id": "holding-pocket",
   "x": 1285,
   "y": 990,
   "zone": {
    "x": 1180,
    "y": 900,
    "w": 380,
    "h": 180
   },
   "angle": 3.141592653589793,
   "allowed": [
    "bus"
   ],
   "nameKey": "landingHoldingPocket"
  }
 ],
 "recoveryBoat": {
  "x": 480,
  "y": 1060,
  "angle": -1.5707963267948966
 },
 "routeRegions": {
  "inner": {
   "minY": 700,
   "maxX": 740
  },
  "outer": {
   "minX": 1800,
   "maxY": 1050
  }
 },
 "guidance": {
  "nearDockX": 1450,
  "manualDockX": 1450,
  "crossingExitX": 1500
 },
 "visual": {
  "cargo": "waterbus",
  "mark": "12",
  "theme": "landing",
  "busNameKey": "landingBoat",
  "mapLegendKey": "landingMapLegend",
  "sluiceNameKey": "landingDrain",
  "ashore": {
   "x": 1900,
   "y": 1200
  },
  "berthNameKey": "landingBoarding"
 },
 "textKeys": {
  "title": "landingTitle",
  "brief": "landingBrief",
  "power": "landingPower",
  "arrival": "landingComplete",
  "record": "landingRecord",
  "outcome": "landingOutcome",
  "launch": "landingLaunch",
  "unmoor": "landingUnmoor",
  "choose": "landingChoose",
  "tow": "landingTow",
  "extraTow": "landingTowPontoon",
  "extraHint": "landingPontoonHint",
  "routeHint": "landingRouteHint",
  "cutHint": "landingCutHint",
  "guide": "landingGuide"
 }
};
// New departures place the controllable stream on the shared passenger/pontoon transfer lane.
// The old flow list remains the explicit legacy underway layout.
landing.workManualSluice=true;
landing.workFlows=[landing.flows[0],{id:'transfer-current',x:800,y:1080,w:650,h:300,ax:0,ay:-24,torque:0,states:{'1':{ax:0,ay:-24,torque:0},'-1':{ax:16,ay:0,torque:0}}}];
export const TOW_MISSIONS=deepFreeze({bus07,market,sluice,landing});
export const TOW_MISSION_IDS=Object.freeze(Object.keys(TOW_MISSIONS));
export const DEFAULT_TOW_MISSION='bus07';
export function getTowMission(id){return typeof id==='string'&&Object.hasOwn(TOW_MISSIONS,id)?TOW_MISSIONS[id]:null;}
export function towMission(state){const definition=getTowMission(state?.missionId??DEFAULT_TOW_MISSION);if(!definition)throw new RangeError('Unknown towing mission');return definition;}
