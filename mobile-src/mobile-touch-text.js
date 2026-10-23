// Presentation only: never rewrite input codes, saves or authoritative rules.
export function touchText(value,language=globalThis.document?.documentElement.lang||'ko'){
  const en=language==='en';
  const names=en
    ?{WASD:'Move pad',Space:'Brake',Shift:'Boost',E:'Interact',Q:'Unmoor / Lure',F:'Supplies',R:'Gear',B:'Build',G:'Skill',T:'Tow',H:'Cargo anchor',V:'Throw',X:'Cut net',M:'Chart',C:'Precision'}
    :{WASD:'이동 패드',Space:'제동',Shift:'부스터',E:'작업',Q:'해제 / 유인',F:'보급',R:'장비',B:'빌드',G:'선장 기술',T:'견인',H:'보급정 닻',V:'투척',X:'그물 절단',M:'해도',C:'정밀'};
  return String(value)
    .replaceAll('T 견인 / H 닻','견인 / 보급정 닻')
    .replaceAll('T 분리 · H 닻','견인 분리 · 보급정 닻')
    .replaceAll('Space 근접','공격').replaceAll('Space로 갈고리를','공격으로 갈고리를')
    .replaceAll('V나 클릭으로','화면 터치로')
    .replaceAll('Space Melee','Attack').replaceAll('Space swings','Attack swings')
    .replaceAll('V or click','a world tap')
    .replace(/\b(WASD|Space|Shift|[EQFRBGTHVXMC])\b/g,key=>names[key])
    .replaceAll('방향키','이동 패드');
}
