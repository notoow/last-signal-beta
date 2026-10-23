let saved={};
try{saved=JSON.parse(localStorage.getItem('lastsignal.rogue.v1')||'{}')||{};}catch{}
const context={version:'0.67.0',viewport:`${innerWidth}x${innerHeight}`,browser:navigator.userAgent};
for(const key of ['seed','captain','build','depth','status'])
  if(['number','string'].includes(typeof saved[key]))context[key]=String(saved[key]).slice(0,150);
document.querySelector('#context').textContent=JSON.stringify(context,null,2);
document.querySelector('form').addEventListener('submit',event=>{
  event.preventDefault();
  const description=document.querySelector('#description').value.trim();
  if(description.length<3)return;
  const url=new URL('https://github.com/notoow/last-signal-beta/issues/new');
  url.searchParams.set('title',`[Web ${context.version}] ${description.split('\n')[0].slice(0,70)}`);
  url.searchParams.set('body',`## 상황과 재현 방법 / What happened?\n${description}\n\n## Context\n\`\`\`json\n${JSON.stringify(context,null,2)}\n\`\`\`\n\nPlease remove personal information before submitting.`);
  const opened=window.open(url.href,'_blank','noopener');
  document.querySelector('#result').textContent='GitHub에서 최종 등록해주세요. 창이 열리지 않으면 아래 링크를 눌러주세요.';
  const fallback=document.createElement('a');
  fallback.href=url.href;fallback.target='_blank';fallback.rel='noopener';fallback.textContent='GitHub 이슈 작성 열기';
  document.querySelector('#result').append(document.createElement('br'),fallback);
});
