// Web-only support entry. The frozen game modules are copied without edits.
const link=document.createElement('a');
const release={version:'0.98.11'},performanceKey='lastsignal.performance.v1';
link.textContent='버그 제보 / Report bug · F8';
link.href=new URL('./feedback.html',import.meta.url).href;link.target='_blank';link.rel='noopener';
link.className='beta-report-link';
document.body.append(link);
link.addEventListener('click',()=>{
  // Synchronous request: only a user-opened report transfers a bounded snapshot.
  // localStorage crosses the existing noopener tab boundary; the form consumes it.
  try{
    localStorage.removeItem(performanceKey);
    const detail={};dispatchEvent(new CustomEvent('lastsignal:performance-request',{detail}));
    if(detail.snapshot){
      const bytes=JSON.stringify({...detail.snapshot,version:release.version});
      if(bytes.length<=16000)localStorage.setItem(performanceKey,bytes);
    }
  }catch{} // Reporting must still open when storage is blocked or full.
});
function visible(){
  const body=document.querySelector('.rp-view')||document.querySelector('.session-body');
  if(body){
    if(link.parentElement!==body)body.append(link);
    if(link.hidden)link.hidden=false;
  }else{
    if(link.parentElement!==document.body)document.body.append(link);
    if(!link.hidden)link.hidden=true;
  }
}
new MutationObserver(visible).observe(document.body,{attributes:true,childList:true,subtree:true});
visible();
addEventListener('keydown',event=>{
  if(event.code==='F8'){event.preventDefault();link.click();}
});
