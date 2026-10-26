export const AUDIO_KEY='lastsignal.audio.v1';
const level=(v,fallback)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):fallback;
export function audioLevels(value={},legacy={}){
 return {master:level(value?.master,1),volume:level(value?.volume,level(legacy.volume,.38)),music:level(value?.music,level(legacy.music,.22))};
}
export function readAudio(storage,legacy){try{return audioLevels(JSON.parse(storage.getItem(AUDIO_KEY)),legacy);}catch{return audioLevels({},legacy);}}
export function audioMarkup(levels,language='ko'){
 const en=language==='en',labels=en?{master:'Master volume',volume:'Sound effects',music:'Background music'}:{master:'전체 소리',volume:'효과음',music:'배경음악'};
 return '<details class="rp-page rp-audio"><summary>'+(en?'Audio':'오디오')+'</summary><div class="rp-detail-content">'+Object.entries(labels).map(([key,label])=>'<label class="setting audio-level">'+label+'<output data-audio-output="'+key+'">'+Math.round(levels[key]*100)+'%</output><input aria-label="'+label+'" data-audio-level="'+key+'" type="range" min="0" max="100" step="1" value="'+Math.round(levels[key]*100)+'"></label>').join('')+'<p class="micro" data-audio-status role="status"></p></div></details>';
}
export function bindAudio(container,onChange,language='ko'){
 for(const input of container.querySelectorAll('[data-audio-level]'))input.addEventListener('input',()=>{
  const key=input.dataset.audioLevel;container.querySelector('[data-audio-output="'+key+'"]').textContent=input.value+'%';
  const saved=onChange(key,Number(input.value)/100);
  container.querySelector('[data-audio-status]').textContent=saved?'':language==='en'?'Setting applies now; saving failed.':'지금 적용됐지만 설정 저장에 실패했습니다.';
 });
}
