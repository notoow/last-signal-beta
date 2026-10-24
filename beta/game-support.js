// Web-only support entry. The frozen game modules are copied without edits.
const link=document.createElement('a');
link.textContent='버그 제보 / Report bug · F8';
link.href=new URL('./feedback.html',import.meta.url).href;link.target='_blank';link.rel='noopener';
link.className='beta-report-link';
document.body.append(link);
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
