import {rogueHudText} from './rogue-hud.js';
// Exact candidate radio contract only. Do not translate arbitrary narrative
// text by guessing a mechanic event or recalculating its resource changes.
export function mechanicHudText(value,language='ko'){
 const match=/^정비공: 고철 (\d+)개로 선체를 (\d+(?:\.\d+)?)만큼 수리했어요\. 이 해역에서 (\d+)번 더 손볼 수 있어요\.$/.exec(String(value));
 if(language==='en'&&match)return `Mechanic: Used ${match[1]} scrap to restore ${match[2]} hull. ${match[3]} repairs left in this region.`;
 return rogueHudText(value,language);
}
