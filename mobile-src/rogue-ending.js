// Result copy reads resolved voyage state. It never discovers an unseen person
// or awards a rescue for merely finding them. Failure reasons remain upstream.
export function voyageEnding(state,language='ko'){
 if(state?.status!=='won'||state.depth!==2)return null;
 const en=language==='en',rescue=state.rescue;
 if(rescue?.stage==='aboard')return {
  outcome:'together',
  summary:en?'The mechanic reached the lighthouse with you. Their testimony corrected the “everyone evacuated” record.':'정비공과 함께 등대에 도착했다. 그의 증언으로 「전원 대피」 기록을 바로잡았다.'
 };
 if(rescue?.discovered)return {
  outcome:'location-sent',
  summary:en?'You transmitted the location of the mechanic left in the harbor. The lighthouse has the message; the rescue is still unfinished.':'폐항에 남은 정비공의 위치를 전했다. 등대에 소식은 닿았지만, 구조는 아직 끝나지 않았다.'
 };
 return {
  outcome:'manifest-sent',
  summary:en?'You delivered the names you confirmed to the lighthouse. Its light now guides returning ships.':'직접 확인한 사람들의 이름을 등대에 전했다. 이제 등대는 돌아오는 배를 비춘다.'
 };
}
