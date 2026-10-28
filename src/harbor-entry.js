// Scene readiness is distinct from GPU availability and network completion.
// The caller owns pausing, cancellation and modal precedence.
export function needsHarborEntry(state){
 return state?.status==='playing'&&state.generator>=4&&['moored','ashore'].includes(state.mode);
}
export function harborEntryStatus({state,renderedState,frame,elapsed=0,hidden=false}){
 if(!needsHarborEntry(state))return {status:'skip',canReveal:false};
 const current=renderedState===state,assets=current?frame?.quayAssets:null;
 const ready=current&&assets?.status==='ready'&&frame?.quay?.ready===true;
 const status=ready?'ready':assets?.status==='error'||elapsed>=15000?'error':'loading';
 return {status,canReveal:ready&&!hidden,loaded:assets?.loaded??0,total:assets?.total??0};
}
