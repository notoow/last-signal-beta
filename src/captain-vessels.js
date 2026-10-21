// World units, not metres. Hull dimensions also drive clearance and contact.
export const CAPTAINS={
  woo:{name:'Woo',hp:120,boost:60,fuel:1,thrust:1,pull:1,note:'내구 120 · 부스터 60'},
  park:{name:'Park',hp:90,boost:110,fuel:1,thrust:1,pull:1,note:'내구 90 · 부스터 110'},
  han:{name:'Han',hp:100,boost:75,fuel:.75,thrust:.9,pull:1,note:'연료 소모 −25% · 추진력 −10%'},
  jeong:{name:'Jeong',hp:105,boost:70,fuel:1,thrust:.9,pull:1.2,note:'견인 전달 +20% · 추진력 −10%'}
};
export const CAPTAIN_VESSELS={
  woo:{name:'방호 예인정',length:70,width:34,turn:2.2,
    handling:'넓은 방현재 · 느린 선회',detail:'두꺼운 방현재와 비상 버팀 장치. 좁은 부두에서는 일찍 감속하고 돌아 들어갑니다.'},
  park:{name:'고속 구조정',length:64,width:22,turn:4.2,
    handling:'좁은 선폭 · 빠른 선회',detail:'가느다란 선수와 횡추진기. 좁은 틈을 파고들지만 충돌을 오래 버티지는 못합니다.'},
  han:{name:'부표 탐사선',length:76,width:26,turn:2.8,
    handling:'긴 선체 · 절약 운항',detail:'부표 적재대와 탐사 장비. 연료를 아끼며 공격을 유도하지만 긴 선미가 부두에 걸리지 않게 주의하세요.'},
  jeong:{name:'쌍윈치 작업선',length:72,width:32,turn:2.3,
    handling:'넓은 작업갑판 · 강한 견인',detail:'쌍윈치와 결박 장치. 견인에 강하지만 무거운 선체는 크게 돌아 나가야 합니다.'}
};
