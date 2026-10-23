import {objective,berthAlignment,shoreSearchStatus,CAPTAINS,BUILDS,GEAR,maxHp,maxFuel} from './rogue-core.js';
import {dockAlignmentHint} from './docking-readiness.js';
import {DEPTHS} from './rogue-map.js';
import {FLOOR_TOOLS,SHORE_SITES} from './shore-encounters.js';
import {skillStatus} from './captain-skills.js';
import {motionLabel,waterMotion,shipMotionStatus} from './ship-motion.js';
import {towBow} from './rogue-tow.js';
import {salvageHudCondition,salvageDeviceName} from './rogue-salvage-ui.js';
import {rigEffects} from './rogue-salvage.js';
import {harborPlanSummary,pendingRescueDestination} from './harbor-plan-ui.js';
import {harborDestination} from './harbor-plan.js';
import {usesSluice,sluiceStatus} from './sluice-counterplay.js';
import {usesLighthouse,lighthouseStatus,LIGHTHOUSE} from './lighthouse-counterplay.js';
import {rescueStatus,rescueBerth} from './shore-rescue.js';
import {visibleAt} from './rogue-vision.js';
import {recentImpact,gateImpactText} from './rogue-impact.js';

const escape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const translations={
  'E · 정비공과 함께 승선':'E Board with the mechanic',
  'E · 혼자 승선 · 정비공은 부두에 남음':'E Board alone · mechanic stays ashore',
  'E · 정비공 기다리기':'E Ask the mechanic to wait',
  'E · 정비공 따라오기':'E Ask the mechanic to follow',
  '정비공이 멈췄다 · 짐승을 유인하거나 물리치기':'Mechanic stopped · lure or fight the animals',
  '정비공에게 돌아가기 · 너무 멀어졌다':'Return to the mechanic · too far ahead',
  '정비공이 지나올 길 확보':'Clear a path for the mechanic',
  '정비공 도착 · 함께 승선':'Mechanic ready · board together',
  '정비공이 사다리에 올 때까지 기다리기':'Wait for the mechanic at the ladder',
  '정비공을 배까지 호위':'Escort the mechanic to the boat',
  '정비공은 부두에서 기다리는 중':'Mechanic waiting on the quay',
  '정비공이 보이는 곳으로 돌아가기':'Return to where you can see the mechanic',
  '고립된 정비공 · 가까이 가서 E':'Stranded mechanic · approach and press E',
  'E · 가까이서 따라오기':'Approach · E Ask to follow',
  'Q 유인 · Space 근접 · V 투척':'Q Lure · Space Melee · V Throw',
  '정비공과 함께 등대에 도착했어. 직접 증언도 전했어.':'The mechanic reached the lighthouse with us. We sent their account too.',
  '폐항에 남은 정비공의 위치도 전했어. 후속 구조가 필요해.':'We sent the location of the mechanic left at the harbor. They still need rescue.',
  '걷어 온 폐어망 기록도 함께 보냈어.':'The recovered fishing net is recorded too.',
  '이제 등대는 돌아오는 배를 비춰.':'The lighthouse now guides the boats home.',
  '정비공: 같이 가요. 짐승이 길을 막으면 못 움직여요. 너무 앞서가지 말아요.':'Mechanic: Let’s go together. I cannot move past those animals. Please do not get too far ahead.',
  '정비공: 여기서 기다릴게요. 돌아오면 다시 불러 주세요.':'Mechanic: I will wait here. Come back and call me when you are ready.',
  '정비공: 여기 사람이 있어요! 가까이 와서 E로 불러 주세요. 배까지 데려가면 공구와 구급품을 나눌게요.':'Mechanic: Someone is still here! Come closer and press E. Get me to the boat and I can share tools and medical supplies.',
  '정비공: 앞에 짐승이 있어요! Q로 유인하거나 길을 확보해 주세요.':'Mechanic: There are animals ahead! Lure them with Q or clear a path.',
  'Park: 정비공은 아직 부두에 있어. 다시 내려서 데려올 수 있어.':'Park: The mechanic is still on the quay. We can go ashore again and bring them back.',
  '정비공: 배에 탔어요. 챙긴 공구로 선체를 손보고, 구급품과 고철도 나눠둘게요. 제 이름도 명부에 올려 주세요.':'Mechanic: I am aboard. I will use my tools to repair the hull and share medical supplies and scrap. Please add my name to the manifest.',
  'Park: 정비공은 폐항에 남았어. 확인한 위치는 명부에 남겨둘게.':'Park: The mechanic stayed at the harbor. I will record where we found them in the manifest.',
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
  '크레인을 구동부 위로 유인 · 고정되면 회피':'Lure the crane over a drive · dodge when its aim locks',
  '표적 고정 · 지금 원 밖으로 회피':'Target locked · leave the circle now',
  '낙하 지점에서 벗어나기':'Move clear of the drop zone',
  '방류 예고 띠에서 벗어나기':'Leave the discharge warning strip',
  '물살로 축력 모으기 · E 분리 / 축력 35에서 B 발진':'Charge against the flow · E release / B launch at 35 charge',
  '계류 고리에 연결 · E로 놓고 방류 타기':'Moored to a cleat · E release and ride the discharge',
  '물살을 타고 동쪽으로 가속 · 잠금판에 선수 충돌':'Ride the flow east · strike the plate bow first',
  '역류 · 닫힌 수문에서 물러나기':'Backwash · move clear of closed gates',
  '수로 고정 · 동쪽으로 선수 정렬':'Lane locked · point the bow east',
  '방류할 수로 유도 · 고정되면 상류에서 가속 준비':'Choose the discharge lane · prepare an upstream run-up when it locks',
  '다음 방류 준비 · 상류로 돌아가 가속 거리 확보':'Prepare for discharge · return upstream for a run-up',
  '명부 확인 완료 · 등대 부두에 접안해 최종 전송 · E':'Manifests verified · dock at the lighthouse for the final delivery · E',
  '충격탄 표적 고정 · 원 밖으로 회피':'Impact target locked · leave the circle',
  '중계기에 접근 · E 케이블 접속':'Approach a relay · E Connect cable',
  '케이블 범위 안으로 돌아가기':'Return within cable range',
  '방파제 뒤에서는 송신 불가 · 등대가 보이는 수면으로':'Radio path blocked by the breakwater · move into view of the lighthouse',
  '선수를 등대 쪽으로 맞추기':'Point the bow at the lighthouse',
  'Space 감속 · 속도 18 이하로 송신':'Space Brake · transmit at speed 18 or below',
  '명부 송신 중 · 자세와 저속 유지':'Transmitting manifest · hold heading and low speed',
  '세 계층 돌파 · 마지막 신호를 전달했다':'Three regions cleared · the last signal was delivered',
  '등대 봉쇄 포격으로 선체가 파손됐다':'The lighthouse blockade bombardment destroyed the tug.',
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
  'F / R 수색 · 길게 누른 뒤 장비 또는 보급 선택':'Hold F / R to search, then choose equipment or supplies',
  'Woo: 부품은 보급으로 바꿨어. 선체를 수리하고 물을 빼뒀어.':'Woo: Traded the parts for supplies. Repaired the hull and drained the water.',
  'Woo: 부품은 보급으로 바꿨어. 쓸 수 있는 연료를 챙겼어.':'Woo: Traded the parts for supplies. Took the fuel we can carry.',
  'Woo: 부품은 보급으로 바꿨어. ':'Woo: Traded the parts for supplies. ',
  '항해 종료':'Run ended','장비 선택 중':'Choose equipment','운항 중 사용':'Underway only',
  'G · 버팀 해제':'G · Release brace','사용 중':'Active','준비':'Ready',
  '연료 여유 필요':'Fuel reserve required','공격 예고 초반에 사용':'Early attack warning only',
  '고리 연결 · 장력 35% 필요':'Hook + 35% tension required',
  '방류 중 · 고리 연결 · 장력 35% 필요':'Open-plate discharge · hook + 35% tension required',
  '탐조등 탐색 중 사용':'Use while the searchlight is searching',
  '탐색 중 · 케이블 연결 · 장력 35% 필요':'Searching · cable + 35% tension required',
  '탐조등 붙잡기':'Hold searchlight',
  '비상 버팀':'Emergency brace','횡추진':'Side jet','미끼 부표':'Decoy buoy','구동부 결박':'Drive bind'
};
Object.assign(translations,{
  'Park: 「전원 대피」 기록, 정정됐어. ':'Park: The “all evacuated” record is corrected. ',
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
  'Park: 버킷이 우릴 따라와. 구동부 위로 유인하고 원이 멈추면 빠져! 멈춘 동안 고리를 당겨도 돼.':'Park: The bucket is following us. Lure it over a drive, then dodge when the circle stops! Pull the hooks while it rests.',
  'Woo: 자기 구동부를 찍었어! 고리를 당겨 마무리하자.':'Woo: It hit its own drive! Pull the hooks to finish it.',
  'Park: 흡입 펌프가 멈췄어. 이제 덜 끌려가!':'Park: The suction pump has stopped. The pull is weaker now!',
  'Woo: 크레인 구동부가 나갔어. 다음 낙하 준비가 느려졌어.':'Woo: The crane drive is broken. We have more warning before the next drop.',
  'Park: 방류 전에 수면에 띠가 보여. 물살이 멎으면 터빈 고리를 당기자.':'Park: A warning strip appears before discharge. Pull the turbine hooks when the flow stops.',
  'Park: 돌아오는 배만 막고 있어. 방류 때 노란 잠금판이 열려! 물살을 타고 동쪽으로 가속해서 선수로 쳐!':'Park: It is only blocking returning boats. The yellow plates open during discharge! Ride the flow east and strike with the bow!',
  'Woo: 빛이 우리를 쫓아와. 조준이 멈추면 벗어나. 발전기 고리는 충전하는 동안 노출돼.':'Woo: The light is tracking us. Dodge when its aim locks. The generator hooks are exposed while it recharges.',
  'Park: 구동부가 멈췄어. 탈출 부두에 접안하면 다음 항로로 이어져.':'Park: The drives have stopped. Dock at the exit to continue along the route.',
  'Han: 수문 세 개 전부 열렸어. 봉쇄 명령은 등대에서 왔어… 돌아오는 배를 누가 막은 거지?':'Han: All three gates are open. The blockade order came from the lighthouse… Who was stopping the boats from coming back?',
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
  'Jeong: 구동부 잡았어! 줄 늘어지지 않게 계속 당겨!':'Jeong: Drive bound! Keep pulling; do not let the line go slack!',
  'Jeong: 방류를 붙잡았어! 줄이 느슨해지지 않게 버텨!':'Jeong: Holding the discharge! Keep the line taut!'
});
Object.assign(translations,{
  'Park: 등대는 대피가 끝났다고 믿고 배를 막고 있어. 중계기 세 곳에 E로 접속해. 선수를 등대로 맞추고 Space로 감속하면 남은 사람들 명부를 보낼 수 있어.':'Park: The lighthouse thinks evacuation is complete and is blocking the boats. Use E at all three relays. Point the bow toward the lighthouse and brake with Space to send the names of those still here.',
  'Han: 세 명부가 대조됐어. 봉쇄 해제! 등대 부두에 직접 대서 원본까지 전달하자.':'Han: All three manifests are verified. The blockade is lifted! Dock at the lighthouse to deliver the originals.',
  'Woo: 표적이 멈췄어! 원 밖으로 빠져. 방파제 뒤에서는 탐조등이 우릴 못 봐.':'Woo: The target has stopped! Leave the circle. The breakwaters can hide us from the searchlight.',
  'Park: 폐항 명부 수신 확인. 「대피 완료」라던 선착장에 사람이 남아 있었어.':'Park: Harbor manifest received. People were still at the landing marked as evacuated.',
  'Han: 수문 기록 수신 확인. 구조 요청은 왔는데 자동 봉쇄가 해제되지 않았어.':'Han: Sluice record received. The rescue call came through, but the automatic blockade never lifted.',
  'Woo: 등대 명부 수신 확인. 돌아오는 배를 막을 이유가 이제 없어.':'Woo: Lighthouse manifest received. There is no reason to block the returning boats now.',
  'Park: 차광 신호기 찾았어. 탐조등에 발각되기까지 시간이 늘어나. 다음 층에도 가져갈 수 있어.':'Park: Found the light shutter. It gives us more time before the searchlight detects us. We can carry it into the next region.',
  'Han: 탐조등에 보이는 수면으로 부표를 던져야 해.':'Han: Throw the buoy into water the searchlight can see.',
  'Jeong: 중계기로 회전 잠갔어! 줄이 느슨해지기 전에 송신해!':'Jeong: The relay is holding the rotation! Transmit before the line goes slack!'
});
for(const cargo of [false,true])for(const clean of [false,true]){
  const ko='Park: 「전원 대피」 기록, 정정됐어. '+(cargo?'보급정 귀항 기록까지 함께 전송했어.':'우리가 확인한 사람들 이름을 전송했어.')+
    (clean?' 걷어 온 폐어망 기록도 함께 보냈어.':'')+' 이제 등대는 돌아오는 배를 비춰.';
  translations[ko]='Park: The “all evacuated” record is corrected. '+(cargo?'We also sent the supply boat’s return record.':'We sent the names of the people we found.')+
    (clean?' The recovered fishing net is recorded too.':'')+' The lighthouse now guides the boats home.';
}
const salvageClues={
  standard:['속도를 낸 뒤 Space로 모으고, Shift로 다시 튀어나가 봐.','Build up speed, store energy with Space, then burst forward with Shift.'],
  bilge:['침수 20%를 모아 열린 밸브를 B로 닫아 봐. 물을 뒤로 뿜어내.','Collect 20% flooding, then close the open valve with B. It jets the water out behind us.'],
  winch:['축력을 모아 E로 줄을 놓고, B로 빠져나와. 저장된 힘은 금방 풀려.','Build up tension, release the line with E, then escape with B. The stored energy expires quickly.']
};
for(const [build,[ko,en]] of Object.entries(salvageClues)){
  const name=salvageDeviceName({build}),english=salvageDeviceName({build},'en');
  translations['Park: '+name+'도 찾았어. '+ko]='Park: Found a '+english+'. '+en;
  translations['Woo: '+name+' 개조 끝. 다음 물살에 써 보자.']='Woo: The '+english+' is modified. Try it in the next channel.';
}
translations['Woo: 개조 부품을 수리에 썼어. 이번엔 배를 지키면서 가자.']='Woo: We used the parts for repairs. Keep the boat safe this time.';
translations['Woo: 개조 부품을 연료로 바꿨어. 다음 부두까지 더 뒤져볼 수 있겠어.']='Woo: We traded the parts for fuel. We can explore more before the next quay.';
for(let lane=1;lane<=3;lane++)translations[`Woo: ${lane}번 잠금 풀렸어! 열린 수로는 다시 닫히지 않아.`]=`Woo: Gate ${lane} is unlocked! An open lane stays open.`;
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
for(const site of SHORE_SITES)for(const name of Object.values(GEAR))translations['Park: '+site+' 표식에 '+name+'가 있어. M 해도에 남겨둘게.']='Park: '+translations[site]+' lists a '+translations[name]+'. Marked on the M chart.';
for(const site of SHORE_SITES)translations['Park: '+site+'에 차광 신호기가 있어. 탐조등에 발각되기까지 시간을 더 벌 수 있어.']='Park: '+translations[site]+'. A light shutter is there. It gives us more time before searchlight detection.';
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
  han:'Direction + G throws a decoy during the early attack warning. Aim follows the buoy; unavailable once the aim locks.',
  jeong:'G holds the exposed drive for up to 3 seconds while hooked with at least 35% tension. Slack or disconnection ends the bind.'
};
export function rescueHudCondition(s,language='ko'){
  const a=rescueStatus(s),en=language==='en';
  if(!a?.discovered||s.status!=='playing'||s.boss.active&&!s.boss.cleared)return null;
  const item=(text,tone='normal')=>({id:'rescue',text,tone});
  if(a.stage==='aboard'){
    const receipt=s.voyageRecord?.events.findLast(e=>e.kind==='rescue'&&e.outcome==='aboard');
    return receipt&&s.time-receipt.time<6?item(en?'Mechanic aboard':'정비공 승선 완료','ready'):null;
  }
  if(!a.active)return null;
  const destination=pendingRescueDestination(s,language);
  if(s.mode==='sailing'&&s.boss.cleared&&destination)return item(en?`Mechanic not aboard · ${destination.name} · M Chart`:`정비공 미승선 · ${destination.name} · M 해도`,'warning');
  if(s.mode==='moored'&&s.mooring===rescueBerth(s)?.id)return item(en?'Mechanic still ashore · E to return':'정비공 미승선 · E 내려서 다시 동행','warning');
  if(s.mode!=='ashore')return null;
  if(a.boarding)return a.ready?item(en?'Mechanic ready to board with you':'정비공 함께 승선 준비 완료','ready'):item(en?'Mechanic is still on the quay':'정비공은 아직 부두에 있습니다','warning');
  const visible=visibleAt(s,a.point);
  if(!visible)return a.stage==='following'?item(en?'Mechanic out of sight · go back to check':'정비공이 보이지 않습니다 · 돌아가서 확인','warning'):null;
  if(a.blocked==='threat')return item(en?'Mechanic stopped · clear a safe path':'정비공 멈춤 · 안전한 길 확보','warning');
  if(a.blocked==='distant')return item(en?'Too far ahead · return to the mechanic':'너무 멀어졌습니다 · 정비공에게 돌아가기','warning');
  if(a.blocked==='route')return item(en?'Path blocked · return along open ground':'정비공 길 막힘 · 열린 길로 돌아가기','warning');
  return item(a.stage==='following'?(en?'Mechanic following · reach the ladder together':'정비공 동행 중 · 사다리까지 함께 이동'):(en?'Mechanic waiting · approach, then E':'정비공 대기 중 · 가까이서 E 동행'));
}
function defensePrompt(s,language,ground){
  const en=language==='en',c=s.combat,parts=[];
  if(c.cooldown>0)parts.push(en?`Attack ready in ${(Math.ceil(c.cooldown*10)/10).toFixed(1)}s`:`공격 준비 ${(Math.ceil(c.cooldown*10)/10).toFixed(1)}초`);
  else{
    if(s.person)parts.push(en?'Space Melee':'Space 근접');
    if(c.ammo>0)parts.push(en?'V / click Throw scrap':'V / 클릭 고철 투척');
  }
  if(!c.ammo)parts.push(en?'No scrap':'고철 없음');
  if(ground)parts.push(en?'Q Lure':'Q 유인');
  if(!s.person&&!c.ammo)parts.push(en?'Move away from gulls':'갈매기에게서 벗어나기');
  return {id:'defense',text:(!s.person?(en?'Gulls · ':'갈매기 대응 · '):'')+parts.join(' · '),tone:c.ammo?'normal':'warning'};
}
// Supplemental prompts never replace an E interaction. Search eligibility is
// shared with the held-input rules; defense uses only currently visible actors.
export function shoreHudContext(s,language='ko'){
  const en=language==='en',result={search:null,defense:null};
  if(s.status!=='playing'||s.pendingCache||s.pendingGear||s.salvage?.pending)return result;
  const search=shoreSearchStatus(s);
  if(search){
    const interrupted=search.progress<=0?search.interruption:null;
    const cause=interrupted?.reason==='hit'?(en?'Hit interrupted search':'피격으로 수색 중단'):interrupted?.reason==='attack'?(en?'Your attack interrupted search':'공격으로 수색 중단'):null;
    let text=null,tone='normal';
    if(search.berth&&search.blocked){
      text=cause?cause+(en?' · wait, then retry':' · 잠시 후 재시도'):
        search.blocked==='hit'?(en?'Taking a hit · search paused':'피격 중 · 수색 대기'):(en?'Attacking · search paused':'공격 중 · 수색 대기');tone='warning';
    }else if(search.available){
      text=cause?cause+(en?' · hold F / R again':' · F / R 다시 길게'):
        search.choiceMode?(en?'Hold F / R · search crate':'F / R 길게 · 상자 수색'):(en?'Hold F / R · recover contents':'F / R 길게 · 물품 회수');
      if(cause)tone='warning';
    }else if(cause){text=cause+(en?' · return to the crate to retry':' · 상자 가까이에서 재시도');tone='warning';}
    if(text)result.search={id:'search',text,tone,progress:search.progress,required:search.required};
  }
  const c=s.combat,p=s.person||s.boat;if(!c)return result;
  // Match the current automatic throw acquisition distances. Visibility is an
  // additional presentation constraint, never an offscreen threat detector.
  const visible=c.enemies.filter(e=>e.hp>0&&(s.person||e.kind==='gull')&&
    Math.hypot(e.x-p.x,e.y-p.y)<(s.person?210:320)&&visibleAt(s,e));
  if(!visible.length)return result;
  result.defense=defensePrompt(s,language,!!s.person&&visible.some(e=>e.kind!=='gull'));
  return result;
}
const gauge=(value,max,label,marks=[])=>({value,max,label,marks});
// Display the resolved loss, never a guessed collision or the previous log hit.
export function impactPresentation(hit,language='ko'){
  if(!hit)return null;
  const en=language==='en',amount=hit.amount<.1?'<0.1':String(Number(hit.amount.toFixed(1)));
  const target=en?{hull:'Hull',crew:'Crew',scrap:'Scrap'}[hit.target]:{hull:'선체',crew:'선원',scrap:'고철'}[hit.target];
  const names=en?{collision:'Collision',sluice:'Sluice surge',crane:'Crane strike',lighthouse:'Lighthouse fire',machine:'Machine attack',dog:'Dog attack',rat:'Rat attack',crab:'Crab attack',gull:'Gull attack'}:
    {collision:'충돌',sluice:'수문 방류',crane:'크레인 낙하',lighthouse:'등대 포격',machine:'기계선 공격',dog:'들개 공격',rat:'시궁쥐 공격',crab:'대왕 게 공격',gull:'갈매기 습격'};
  const contact=en?{terrain:'Quay / terrain collision',structure:'Machinery collision',drive:'Drive collision'}:
    {terrain:'안벽·지형 충돌',structure:'기계 구조물 충돌',drive:'구동부 충돌'};
  const cause=hit.target==='scrap'?(en?'Gull theft':'갈매기 약탈'):hit.source==='sluice'?gateImpactText(hit.contact,language):hit.source==='collision'?(contact[hit.contact]||names.collision):names[hit.source];
  const loss=target+' −'+amount;
  return {...hit,cause,loss,text:cause+' · '+loss,metric:hit.target==='scrap'?'ammo':hit.target};
}

// A presentation of the shared readiness query, not a second docking rule.
export function dockAlignmentPresentation(alignment,language='ko',s=null){
  if(!alignment)return null;
  const en=language==='en',a=alignment;
  const destination=s&&(harborDestination(s)?.point||(s.boss.cleared?s.map.exit:null));
  const optional=!!destination&&(destination.x!==a.berth.x||destination.y!==a.berth.y);
  const active={brake:'speed',settle:'spin',turn:'heading',approach:'position',maneuver:'clearance'}[a.next.kind];
  const checks=[['position',en?'Position':'위치'],['heading',en?'Bow':'방향'],['speed',en?'Speed':'속도'],['spin',en?'Turn':'회전']]
    .map(([id,label])=>({id,label,ok:a.checks[id],active:active===id&&!a.checks[id],
      ratio:(id==='speed'||id==='spin')?Math.min(2,a.status[id]/a.limits[id]):null}));
  if(!a.checks.clearance)checks.unshift({id:'clearance',label:en?'Hull':'선체',ok:false,active:true,ratio:null});
  return {title:optional?(en?'Optional stop':'주변 접안(선택)'):a.exit?(en?'Exit alignment':'탈출 접안'):!a.checks.position&&['turn','approach'].includes(a.next.kind)?(en?'Approach berth':'접안점 접근'):(en?'Berth alignment':'접안 정렬'),optional,
    hint:dockAlignmentHint(a,language),kind:a.next.kind,ready:a.status.ready,checks,
    tone:a.status.ready?'ready':['maneuver','resource','ability'].includes(a.next.kind)?'warning':'normal'};
}
const percent=(value,max)=>Math.max(0,Math.min(100,value/max*100));
function instrument(g){
  if(!g)return '';
  const value=Math.max(0,Math.min(g.max,g.value));
  return `<svg class="rogue-gauge" viewBox="0 0 100 8" preserveAspectRatio="none" role="meter" aria-label="${escape(g.label)}" aria-valuemin="0" aria-valuemax="${g.max}" aria-valuenow="${Number(value.toFixed(2))}" aria-valuetext="${escape(`${Number(value.toFixed(1))} / ${g.max}${g.marks.length?' · '+g.marks.map(m=>m.label).join(' · '):''}`)}"><rect class="gauge-track" x="0" y="2" width="100" height="4" aria-hidden="true"/>${g.band?`<rect class="gauge-band" x="${percent(g.band[0],g.max)}" y="1" width="${percent(g.band[1]-g.band[0],g.max)}" height="6" aria-hidden="true"/>`:''}<rect class="gauge-fill" x="0" y="2" width="${percent(value,g.max)}" height="4" aria-hidden="true"/>${g.marks.map(m=>`<line class="gauge-mark" data-gauge-mark="${m.value}" x1="${percent(m.value,g.max)}" x2="${percent(m.value,g.max)}" y1="0" y2="8" vector-effect="non-scaling-stroke" aria-hidden="true"><title>${escape(m.label)}</title></line>`).join('')}</svg>`;

}

// Read-only presentation. Objective/action eligibility comes from objective();
// skill eligibility comes from skillStatus(). No simulation state is changed.
export function rogueHudModel(s,language='ko'){
  const en=language==='en',tr=text=>rogueHudText(text,language),guide=objective(s),skill=skillStatus(s);
  const ashore=s.mode==='ashore',sailing=s.mode==='sailing';
  const crane=s.bossModel==='counterplay-v1'&&s.depth===0?s.boss.crane:null;
  const sluice=usesSluice(s)?sluiceStatus(s):null;
  const lighthouse=usesLighthouse(s)?lighthouseStatus(s):null;
  const fighting=s.boss.active&&!s.boss.cleared;
  const model={language,mode:s.mode,mission:tr(guide.text),fullObjective:tr(guide.text),
    region:`${s.depth+1}/3 · ${tr(DEPTHS[s.depth].name)} · ${CAPTAINS[s.captain].name}`,
    metrics:[],conditions:[],action:'',context:[],work:null,boss:null,
    motion:waterMotion(s)?shipMotionStatus(s).mode:'legacy',
    skill:{...skill,name:en?skillNames[s.captain]:skill.name,reason:tr(skill.reason),
      active:s.skill.left>0,remaining:s.skill.left,remainingCooldown:s.skill.cooldown,compact:!sailing,
      usable:skill.ready||sailing&&s.captain==='woo'&&s.skill.left>0}
  };
  const metric=(id,label,value,max,raw=value,marks=[])=>model.metrics.push({id,label,value,max,gauge:max===undefined?null:gauge(raw,max,label,marks)});
  const condition=(id,text,tone='normal',extra={})=>model.conditions.push({id,text,tone,...extra});
  if(ashore){
    metric('crew',en?'Crew':'선원',Math.ceil(s.crewHp),100,s.crewHp);
    if(s.combat)metric('ammo',en?'Scrap':'고철',s.combat.ammo,12);
    model.action=tr(guide.action);
    if(s.hp<maxHp(s))condition('hull',`${en?'Hull damage':'선체 손상'} ${Math.ceil(s.hp)}/${maxHp(s)}`,'warning');
  }else{
    metric('hull',en?'Hull':'선체',Math.ceil(s.hp),maxHp(s),s.hp);
    metric('fuel',en?'Fuel':'연료',Math.ceil(s.fuel),maxFuel(s),s.fuel);
    metric('boost',en?'Boost':'부스터',Math.floor(s.boost),CAPTAINS[s.captain].boost,s.boost,[{value:skill.boost,label:(en?'G boost cost ':'G 부스터 비용 ')+skill.boost}]);
    if(s.combat)metric('ammo',en?'Scrap':'고철',s.combat.ammo,12);
    model.action=s.mode==='moored'?tr(guide.text):
      waterMotion(s)?motionLabel(s,language):en?'Underway':'운항 중';
    if(!s.boss.active&&!s.boss.cleared&&SHORE_SITES.some(site=>guide.text.startsWith(site))){
      const site=SHORE_SITES.find(site=>guide.text.startsWith(site));
      model.mission=tr(site)+(en?' · Search':' 수색');
    }else if(guide.text.includes('장비 없이 보스')){
      model.mission=en?'Explore the harbor':'항구 탐색';
    }else if(s.boss.active&&!s.boss.cleared&&!sluice&&!lighthouse){
      model.mission=s.boss.hook>=0?(en?'Pull the exposed drive':'노출된 구동부 견인'):
        s.boss.phase==='recover'?(en?'Connect an exposed hook':'노출된 고리 연결'):tr(guide.text);
      if(s.boss.hook>=0){
        metric('tension',en?'Tension':'장력',`${Math.round(s.boss.tension*100)}%`);
        model.metrics.at(-1).gauge=gauge(s.boss.tension*100,100,en?'Tension':'장력',[
          {value:s.build==='winch'?10:15,label:s.build==='winch'?(en?'Release tension >10%':'방출 장력 10% 초과'):(en?'Pull tension >15%':'견인 장력 15% 초과')}
        ]);
        model.action=en?'Pull away · E Release':'고리에서 멀리 · E 분리';
      }else if(s.boss.phase==='recover')model.action=en?'Approach a hook · E Connect':'고리에 접근 · E 연결';
    }
  }
  const escort=rescueStatus(s);
  if(ashore&&escort?.active&&escort.discovered){
    if(escort.boarding)model.action=tr(escort.ready?'E · 정비공과 함께 승선':'E · 혼자 승선 · 정비공은 부두에 남음');
    if(guide.rescue&&!visibleAt(s,escort.point)){
      model.mission=en?'Return to check on the mechanic':'정비공에게 돌아가서 확인';model.fullObjective=model.mission;
    }
  }
  // objective() supplies the immediate interaction and can name a passing
  // quay. Read the explicit chart destination separately for the voyage goal.
  const destination=sailing&&s.status==='playing'&&!s.pendingCache&&!s.pendingGear&&!s.salvage?.pending?harborDestination(s):null;
  const planGuide=destination?{target:destination.point,...(destination.id==='boss'?{planBoss:true}:{planSite:destination.id})}:guide;
  const planned=harborPlanSummary(s,planGuide,language);
  if(planned){
    model.mission=planned.title;
    model.plan=planned.detail;
    model.fullObjective=model.mission+' · '+model.plan;
  }
  // The locked circle takes priority over a lingering tow prompt. Recovery
  // still uses the existing hook, tension and captain-skill eligibility.
  if(crane&&sailing&&fighting){
    if(s.boss.phase==='warn'){
      model.mission=crane.locked?(en?'Target locked · dodge now':'표적 고정 · 지금 회피'):
        crane.target?(en?'Lure the crane over a drive':'크레인을 구동부로 유인'):(en?'Crane preparing':'크레인 낙하 준비');
      model.action=crane.locked?(en?'Leave the drop circle':'낙하 원 밖으로 이동'):
        crane.target?(en?'Dodge when the circle locks':'원이 고정되면 밖으로 회피'):(en?'Watch for the target circle':'표적 원을 확인');
    }else if(s.boss.phase==='attack'){
      model.mission=en?'Crane drop':'크레인 낙하';
      model.action=crane.impact?(en?'Stay clear · hooks open next':'원 밖에서 고리 노출 대기'):(en?'Leave the drop circle':'낙하 원 밖으로 이동');
    }
  }
  if(crane&&sailing){
    const age=s.time-crane.hitAt;
    const hit=Number.isInteger(crane.lastHit)&&crane.lastHit>=0&&crane.lastHit<2&&
      crane.lastDamage>0&&crane.hitAt>=0&&age>=0&&age<2.2;
    const names=en?['Suction pump','Crane drive']:['흡입 펌프','크레인 구동부'];
    const effects=en?['Suction weakened','Next warning extended']:['흡입 약화','다음 공격 예고 연장'];
    if(hit){
      const part=crane.lastHit,destroyed=s.boss.parts[part]<=0;
      condition('dredger-hit',`✓ ${en?'Self-hit':'유인 명중'} · ${names[part]} ${destroyed?(en?'destroyed':'파괴'):(en?'hit':'타격')}${destroyed?' · '+effects[part]:''}`,'ready',{emphasis:true});
    }
    const broken=[0,1].filter(i=>s.boss.parts[i]<=0&&!(hit&&crane.lastHit===i));
    if(fighting&&broken.length)condition('dredger-effect',broken.map(i=>effects[i]).join(' · '));
  }
  if(sluice&&sailing&&fighting){
    const lane=sluice.lane+1;
    metric('east-speed',`${en?'East speed':'동쪽 속도'} (${sluice.requiredSpeed}+)`,Math.floor(sluice.speed));
    if(sluice.hooked){
      metric('tension',en?'Tension':'장력',`${Math.round(s.boss.tension*100)}%`);
      model.metrics.at(-1).gauge=gauge(s.boss.tension*100,100,en?'Mooring tension':'계류 장력');
    }
    if(sluice.phase==='warn'){
      model.mission=sluice.locked?(en?`Lane ${lane} locked`:`${lane}번 수로 고정`):(en?`Aim discharge into lane ${lane}`:`${lane}번 수로로 방류 유도`);
      model.action=en?'Line up in the target lane · bow east':'목표 수로 중앙으로 · 선수는 동쪽';
    }else if(sluice.backwash){
      model.mission=en?'Backwash · stop ramming':'역류 · 돌파 중지';
      model.action=en?'Watch the westward flow · reset upstream':'서쪽 역류 주의 · 상류에서 다음 방류 준비';
    }else if(sluice.exposed){
      model.mission=en?`Ram lane ${lane}'s open plate`:`${lane}번 열린 잠금판 돌파`;
      model.action=sluice.hooked?(sluice.canBurst?(en?'B Release & launch away from cleat':'B 줄을 놓고 계류점 반대쪽 발진'):(en?'E Release · ride the flow east':'E 분리 · 동쪽 방류 타기')):
        !sluice.aligned?(en?'Turn the bow east':'선수를 동쪽으로 정렬'):
        !sluice.centred?(en?'Line up with the target lane centre':'목표 수로 중앙으로 정렬'):
        sluice.speed<sluice.requiredSpeed?(en?`Ride the flow · east speed ${sluice.requiredSpeed}+`:`방류를 타며 동쪽 속도 ${sluice.requiredSpeed} 이상`):
        (en?'Strike the open plate centrally, bow first':'열린 잠금판 중앙에 선수로 충돌');
    }else{
      model.mission=sluice.phase==='attack'?(en?'Gate unlocked · prepare next lane':'잠금 해제 · 다음 수로 준비'):(en?'Prepare for the next discharge':'다음 방류 준비');
      model.action=en?'Return upstream for a run-up':'상류로 돌아가 가속 거리 확보';
    }
    if(sluice.exposed&&!sluice.aligned)condition('sluice-heading',en?'Bow must face east →':'선수를 동쪽으로 →','warning');
  }
  if(sluice&&sailing&&sluice.hitAge>=0&&sluice.hitAge<2.2){
    const impacts=en?{
      opened:`✓ Gate opened · ${sluice.opened}/${sluice.total}`,
      slow:`Too slow · east speed ${sluice.requiredSpeed}+ required`,
      angle:'Wrong approach · strike bow first, heading east',
      closed:'Closed plate hit · wait for discharge',
      pier:'Pier hit · aim for the lane centre'
    }:{
      opened:`✓ 수문 개방 · ${sluice.opened}/${sluice.total}`,
      slow:`속도 부족 · 동쪽 속도 ${sluice.requiredSpeed} 이상 필요`,
      angle:'진입 방향 불일치 · 동쪽으로 선수 충돌',
      closed:'닫힌 잠금판 충돌 · 방류를 기다리세요',
      pier:'교각 충돌 · 수로 중앙을 노리세요'
    };
    if(impacts[sluice.lastImpact])condition('sluice-impact',impacts[sluice.lastImpact],sluice.lastImpact==='opened'?'ready':'warning',{emphasis:true});
  }
  if(lighthouse&&sailing&&fighting){
    const a=lighthouse,relay=a.index+1;
    // Round up at the speed limit: 18.01 must not appear to satisfy <=18.
    metric('signal-speed',`${en?'Speed':'속도'} (≤${a.maxSpeed})`,Math.ceil(a.speed));
    if(a.linked){
      metric('tension',en?'Tension':'장력',`${Math.round(s.boss.tension*100)}%`);
      model.metrics.at(-1).gauge=gauge(s.boss.tension*100,100,en?'Relay line tension':'중계기 연결 장력');
    }
    if(a.index>=0){
      const progress=(Math.floor(a.progress*10)/10).toFixed(1);
      condition('lighthouse-signal',`${en?'Relay':'중계기'} ${relay} · ${progress}/${a.required}${en?'s':'초'} · ${a.ready?(en?'Sending':'송신 중'):a.progress>0?(en?'Decaying':'진척 감소'):(en?'Awaiting link':'송신 준비')}`,a.ready?'ready':a.progress>0?'warning':'normal',
        {gauge:gauge(a.progress,a.required,en?'Relay transmission':'중계기 송신')});
    }
    if(a.phase==='warn'){
      const detected=Math.floor(Math.min(1,a.exposure/a.detection)*100);
      condition('lighthouse-detection',`${a.visible?(en?'In the beam':'빛에 노출'):!a.clear?(en?'Behind cover':'방파제 뒤'):(en?'Light searching':'탐조등 탐색')} · ${en?'Detection':'발각'} ${detected}%`,a.visible?'warning':'normal',
        {gauge:gauge(a.exposure,a.detection,en?'Detection buildup':'발각 누적')});
    }
    model.mission=a.ready?(en?`Sending at relay ${relay}`:`${relay}번 중계기 송신 중`):(en?`Transmit at relay ${relay}`:`${relay}번 중계기에 명부 송신`);
    model.action=!a.linked?(a.canConnect?(en?'E Connect to relay':'E 중계기 접속'):a.inRange&&a.towBlocked?(en?'T Release supply tow · then E Connect':'T 보급정 견인 해제 · 이후 E 접속'):(en?'Approach the next relay · E Connect':'다음 중계기에 접근 · E 접속')):
      !a.inRange?(en?'Move closer to the linked relay':'연결된 중계기에 더 가까이'):
      !a.clear?(en?'Clear the radio path to the lighthouse':'등대와의 송신선을 가리지 않는 곳으로'):
      !a.aligned?(en?'Point the bow at the lighthouse':'선수를 등대 쪽으로 정렬'):
      a.speed>a.maxSpeed?(en?`Space Brake · speed ≤${a.maxSpeed}`:`Space 감속 · 속도 ${a.maxSpeed} 이하`):
      (en?'Hold heading and low speed · E Disconnect':'방향·저속 유지 · E 접속 해제');
    if(a.phase==='attack'){
      model.mission=a.impact?(en?'Impact · stay clear':'충격탄 폭발 · 이탈 유지'):(en?'Target locked · dodge now':'표적 고정 · 지금 회피');
      model.action=a.linked?(en?'E Disconnect · leave the marked circle':'E 접속 해제 · 표적 원 밖으로'):(en?'Leave the marked circle':'표적 원 밖으로 이동');
    }else if(a.phase==='warn'&&a.visible){
      model.mission=en?'Spotted · leave the beam':'빛에 노출 · 탐조등 회피';
      model.action=a.linked?(en?'E Disconnect · move out of the light':'E 접속 해제 · 빛 밖으로 이동'):(en?'Leave the beam or use breakwater cover':'빛 밖으로 이동하거나 방파제 뒤로');
    }
  }
  if(lighthouse&&sailing){
    const a=lighthouse;
    if(a.hit&&a.hitAge>=0&&a.hitAge<2.2)condition('lighthouse-hit',en?'Hit · unfinished transmissions reset':'피격 · 미완료 송신 초기화','warning',{emphasis:true});
    if(a.lastSent>=0&&a.sentAge>=0&&a.sentAge<2.2)condition('lighthouse-sent',en?`✓ Relay ${a.lastSent+1} sent · retained`:`✓ ${a.lastSent+1}번 명부 전송 · 보존`,'ready',{emphasis:true});
    if(a.sent===a.total&&s.status==='playing'&&!guide.planSite){
      model.mission=en?'All manifests sent · dock at the lighthouse':'명부 전송 완료 · 등대 부두에 접안';
      model.action=tr(guide.text);
      model.boss=`${en?'Sent':'전송'} ${a.sent}/${a.total} · ${en?'Dock to finish':'접안해야 항해 완료'}`;
    }
  }
  if(s.build==='bilge'){
    const label=en?'Flood':'침수',valve=s.valve?(en?'Valve open':'밸브 열림'):(en?'Valve shut':'밸브 닫힘');
    condition('build',`${sailing?'B · ':''}${valve} · ${label} ${Math.floor(s.flood)}% · ${sailing?(en?'100% sinks':'100% 침몰'):(en?'Moored: held':'계류 중 유지')}`,s.valve&&sailing?'warning':'normal',{gauge:gauge(s.flood,100,label)});
  }else if(s.build==='winch'&&sailing&&!(s.salvage?.rank>0&&s.boss.hook<0)){
    const ready=lighthouse?lighthouse.canBurst:sluice?sluice.canBurst&&sluice.exposed:s.charge>=35&&s.boss.hook>=0&&s.boss.phase==='recover'&&s.boss.tension>.1;
    const hint=lighthouse?(ready?(en?'B Escape launch · fuel 3':'B 회피 발진 · 연료 3'):
      !lighthouse.linked?(en?'E Connect to relay':'E 중계기 접속'):
      s.fuel<=3?(en?'Needs >3 fuel':'연료 3 초과 필요'):
      s.boss.tension<=.1?(en?'Tighten relay line':'중계기 줄을 팽팽하게'):(en?'Charge to 35':'축력 35 필요')):
      sluice?(ready?(en?'B Launch · fuel 3':'B 발진 · 연료 3'):
      !sluice.hooked?(en?'E Mooring hook · optional':'E 계류 고리 · 선택'):
      !sluice.exposed?(en?'Wait for open plate · E Release':'잠금판 열림 대기 · E 분리'):
      s.fuel<=3?(en?'Needs >3 fuel':'연료 3 초과 필요'):
      s.boss.tension<=.1?(en?'Tighten mooring line':'계류줄을 팽팽하게'):(en?'Charge to 35':'축력 35 필요')):
      ready?(s.fuel<=3?(en?'B Release · empties fuel':'B 방출 · 연료 소진'):(en?'B Release · fuel 3':'B 방출 · 연료 3')):
      s.boss.hook<0?(en?'E Hook required':'E 고리 연결 필요'):
      s.boss.phase!=='recover'?(en?'Wait for exposure':'고리 노출 대기'):
      s.boss.tension<=.1?(en?'Tighten the line':'줄을 팽팽하게'):
      (en?'Charge to 35':'축력 35 필요');
    const effects=rigEffects(s),stack=effects.stacked&&s.boss.hook>=0&&s.boss.tension>.15?
      ready?` · ${en?'launch':'발진'} ×${Number(effects.winchLaunchMultiplier.toFixed(2))}`:
      ` · ${en?'charge':'충전'} ${Number(effects.winchChargeRate.toFixed(1))}${en?'/s':'/초'}`:'';
    condition('build',`${en?'Charge':'축력'} ${Math.floor(s.charge)} · ${hint}${stack}`,ready?'ready':'normal',{gauge:gauge(s.charge,100,en?'Stored charge':'저장 축력',[{value:35,label:en?'35 charge required':'축력 35 필요'}])});
  }
  const salvage=salvageHudCondition(s,language);
  if(salvage)model.conditions.push(salvage);
  const rescue=rescueHudCondition(s,language);
  if(rescue)model.conditions.push(rescue);
  const cargo=s.tow;
  if(cargo&&cargo.hp>0&&!cargo.delivered&&(cargo.connected||ashore&&!cargo.anchor)){
    const bow=towBow(cargo),remote=!cargo.connected&&Math.hypot(s.boat.x-bow.x,s.boat.y-bow.y)>=155;
    const anchor=cargo.anchor?(en?'Anchored':'닻 내림'):
      ashore?(remote?(en?'Drifting · reboard, approach, H':'표류 중 · 승선·접근 후 H'):(en?'Drifting · reboard, then H':'표류 중 · 승선 후 H')):(en?'Anchor raised · H Anchor':'닻 올림 · H 닻 조작');
    condition('cargo',`${en?'Supply boat':'보급정'} ${Math.ceil(cargo.hp)}/80 · ${anchor}`,ashore&&!cargo.anchor?'warning':'normal');
  }
  if(s.boss.active&&!s.boss.cleared){
    let phase=en?{warn:'Warning',attack:'Attack',recover:'Hooks exposed',idle:''}[s.boss.phase]:{warn:'공격 예고',attack:'공격 중',recover:'고리 노출',idle:''}[s.boss.phase];
    if(crane&&s.boss.phase==='warn')phase=crane.locked?(en?'Target locked':'표적 고정'):crane.target?(en?'Tracking':'추적 중'):(en?'Preparing':'준비 중');
    else if(crane&&s.boss.phase==='attack')phase=en?'Drop':'낙하';
    const timer=crane?Math.max(0,s.boss.timer).toFixed(1):Math.ceil(s.boss.timer);
    model.boss=`${tr(DEPTHS[s.depth].boss)} · ${phase} ${timer}${en?'s':'초'} · ${en?'Drives':'구동부'} ${s.boss.parts.filter(h=>h>0).length}/${s.boss.parts.length}`;
    if(sluice){
      const phase=sluice.phase==='warn'?(sluice.locked?(en?'Locked':'고정'):(en?'Tracking':'추적')):
        sluice.phase==='attack'?(sluice.backwash?(en?'Backwash':'역류'):sluice.exposed?(en?'Plate open':'잠금판 열림'):(en?'Gate opened':'수문 개방')):(en?'Resetting':'재정비');
      model.boss=`${en?'Lane':'수로'} ${sluice.lane+1} · ${phase} ${sluice.remaining.toFixed(1)}${en?'s':'초'} · ${en?'Open':'개방'} ${sluice.opened}/${sluice.total}`;
    }
    if(lighthouse){
      const a=lighthouse,phase=a.phase==='attack'?(a.impact?(en?'Impact':'폭발'):(en?'Locked':'표적 고정')):a.phase==='recover'?(en?'Resetting':'재정비'):(en?'Searching':'탐색');
      const countdown=a.phase==='attack'&&!a.impact?Math.max(0,a.remaining-LIGHTHOUSE.impactTail):a.remaining;
      model.boss=`${phase}${a.phase==='warn'?'':` ${countdown.toFixed(1)}${en?'s':'초'}`} · ${en?'Sent':'전송'} ${a.sent}/${a.total}`;
    }
  }
  if(sluice&&s.captain==='jeong')model.skill.name=en?'Hold discharge':'방류 붙잡기';
  if(lighthouse&&s.captain==='jeong')model.skill.name=en?'Hold searchlight':'탐조등 붙잡기';
  const alignment=berthAlignment(s);model.docking=dockAlignmentPresentation(alignment,language,s);
  if(model.docking){
    const berth=s.map.berths.find(b=>b.id===alignment.berth.id);
    const target=destination?.point||(s.boss.cleared?s.map.exit:guide.target);
    const arriving=target?.x===alignment.berth.x&&target?.y===alignment.berth.y;
    if(model.docking.optional){
      const name=alignment.exit?(en?'Exit berth':'탈출 부두'):tr(SHORE_SITES[berth.island]);
      // Keep the real local E/steering opportunity, explicitly subordinate to
      // the chosen route. Its instructions must not replace the primary action.
      model.context.push({id:'docking',tone:'normal',text:(en?'Optional stop':'주변 접안(선택)')+' · '+name+' · '+model.docking.hint});
    }else{
      if(arriving)model.mission=alignment.exit?(en?'Exit berth · Docking':'탈출 부두 · 접안'):
        (berth?tr(SHORE_SITES[berth.island])+' · ':'')+(en?'Docking':'접안');
      model.fullObjective=model.mission+' · '+model.docking.hint;
      model.action=model.docking.hint;model.actionTone=model.docking.tone;
    }
  }
  const context=shoreHudContext(s,language);
  if(context.search){
    if(/F\s*\/\s*R/.test(model.action)){model.action=context.search.text;model.actionTone=context.search.tone;}
    else model.context.push(context.search);
  }
  if(ashore&&s.combat&&/^(Space|Q )/.test(model.action)){
    // A generic shore controls row does not imply a detected threat, but must
    // still respect ammo/cooldown. Reuse a visible-threat row when there is one.
    const defense=context.defense||defensePrompt(s,language,true);
    model.action=defense.text;model.actionTone=defense.tone;
  }else if(context.defense)model.context.push(context.defense);
  model.impact=impactPresentation(recentImpact(s),language);
  if(model.impact){
    const affected=model.metrics.find(m=>m.id===model.impact.metric);
    if(affected)affected.impact=true;
  }
  if(s.work>0)model.work={value:s.work,max:ashore?1.8:3,label:ashore?(en?'Searching':'수색 중'):(en?'Recovering':'회수 중')};
  return model;
}
export function rogueHudMarkup(model){
  const dockChecks=model.docking?`<span class="rogue-dock-checks" data-dock-kind="${model.docking.kind}" data-dock-optional="${!!model.docking.optional}" aria-label="${escape(model.docking.title)}">${model.docking.checks.map(c=>`<span data-dock-check="${c.id}" data-ok="${c.ok}" data-active="${c.active}"><i aria-hidden="true">${c.ok?'✓':'○'}</i> ${escape(c.label)}<span class="rogue-sr-only"> · ${model.language==='en'?(c.ok?'ready':'not ready'):(c.ok?'충족':'미충족')}</span></span>`).join('')}</span>`:'';
  return {
    mission:`<small>${escape(model.region)}</small><strong>${escape(model.mission)}</strong>${model.plan?`<div class="rogue-plan-summary">${escape(model.plan)}</div>`:''}${model.boss?`<div class="rogue-boss-state">${escape(model.boss)}</div>`:''}`,
    readings:model.metrics.map(m=>`<span data-rogue-metric="${m.id}"${m.impact?' data-impact="true"':''}${m.gauge?' class="rogue-instrument"':''}><span>${escape(m.label)}</span><b>${escape(m.value)}</b>${m.max!==undefined?`<span class="rogue-maximum">/${m.max}</span>`:''}${instrument(m.gauge)}</span>`).join(''),
    conditions:(model.impact?`<span class="rogue-impact" data-impact-id="${model.impact.id}" data-impact-target="${model.impact.target}" data-impact-source="${model.impact.source}"><span>${escape(model.impact.cause)}</span><strong>${escape(model.impact.loss)}</strong></span>`:'<span class="rogue-impact" aria-hidden="true"></span>')+model.conditions.map(c=>`<span data-rogue-condition="${c.id}" data-tone="${c.tone}"${c.gauge?' class="rogue-instrument"':''}>${c.emphasis?`<strong>${escape(c.text)}</strong>`:escape(c.text)}${instrument(c.gauge)}</span>`).join(''),
    controls:`${model.docking?.optional?'':dockChecks}<span data-rogue-action="primary" data-tone="${model.actionTone||'normal'}">${escape(model.action)}</span>${model.context.map(c=>`<span data-rogue-context="${c.id}" data-tone="${c.tone}">${escape(c.text)}</span>${c.id==='docking'?dockChecks:''}`).join('')}${model.work?`<label class="rogue-work">${escape(model.work.label)}<progress max="${model.work.max}" value="${model.work.value}" aria-label="${escape(model.work.label)}"></progress></label>`:''}`,
    skill:`<kbd>G</kbd><span><b>${escape(model.skill.name)}</b><small>${escape(model.skill.reason)}${model.skill.active?' · '+model.skill.remaining.toFixed(1)+(model.language==='en'?'s':'초'):''}</small>${model.skill.ready?`<small>${model.language==='en'?'Boost':'부스터'} ${model.skill.boost} · ${model.language==='en'?'fuel':'연료'} ${model.skill.fuel}</small>`:''}</span>${!model.skill.compact?`<progress aria-label="${model.language==='ko'?'기술 재사용 준비':'Skill cooldown'}" max="${model.skill.cooldown}" value="${model.skill.cooldown-model.skill.remainingCooldown}"></progress>`:''}`
  };
}
export function rogueDetailsMarkup(s,language='ko'){
  const en=language==='en',tr=text=>rogueHudText(text,language),model=rogueHudModel(s,language),spec=skillStatus(s);
  const rows=[
    [en?'Current objective':'현재 목표',model.fullObjective],
    [en?'Hull / fuel / boost':'선체 / 연료 / 부스터',`${Math.ceil(s.hp)}/${maxHp(s)} · ${Math.ceil(s.fuel)}/${maxFuel(s)} · ${Math.floor(s.boost)}/${CAPTAINS[s.captain].boost}`],
    [en?'Between regions':'해역 이동',s.supplyModel==='legacy'?(en?'Fuel +30, up to tank capacity':'연료 +30 · 탱크 최대치까지'):(en?'Remaining fuel carries over · no automatic refuel':'남은 연료 이월 · 자동 보충 없음')],
    [en?'Crew / scrap':'선원 / 고철',`${Math.ceil(s.crewHp)}/100 · ${s.combat?.ammo??0}/12`],
    [en?'Equipment':'장비',s.equipment.map(id=>tr(GEAR[id])).join(' · ')||(en?'None':'없음')],
    [en?'Crew equipment · this voyage':'선원 장비 · 이번 항해',[...new Set(s.crewUpgrades||[])].map(id=>(en?{grip:'Iron grip',stride:'Deck footwork',guard:'Padded vest'}:{grip:'강철 손아귀',stride:'갑판 발놀림',guard:'충격 안감'})[id]+' '+s.crewUpgrades.filter(x=>x===id).length).join(' · ')||(en?'None':'없음')],
    [en?'Recovered tools':'회수 도구',s.tools.map(id=>tr(FLOOR_TOOLS.find(t=>t.id===id).name)).join(' · ')||(en?'None':'없음')],
    [en?'Build':'선체 개조',tr(BUILDS[s.build])],
    [en?'Time underway':'항해 경과',`${Math.floor(s.time/60)}:${String(Math.floor(s.time%60)).padStart(2,'0')}`]
  ];
  if(s.rescue?.discovered)rows.push([en?'Mechanic':'정비공',s.rescue.stage==='aboard'?(en?'Aboard':'승선 완료'):s.rescue.stage==='left-behind'?(en?'Left at the harbor':'폐항에 남음'):(en?'Found · not aboard':'발견 · 아직 미승선')]);
  if(s.build==='bilge')rows.push([en?'Flood / valve':'침수 / 밸브',`${Math.floor(s.flood)}% · ${s.valve?(en?'Open':'열림'):(en?'Shut':'닫힘')}`]);
  if(s.build==='winch')rows.push([en?'Stored charge':'저장 축력',Math.floor(s.charge)]);
  const rig=rigEffects(s);
  if(rig.stacked&&s.build==='winch'){
    rows.push([en?'Taut-line charging':'장력 유지 시 충전',`${Number(rig.winchChargeRate.toFixed(1))}${en?'/s · tension >15%':'/초 · 장력 15% 초과'}`]);
    rows.push([en?'Launch / stored jet force':'발진 / 저장 분사력',`×${Number(rig.winchLaunchMultiplier.toFixed(2))}`]);
  }
  if(s.tow)rows.push([en?'Supply boat':'보급정',`${Math.ceil(s.tow.hp)}/80 · ${s.tow.delivered?(en?'Delivered':'도착'):s.tow.hp<=0?(en?'Sunk':'침몰'):s.tow.anchor?(en?'Anchored':'닻 내림'):(en?'Anchor raised':'닻 올림')}`]);
  const sluice=usesSluice(s);
  const lighthouse=usesLighthouse(s)?lighthouseStatus(s):null;
  if(lighthouse){
    rows.push([en?'Manifests sent':'전송한 명부',`${lighthouse.sent}/${lighthouse.total}`]);
    if(lighthouse.index>=0)rows.push([en?'Current relay':'현재 중계기',`${lighthouse.index+1} · ${(Math.floor(lighthouse.progress*10)/10).toFixed(1)}/${lighthouse.required}${en?'s':'초'}`]);
  }
  const build=lighthouse&&s.build==='winch'?(en?'With a relay connected, B requires 35 charge, over 10% tension and more than 3 fuel. It spends 3 fuel, disconnects and launches away from the relay. This neither damages the lighthouse nor transmits a manifest.':'중계기에 연결된 B는 축력 35 이상·장력 10% 초과·연료 3 초과가 필요합니다. 연료 3을 써 접속을 끊고 중계기 반대쪽으로 발진합니다. 등대에 피해를 주거나 명부를 전송하지 않습니다.'):
    sluice&&s.build==='winch'?(en?'Mooring hooks are optional. Store charge against the flow. At 35 charge, over 10% tension and more than 3 fuel, B spends 3 fuel, releases the line and launches away from the cleat. This does not damage gates; ram an open plate bow first.':'계류 고리는 선택 사항입니다. 물살을 버티며 축력을 모읍니다. 축력 35 이상·장력 10% 초과·연료 3 초과에서 B로 연료 3을 써 줄을 놓고 계류점 반대쪽으로 발진합니다. 수문에는 피해를 주지 않습니다. 열린 잠금판에 선수로 충돌해야 합니다.'):
    s.build==='bilge'?(en?'B toggles the intake valve. More water increases thrust; flooding at 100% sinks the boat. Flooding is held while moored or ashore.':'B로 흡수 밸브를 여닫습니다. 물을 받으면 추진력이 높아지지만 침수 100%에서 침몰합니다. 계류·하선 중에는 침수가 유지됩니다.'):
    s.build==='winch'?(en?'Charge builds on a taut boss line. At 35 charge, B releases it during hook exposure with tension above 10%, spends up to 3 fuel and recoils the tug.':'보스 고리의 줄을 팽팽히 당겨 축력을 모읍니다. 축력 35 이상, 고리 노출 중, 장력 10% 초과에서 B로 방출합니다. 연료를 최대 3 쓰고 배가 반동으로 밀립니다.'):
      en?'Shift boosts; Space brakes. Boost recovers during ordinary travel.':'Shift로 가속하고 Space로 감속합니다. 일반 운항 중 부스터가 회복됩니다.';
  const skillDescription=lighthouse&&s.captain==='jeong'?(en?'During search, G holds the searchlight rotation for up to 3 seconds while connected with at least 35% tension. Below 25% tension, disconnection or a locked attack ends the hold. The beam can still detect you.':'탐색 중, 중계기에 연결된 장력이 35% 이상이면 G로 탐조등 회전을 최대 3초 붙잡습니다. 장력 25% 미만·접속 해제·공격 표적 고정 시 종료됩니다. 멈춘 빛에도 발각될 수 있습니다.'):
    lighthouse&&s.captain==='han'?(en?'During search, direction + G places a decoy. If the lighthouse can see it within range, the attack locks onto that position. Leave the marked circle; a locked target does not follow you.':'탐색 중 방향키 + G로 미끼를 던집니다. 등대의 범위 안에서 가리지 않은 미끼가 보이면 그 위치로 공격이 고정됩니다. 표적 원 밖으로 이동하세요. 고정된 표적은 배를 따라오지 않습니다.'):
    sluice&&s.captain==='jeong'?(en?'During open-plate discharge, use G while hooked with at least 35% tension to hold the discharge timer. Below 25% tension, disconnection or the end of the skill releases the hold.':'잠금판이 열린 방류 중, 고리에 연결된 줄의 장력이 35% 이상이면 G로 방류 시간을 붙잡습니다. 장력 25% 미만·줄 분리·기술 종료 시 해제됩니다.'):
    sluice&&s.captain==='han'?(en?'Direction + G places a decoy during the early warning, drawing the target lane toward it. Unavailable once the lane locks.':'공격 예고 초반에 방향키 + G로 부표를 던져 목표 수로를 유도합니다. 수로가 고정된 뒤에는 사용할 수 없습니다.'):
    en?skillDescriptions[s.captain]:spec.instruction+' · '+spec.effect+' '+spec.risk;
  const encounter=lighthouse?`<h3>${en?'Send the rescue manifests':'구조 명부 송신'}</h3><p>${en?`Approach each relay and connect with E. Keep the bow pointed at the lighthouse, speed at ${lighthouse.maxSpeed} or below, and the radio path clear for ${lighthouse.required} seconds. Stay within connection range. Leaving a condition drains unfinished progress; a hit resets unfinished transmissions. Completed manifests are retained. After all three, dock at the lighthouse with E to finish.`:`각 중계기에 접근해 E로 접속합니다. 연결 범위 안에서 선수를 등대 쪽으로 맞추고, 속도 ${lighthouse.maxSpeed} 이하·가리지 않은 송신선을 ${lighthouse.required}초 유지하세요. 조건을 벗어나면 미완료 진척이 감소하고, 피격되면 미완료 송신이 초기화됩니다. 전송한 명부는 유지됩니다. 세 개를 모두 보낸 뒤 등대 부두에 E로 접안해야 완료됩니다.`}</p><p>${en?'The rotating searchlight detects exposed hull sections. Breakwaters block light and the radio path, so hiding and transmitting require different positions. Once the attack circle locks, move clear before impact; the mark stays on the water.':'회전하는 탐조등은 노출된 선체 일부도 감지합니다. 방파제는 빛과 송신선을 함께 가리므로 숨는 위치와 송신 위치를 구분하세요. 공격 원이 고정되면 충격탄이 떨어지기 전에 벗어나세요. 표적은 수면에 고정됩니다.'}</p>`:
    sluice?`<h3>${en?'Sluice breakthrough':'수문 돌파'}</h3><p>${en?'Ride discharge east, align the bow and strike the open plate in the lane centre at east speed 150 or above. Open all three gates, then dock at the exit. Even a successful ram damages the hull; opened gates stay open. Hooks are optional.':'방류를 타고 동쪽 속도 150 이상으로 가속한 뒤, 선수를 동쪽으로 맞춰 수로 중앙의 열린 잠금판에 충돌하세요. 세 수문을 열고 탈출 부두에 접안합니다. 성공해도 선체 충격 피해가 있으며, 열린 수문은 다시 잠기지 않습니다. 계류 고리는 선택 사항입니다.'}</p>`:'';
  return `<details id="rogueVoyageDetails"><summary>${en?'Voyage information':'항해 정보'}</summary><dl class="rogue-detail-list">${rows.map(([label,value])=>`<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>${encounter}<h3>${en?'Build operation':'빌드 운용'}</h3><p>${escape(build)}</p><h3>G · ${escape(model.skill.name)}</h3><p>${escape(skillDescription)}</p><p>${en?'Cost':'비용'}: ${en?'boost':'부스터'} ${spec.boost} · ${en?'fuel':'연료'} ${spec.fuel} · ${en?'cooldown':'재사용'} ${spec.cooldown}${en?'s':'초'}</p></details>`;
}
