let saved={};
try{saved=JSON.parse(localStorage.getItem('lastsignal.rogue.v1')||'{}')||{};}catch{}
const context={version:'0.98.1',viewport:`${innerWidth}x${innerHeight}`,browser:navigator.userAgent};
for(const key of ['seed','captain','build','depth','status'])
  if(['number','string'].includes(typeof saved[key]))context[key]=String(saved[key]).slice(0,150);
const modes={sailing:'항해 / Sailing',moored:'접안 / Moored',ashore:'상륙 / Ashore'};
const renderers={gpu:'GPU',canvas:'Canvas',unknown:'확인 안 됨 / Unknown'};
const storageKey='lastsignal.performance.v1';
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const decimal=value=>Math.round(value*10)/10;
function readPerformance(){
  let raw;
  try{raw=localStorage.getItem(storageKey);if(raw)localStorage.removeItem(storageKey);}catch{return{state:'unavailable'};}
  if(!raw)return{state:'missing'};
  try{
    if(raw.length>16000)return{state:'invalid'};
    const data=JSON.parse(raw),summary=data.summary;
    if(data.schema!==1||!finite(data.capturedAt)||!summary||summary.schema!==1||summary.capacity!==300||!Array.isArray(summary.groups)||summary.groups.length>9)return{state:'invalid'};
    if(data.capturedAt>Date.now()+60000)return{state:'invalid'};
    if(Date.now()-data.capturedAt>30*60*1000)return{state:'expired'};
    if(data.version!==context.version)return{state:'version'};
    const viewport=data.viewport;
    if(!viewport||!integer(viewport.width)||!integer(viewport.height)||viewport.width<1||viewport.height<1||viewport.width>20000||viewport.height>20000||!finite(viewport.dpr)||viewport.dpr<=0||viewport.dpr>16)return{state:'invalid'};
    const seen=new Set(),groups=[];
    for(const group of summary.groups){
      const key=group.mode+':'+group.renderer;
      if(!Object.hasOwn(modes,group.mode)||!Object.hasOwn(renderers,group.renderer)||seen.has(key))return{state:'invalid'};
      if(!integer(group.samples)||group.samples<1||group.samples>300||!integer(group.totalSamples)||group.totalSamples<group.samples||!integer(group.over50)||group.over50>group.samples)return{state:'invalid'};
      if(![group.medianMs,group.p95Ms,group.maxMs].every(value=>finite(value)&&value>0&&value<=3600000)||group.medianMs>group.p95Ms||group.p95Ms>group.maxMs)return{state:'invalid'};
      seen.add(key);groups.push({mode:group.mode,renderer:group.renderer,samples:group.samples,totalSamples:group.totalSamples,medianMs:decimal(group.medianMs),p95Ms:decimal(group.p95Ms),maxMs:decimal(group.maxMs),over50:group.over50});
    }
    if(!groups.length)return{state:'missing'};
    groups.sort((a,b)=>Object.keys(modes).indexOf(a.mode)-Object.keys(modes).indexOf(b.mode)||a.renderer.localeCompare(b.renderer));
    return{state:'ready',value:{schema:1,capturedAt:new Date(data.capturedAt).toISOString(),version:data.version,viewport:{width:viewport.width,height:viewport.height,dpr:viewport.dpr},rendererError:typeof data.rendererError==='string'?data.rendererError.slice(0,160):null,summary:{schema:1,capacity:300,groups}}};
  }catch{return{state:'invalid'};}
}
const performance=readPerformance();
const messages={
  missing:'아직 기록이 없습니다. 게임에서 문제가 생긴 뒤 버그 제보를 열어주세요. / No samples yet. Open Report bug from the game after the problem occurs.',
  unavailable:'이 브라우저에서 기록을 읽지 못했습니다. 상황을 적어 제보할 수 있습니다. / Performance data is unavailable; you can still report the problem.',
  expired:'30분이 지난 기록은 첨부하지 않습니다. 게임에서 버그 제보를 다시 열어주세요. / Samples are over 30 minutes old. Reopen Report bug from the game.',
  version:'다른 버전의 기록은 첨부하지 않습니다. 게임에서 버그 제보를 다시 열어주세요. / Samples belong to another version. Reopen Report bug from the game.',
  invalid:'기록을 읽지 못했습니다. 상황을 적어 제보할 수 있습니다. / Samples could not be read; you can still report the problem.'
};
if(performance.state==='ready'){
  const value=performance.value;context.performance=value;
  document.querySelector('#performance-status').textContent=`${new Date(value.capturedAt).toLocaleTimeString()} · 게임 화면 ${value.viewport.width} × ${value.viewport.height} · DPR ${value.viewport.dpr}`;
  document.querySelector('#performance-note').hidden=false;
  for(const group of value.summary.groups){
    const row=document.createElement('article'),title=document.createElement('h3'),stats=document.createElement('p'),details=document.createElement('p');
    row.className='performance-row';title.textContent=modes[group.mode];
    stats.textContent=`중앙값 ${group.medianMs} ms · p95 ${group.p95Ms} ms`;
    details.textContent=`${renderers[group.renderer]} · ${group.samples}회 / samples · 50ms 초과 ${group.over50}회`;
    details.className='performance-meta';row.append(title,stats,details);document.querySelector('#performance-groups').append(row);
  }
}else document.querySelector('#performance-status').textContent=messages[performance.state];
document.querySelector('#context').textContent=JSON.stringify(context,null,2);
const description=document.querySelector('#description'),result=document.querySelector('#result'),copyFallback=document.querySelector('#copy-fallback'),copyText=document.querySelector('#copy-text');
function reportBody(){return`## 상황과 재현 방법 / What happened?\n${description.value.trim()}\n\n## Context\n\`\`\`json\n${JSON.stringify(context,null,2)}\n\`\`\`\n\nPlease remove personal information before submitting.`;}
document.querySelector('#copy-report').addEventListener('click',async()=>{
  const body=reportBody();copyFallback.hidden=true;
  try{if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');await navigator.clipboard.writeText(body);result.textContent='제보 내용을 복사했습니다. / Report copied.';}
  catch{copyText.value=body;copyFallback.hidden=false;copyText.focus();copyText.select();result.textContent='자동 복사를 사용할 수 없어 내용을 선택했습니다. / Automatic copy is unavailable; the report is selected below.';}
});
document.querySelector('form').addEventListener('submit',event=>{
  event.preventDefault();
  const text=description.value.trim();if(text.length<3)return;
  const url=new URL('https://github.com/notoow/last-signal-beta/issues/new');
  url.searchParams.set('title',`[Web ${context.version}] ${text.split('\n')[0].slice(0,70)}`);
  url.searchParams.set('body',reportBody());
  if(url.href.length>7500){
    // Do not silently truncate long Unicode reports to fit a draft URL.
    url.searchParams.delete('body');copyText.value=reportBody();copyFallback.hidden=false;copyText.focus();copyText.select();
    result.textContent='내용이 길어 링크에 전부 담을 수 없습니다. 제보 내용을 복사한 뒤 아래 GitHub 작성 화면의 본문에 붙여 넣어주세요. / Copy the full report below, then paste it into the GitHub issue.';
  }else{
    window.open(url.href,'_blank','noopener');
    result.textContent='GitHub에서 최종 등록해주세요. 창이 열리지 않으면 아래 링크를 눌러주세요.';
  }
  const fallback=document.createElement('a');fallback.href=url.href;fallback.target='_blank';fallback.rel='noopener';fallback.textContent='GitHub 이슈 작성 열기';result.append(document.createElement('br'),fallback);
});
