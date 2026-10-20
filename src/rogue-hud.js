import {objective,CAPTAINS,BUILDS,GEAR,maxHp,maxFuel} from './rogue-core.js';
import {DEPTHS} from './rogue-map.js';
import {FLOOR_TOOLS,SHORE_SITES} from './shore-encounters.js';
import {skillStatus} from './captain-skills.js';
import {motionLabel,waterMotion,shipMotionStatus} from './ship-motion.js';
import {towBow} from './rogue-tow.js';

const escape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const translations={
  '폐항':'Abandoned harbor','방조 수로':'Sluice channel','등대 해역':'Lighthouse waters',
  '폭주 준설선':'Runaway dredger','수문지기':'Gatekeeper','등대지기':'Lightkeeper',
  '폐선 수리장':'Salvage yard','연료 하역장':'Fuel wharf','어시장 나루':'Fish-market landing',
  '표준선':'Standard','침수 발전선':'Flood drive','축력 윈치선':'Spring winch',
  '개량 추진기':'Drive motor','배수 펌프':'Bilge pump','강화 견인줄':'Reinforced line',
  '보조 연료통':'Fuel tank','충격 격벽':'Impact bulkhead','침수 터빈':'Flood turbine',
  '역회전 멈춤쇠':'Anti-reverse ratchet','접이식 방류판':'Flow baffle','차광 신호기':'Light shutter',
  '부두 수색':'Search the quay','배로 돌아가기':'Return to your boat',
  'E · 하선 / Q · 계류 해제':'E Disembark · Q Unmoor',
  'E · 탈출 접안':'E · Dock and leave','E · 계류':'E · Moor',
  '탈출 부두에 세로로 천천히 접안 · E':'Align with the exit berth · E',
  '고리에서 멀어지며 견인 · 줄이 붉어지면 E로 놓기':'Pull away from the hook · E to release a red line',
  '노출된 구동 고리에 접근 · E로 연결':'Approach an exposed drive hook · E to connect',
  '흡입류·크레인 예고 밖으로 이동':'Move clear of suction and the crane warning',
  '방류 예고 띠에서 벗어나기':'Leave the discharge warning strip',
  '탐조등이 멈추면 빛 밖으로 회피':'Dodge outside the light when its aim locks',
  '부두에 평행하게 감속 · E 계류 / 장비 없이 보스 진입도 가능':'Slow alongside a quay · E to moor; equipment is optional',
  '바깥 해역의 기계선을 정지시켜 탈출로 열기':'Disable the machine to open the exit',
  '감속 · Space':'Slow down · Space','방향 맞추기 · Space + 방향키':'Align bow · Space + direction',
  '회전 멈추기 · Space':'Stop turning · Space','안벽에서 벗어나기':'Clear the quay',
  '접안선 안으로':'Move inside the berth','→ 평행 접안':'→ Align alongside',
  'Space 근접 · V 투척 · Q 유인':'Space Melee · V Throw · Q Lure','Q 유인':'Q Lure',
  'E 재승선':'E Reboard','연료 보충':'Refuel','선체 수리':'Repair hull',
  '확보 / 기존 장비로 돌파도 가능':'— optional boss aid',
  '회수 · 길게 누르기':'— hold to recover','수색 ·':'— search for',
  '항해 종료':'Run ended','장비 선택 중':'Choose equipment','운항 중 사용':'Underway only',
  'G · 버팀 해제':'G · Release brace','사용 중':'Active','준비':'Ready',
  '연료 여유 필요':'Fuel reserve required','공격 예고 초반에 사용':'Early attack warning only',
  '고리 연결 · 장력 35% 필요':'Hook + 35% tension required',
  '비상 버팀':'Emergency brace','횡추진':'Side jet','미끼 부표':'Decoy buoy','구동부 결박':'Drive bind'
};
Object.assign(translations,{
  [DEPTHS[0].arrival]:'Woo: The manifest says everyone evacuated. But someone is still on the radio.',
  [DEPTHS[1].arrival]:'Park: The sluice is pushing rescue boats away. The emergency release order stopped here.',
  [DEPTHS[2].arrival]:'Woo: Same voice, same static. The distress call keeps repeating.',
  [DEPTHS[0].discovery]:'Park: An entire landing is missing from this manifest. Check it against the original at the sluice office.',
  [DEPTHS[1].discovery]:'Woo: The release order was addressed to the offshore lightship. The harbor is waiting for its reply.',
  [DEPTHS[2].discovery]:'Park: Send the list of people still here. We have to dock at the lighthouse to stop the loop.',
  'Park: 줄은 끊었어. 풀린 그물이 바깥 수로로 떠내려가고 있어.':'Park: The line is cut. The loose net is drifting into the outer channel.',
  'Park: 상자를 확인해. 짐승이 몰려오면 배로 돌아와.':'Park: Check the crate. If the animals close in, retreat to the boat.',
  'Park: Space로 갈고리를 휘두르고, V나 클릭으로 고철을 던져. 게가 집게를 들면 뒤로 빠져. Q 깡통으로 짐승을 유인할 수도 있어.':'Park: Space swings the hook; V or click throws scrap. Back away when a crab raises its claws. Q throws a can to lure animals.',
  'Park: 상자를 확인해. 발소리가 크면 들개가 따라올 거야. Q로 빈 깡통을 던져 시선을 돌릴 수 있어.':'Park: Check the crate. Loud footsteps attract dogs. Q throws an empty can to distract them.',
  'Park: 보급정 닻을 안 내렸어. 우리 배만 계류돼 있어. 떠밀리기 전에 다시 타서 H로 닻을 내려.':'Park: Only our tug is moored. Reboard and press H to anchor the supply boat before it drifts away.',
  'Woo: 「백야 해상 핵실험 관측소 — 영구 폐쇄」… 실험 날짜는 지워졌는데, 바다 시료 채취표는 아직 여기 있네.':'Woo: “White Night offshore nuclear-test observation post — permanently closed.” The test dates are erased, but the seawater sample records are still here.',
  'Woo: 보급정까지 돌아왔어. 남은 연료와 구급품을 나눠 받았어.':'Woo: The supply boat made it too. They shared their remaining fuel and medical supplies.',
  'Park: 명부 전송됐어. 이제 등대가 돌아오는 배를 비춰. 아직 사람은 남아 있어.':'Park: The manifest is through. The lighthouse is guiding boats home now. There are still people here.',
  'Woo: 크레인이 멈춘 뒤에 구동 고리가 드러나. 고리를 걸고 바깥으로 당겨!':'Woo: The drive hooks are exposed after the crane stops. Hook on and pull outwards!',
  'Park: 방류 전에 수면에 띠가 보여. 물살이 멎으면 터빈 고리를 당기자.':'Park: A warning strip appears before discharge. Pull the turbine hooks when the flow stops.',
  'Woo: 빛이 우리를 쫓아와. 조준이 멈추면 벗어나. 발전기 고리는 충전하는 동안 노출돼.':'Woo: The light is tracking us. Dodge when its aim locks. The generator hooks are exposed while it recharges.',
  'Park: 구동부가 멈췄어. 탈출 부두에 접안하면 다음 항로로 이어져.':'Park: The drives have stopped. Dock at the exit to continue along the route.',
  'Woo: 폐어망은 선미에 실었어. 다음 수로까지 떠내려갈 일은 없겠네.':'Woo: The old net is aboard. It will not drift into the next channel.',
  'Park: 견인줄이 빠졌어. 보급정 선수로 돌아가서 T로 다시 연결해.':'Park: The towline came loose. Return to the supply boat bow and reconnect with T.',
  'Park: 보급정이 침몰했어. 남은 배로 항해를 이어가야 해.':'Park: The supply boat sank. We have to continue with our tug.',
  '승선 후 조작':'Reboard before operating',
  '견인줄 분리 · 보급정 닻 내림':'Towline detached · supply boat anchored',
  '견인줄 분리 · 보급정 표류 중':'Towline detached · supply boat drifting',
  '보급정 선수 가까이 접근':'Approach the supply boat bow',
  '기계선 견인줄을 먼저 분리':'Release the machine hook first',
  '견인줄 연결 · H로 보급정 닻 올리기':'Towline attached · H raises the supply boat anchor',
  '보급정 연결 · 탈출 부두까지 견인':'Supply boat attached · tow it to the exit',
  '보급정 닻 올림 · 해류와 견인에 따라 이동':'Supply boat anchor raised · current and towing now move it',
  '보급정을 충분히 감속한 뒤 H':'Slow the supply boat before pressing H',
  '보급정 닻 내림 · 하선 중에도 고정':'Supply boat anchored · held while you are ashore',
  'Woo: 버팀 해제. 다시 움직인다.':'Woo: Brace released. Moving again.',
  'Han: 부표를 던질 수 있는 수면을 골라.':'Han: Aim the buoy at clear water.',
  'Woo: 버팀 장치 가동! 속도부터 죽인다.':'Woo: Brace engaged! Taking the speed off.',
  'Park: 옆으로 빠진다. 선수는 그대로!':'Park: Moving sideways. Holding the heading!',
  'Han: 부표 쪽으로 시선 돌렸어. 지금 벗어나!':'Han: It is aiming at the buoy. Move clear now!',
  'Jeong: 구동부 잡았어! 줄 늘어지지 않게 계속 당겨!':'Jeong: Drive bound! Keep pulling; do not let the line go slack!'
});
const toolClues=[
  'The anti-reverse ratchet is still there. Find the maintenance record to keep the drive exposed longer.',
  'The flow baffle is still there. Fit it and brake to brace against the current.',
  'The lighthouse worker left a light shutter there. It stops the light from tracking us.'
],toolEffects=[
  'Drive hook exposure +3 seconds',
  'While braking: suction/discharge force −75% and machine damage −40%',
  'The lighthouse locks its aim at the start of its warning'
];
for(const site of SHORE_SITES)for(const [i,tool] of FLOOR_TOOLS.entries()){
  translations['Park: '+site+'에 '+tool.clue]='Park: '+translations[site]+'. '+toolClues[i];
  translations['Park: '+tool.name+' 찾았어. '+tool.effect+'. 다음 층에도 가져갈 수 있어.']='Park: Found the '+translations[tool.name]+'. '+toolEffects[i]+'. We can carry it into the next region.';
}
for(const name of Object.values(GEAR))translations['Woo: '+name+' 회수. 같은 장비도 중첩해서 실을 수 있어.']='Woo: Recovered '+translations[name]+'. Multiple copies stack.';
const replacements=Object.entries(translations).sort((a,b)=>b[0].length-a[0].length);
export function rogueHudText(value,language='ko'){
  if(language!=='en')return value;
  let text=String(value);
  for(const [from,to] of replacements)text=text.replaceAll(from,to);
  return text.replace(/(\d+)초 후/g,'$1s cooldown').replace(/부스터 (\d+) 필요/g,'Needs $1 boost');
}
const skillNames={woo:'Emergency brace',park:'Side jet',han:'Decoy buoy',jeong:'Drive bind'};
const skillDescriptions={
  woo:'G slows the tug and braces it for 2.6 seconds, reducing hull damage by 75%. Propulsion is locked. Press G again to release; braking takes distance.',
  park:'Direction + G fires a short side jet while retaining the bow heading. Collision and attack damage still apply.',
  han:'Direction + G throws a decoy during the early attack warning. Aim follows the buoy; unavailable with 1.2 seconds or less left in the warning.',
  jeong:'G holds the exposed drive for up to 3 seconds while hooked with at least 35% tension. Slack or disconnection ends the bind.'
};

// Read-only presentation. Objective/action eligibility comes from objective();
// skill eligibility comes from skillStatus(). No simulation state is changed.
export function rogueHudModel(s,language='ko'){
  const en=language==='en',tr=text=>rogueHudText(text,language),guide=objective(s),skill=skillStatus(s);
  const ashore=s.mode==='ashore',sailing=s.mode==='sailing';
  const model={language,mode:s.mode,mission:tr(guide.text),fullObjective:tr(guide.text),
    region:`${s.depth+1}/3 · ${tr(DEPTHS[s.depth].name)} · ${CAPTAINS[s.captain].name}`,
    metrics:[],conditions:[],action:'',work:null,boss:null,
    motion:waterMotion(s)?shipMotionStatus(s).mode:'legacy',
    skill:{...skill,name:en?skillNames[s.captain]:skill.name,reason:tr(skill.reason),
      active:s.skill.left>0,remaining:s.skill.left,remainingCooldown:s.skill.cooldown,compact:!sailing,
      usable:skill.ready||sailing&&s.captain==='woo'&&s.skill.left>0}
  };
  const metric=(id,label,value,max)=>model.metrics.push({id,label,value,max});
  const condition=(id,text,tone='normal')=>model.conditions.push({id,text,tone});
  if(ashore){
    metric('crew',en?'Crew':'선원',Math.ceil(s.crewHp),100);
    if(s.combat)metric('ammo',en?'Scrap':'고철',s.combat.ammo,12);
    model.action=tr(guide.action);
    if(s.hp<maxHp(s))condition('hull',`${en?'Hull damage':'선체 손상'} ${Math.ceil(s.hp)}/${maxHp(s)}`,'warning');
  }else{
    metric('hull',en?'Hull':'선체',Math.ceil(s.hp),maxHp(s));
    metric('fuel',en?'Fuel':'연료',Math.ceil(s.fuel),maxFuel(s));
    metric('boost',en?'Boost':'부스터',Math.floor(s.boost),CAPTAINS[s.captain].boost);
    if(s.combat)metric('ammo',en?'Scrap':'고철',s.combat.ammo,12);
    model.action=s.mode==='moored'?tr(guide.text):
      waterMotion(s)?motionLabel(s,language):en?'Underway':'운항 중';
    if(!s.boss.active&&!s.boss.cleared&&SHORE_SITES.some(site=>guide.text.startsWith(site))){
      const site=SHORE_SITES.find(site=>guide.text.startsWith(site));
      model.mission=tr(site)+(en?' · Search':' 수색');
    }else if(guide.text.includes('장비 없이 보스')){
      model.mission=en?'Explore the harbor':'항구 탐색';
    }else if(s.boss.active&&!s.boss.cleared){
      model.mission=s.boss.hook>=0?(en?'Pull the exposed drive':'노출된 구동부 견인'):
        s.boss.phase==='recover'?(en?'Connect an exposed hook':'노출된 고리 연결'):tr(guide.text);
      if(s.boss.hook>=0){
        metric('tension',en?'Tension':'장력',`${Math.round(s.boss.tension*100)}%`);
        model.action=en?'Pull away · E Release':'고리에서 멀리 · E 분리';
      }else if(s.boss.phase==='recover')model.action=en?'Approach a hook · E Connect':'고리에 접근 · E 연결';
    }
  }
  if(s.build==='bilge'){
    const label=en?'Flood':'침수',valve=s.valve?(en?'Valve open':'밸브 열림'):(en?'Valve shut':'밸브 닫힘');
    condition('build',`${sailing?'B · ':''}${valve} · ${label} ${Math.floor(s.flood)}% · ${sailing?(en?'100% sinks':'100% 침몰'):(en?'Moored: held':'계류 중 유지')}`,s.valve&&sailing?'warning':'normal');
  }else if(s.build==='winch'&&sailing){
    const ready=s.charge>=35&&s.boss.hook>=0&&s.boss.phase==='recover'&&s.boss.tension>.1;
    const hint=ready?(s.fuel<=3?(en?'B Release · empties fuel':'B 방출 · 연료 소진'):(en?'B Release · fuel 3':'B 방출 · 연료 3')):
      s.boss.hook<0?(en?'E Hook required':'E 고리 연결 필요'):
      s.boss.phase!=='recover'?(en?'Wait for exposure':'고리 노출 대기'):
      s.boss.tension<=.1?(en?'Tighten the line':'줄을 팽팽하게'):
      (en?'Charge to 35':'축력 35 필요');
    condition('build',`${en?'Charge':'축력'} ${Math.floor(s.charge)} · ${hint}`);
  }
  const cargo=s.tow;
  if(cargo&&cargo.hp>0&&!cargo.delivered&&(cargo.connected||ashore&&!cargo.anchor)){
    const bow=towBow(cargo),remote=!cargo.connected&&Math.hypot(s.boat.x-bow.x,s.boat.y-bow.y)>=155;
    const anchor=cargo.anchor?(en?'Anchored':'닻 내림'):
      ashore?(remote?(en?'Drifting · reboard, approach, H':'표류 중 · 승선·접근 후 H'):(en?'Drifting · reboard, then H':'표류 중 · 승선 후 H')):(en?'Anchor raised · H Anchor':'닻 올림 · H 닻 조작');
    condition('cargo',`${en?'Supply boat':'보급정'} ${Math.ceil(cargo.hp)}/80 · ${anchor}`,ashore&&!cargo.anchor?'warning':'normal');
  }
  if(s.boss.active&&!s.boss.cleared){
    model.boss=`${tr(DEPTHS[s.depth].boss)} · ${en?{warn:'Warning',attack:'Attack',recover:'Hooks exposed',idle:''}[s.boss.phase]:{warn:'공격 예고',attack:'공격 중',recover:'고리 노출',idle:''}[s.boss.phase]} ${Math.ceil(s.boss.timer)}${en?'s':'초'} · ${en?'Drives':'구동부'} ${s.boss.parts.filter(h=>h>0).length}/${s.boss.parts.length}`;
  }
  if(s.work>0)model.work={value:s.work,max:ashore?1.8:3,label:en?'Recovering':'회수 중'};
  return model;
}
export function rogueHudMarkup(model){
  return {
    mission:`<small>${escape(model.region)}</small><strong>${escape(model.mission)}</strong>${model.boss?`<div class="rogue-boss-state">${escape(model.boss)}</div>`:''}`,
    readings:model.metrics.map(m=>`<span data-rogue-metric="${m.id}"><span>${escape(m.label)}</span><b>${escape(m.value)}</b>${m.max!==undefined?`<span class="rogue-maximum">/${m.max}</span>`:''}</span>`).join(''),
    conditions:model.conditions.map(c=>`<span data-rogue-condition="${c.id}" data-tone="${c.tone}">${escape(c.text)}</span>`).join(''),
    controls:`<span>${escape(model.action)}</span>${model.work?`<label class="rogue-work">${escape(model.work.label)}<progress max="${model.work.max}" value="${model.work.value}" aria-label="${escape(model.work.label)}"></progress></label>`:''}`,
    skill:`<kbd>G</kbd><span><b>${escape(model.skill.name)}</b><small>${escape(model.skill.reason)}${model.skill.active?' · '+model.skill.remaining.toFixed(1)+(model.language==='en'?'s':'초'):''}</small>${model.skill.ready?`<small>${model.language==='en'?'Boost':'부스터'} ${model.skill.boost} · ${model.language==='en'?'fuel':'연료'} ${model.skill.fuel}</small>`:''}</span>${!model.skill.compact?`<progress aria-label="${model.language==='ko'?'기술 재사용 준비':'Skill cooldown'}" max="${model.skill.cooldown}" value="${model.skill.cooldown-model.skill.remainingCooldown}"></progress>`:''}`
  };
}
export function rogueDetailsMarkup(s,language='ko'){
  const en=language==='en',tr=text=>rogueHudText(text,language),model=rogueHudModel(s,language),spec=skillStatus(s);
  const rows=[
    [en?'Current objective':'현재 목표',model.fullObjective],
    [en?'Hull / fuel / boost':'선체 / 연료 / 부스터',`${Math.ceil(s.hp)}/${maxHp(s)} · ${Math.ceil(s.fuel)}/${maxFuel(s)} · ${Math.floor(s.boost)}/${CAPTAINS[s.captain].boost}`],
    [en?'Crew / scrap':'선원 / 고철',`${Math.ceil(s.crewHp)}/100 · ${s.combat?.ammo??0}/12`],
    [en?'Equipment':'장비',s.equipment.map(id=>tr(GEAR[id])).join(' · ')||(en?'None':'없음')],
    [en?'Recovered tools':'회수 도구',s.tools.map(id=>tr(FLOOR_TOOLS.find(t=>t.id===id).name)).join(' · ')||(en?'None':'없음')],
    [en?'Build':'선체 개조',tr(BUILDS[s.build])],
    [en?'Time underway':'항해 경과',`${Math.floor(s.time/60)}:${String(Math.floor(s.time%60)).padStart(2,'0')}`]
  ];
  if(s.build==='bilge')rows.push([en?'Flood / valve':'침수 / 밸브',`${Math.floor(s.flood)}% · ${s.valve?(en?'Open':'열림'):(en?'Shut':'닫힘')}`]);
  if(s.build==='winch')rows.push([en?'Stored charge':'저장 축력',Math.floor(s.charge)]);
  if(s.tow)rows.push([en?'Supply boat':'보급정',`${Math.ceil(s.tow.hp)}/80 · ${s.tow.delivered?(en?'Delivered':'도착'):s.tow.hp<=0?(en?'Sunk':'침몰'):s.tow.anchor?(en?'Anchored':'닻 내림'):(en?'Anchor raised':'닻 올림')}`]);
  const build=s.build==='bilge'?(en?'B toggles the intake valve. More water increases thrust; flooding at 100% sinks the boat. Flooding is held while moored or ashore.':'B로 흡수 밸브를 여닫습니다. 물을 받으면 추진력이 높아지지만 침수 100%에서 침몰합니다. 계류·하선 중에는 침수가 유지됩니다.'):
    s.build==='winch'?(en?'Charge builds on a taut boss line. At 35 charge, B releases it during hook exposure with tension above 10%, spends up to 3 fuel and recoils the tug.':'보스 고리의 줄을 팽팽히 당겨 축력을 모읍니다. 축력 35 이상, 고리 노출 중, 장력 10% 초과에서 B로 방출합니다. 연료를 최대 3 쓰고 배가 반동으로 밀립니다.'):
      en?'Shift boosts; Space brakes. Boost recovers during ordinary travel.':'Shift로 가속하고 Space로 감속합니다. 일반 운항 중 부스터가 회복됩니다.';
  return `<details id="rogueVoyageDetails"><summary>${en?'Voyage information':'항해 정보'}</summary><dl class="rogue-detail-list">${rows.map(([label,value])=>`<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl><h3>${en?'Build operation':'빌드 운용'}</h3><p>${escape(build)}</p><h3>G · ${escape(model.skill.name)}</h3><p>${escape(en?skillDescriptions[s.captain]:spec.instruction+' · '+spec.effect+' '+spec.risk)}</p><p>${en?'Cost':'비용'}: ${en?'boost':'부스터'} ${spec.boost} · ${en?'fuel':'연료'} ${spec.fuel} · ${en?'cooldown':'재사용'} ${spec.cooldown}${en?'s':'초'}</p></details>`;
}
