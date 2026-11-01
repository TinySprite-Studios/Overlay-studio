export const CARE_STEP = 10 * 60 * 1000;
const foods = ['Space taco', 'Moon cookie', 'Cosmic pizza', 'Star berry', 'Galaxy noodles'];
const drinks = ['Water', 'Moon milk', 'Berry juice', 'Cosmic smoothie', 'Space tea'];
export function createCare(saved = {}, {now = Date.now, random = Math.random, persist = () => {}, publish = () => {}} = {}) {
 let state = {health:100,food:100,drink:100,happiness:100,running:false,lastTick:now(),streamId:null,notice:'Waiting for the stream',...saved};
 const seen = new Set(Array.isArray(saved.seen) ? saved.seen : []);
 const snapshot = () => ({...state,seen:[...seen]});
 const emit = () => {const value=snapshot();persist(value);publish(value);return value;};
 const tick = () => {
  if (!state.running) return snapshot();
  const steps = Math.floor((now()-state.lastTick)/CARE_STEP);
  if (steps < 1) return snapshot();
  // Each empty need costs 5 health per interval, with a maximum loss of 5.
  for(let i=0;i<Math.min(steps,1000);i++) {
   if (state.food===0 || state.drink===0 || state.happiness===0) state.health=Math.max(0,state.health-5);
   for(const key of ['food','drink','happiness'])state[key]=Math.max(0,state[key]-(5+Math.min(5,Math.max(0,Math.floor(random()*6)))));
  }
  state.lastTick+=steps*CARE_STEP;
  state.notice=state.health===0?'Sprite is exhausted — care for him to recover!':'Needs fall independently by 5–10 every 10 minutes';
  return emit();
 };
 const reset = (streamId='preview') => {seen.clear();state={health:100,food:100,drink:100,happiness:100,running:true,lastTick:now(),streamId,notice:'New stream — Sprite is ready!'};return emit();};
 return {snapshot,tick,reset,
  start(id){if(state.streamId!==id)return reset(id);if(!state.running)state.lastTick=now();state.running=true;return emit();},
  stop(){tick();state.running=false;return emit();},
  add(event){
   const title=String(event?.reward?.title||'').trim().toLowerCase().replace(/\s+/g,' ');
   if(!['feed sprite','hydrate sprite','summon sprite','summon tinysprite'].includes(title)||!event.id||event.status==='canceled'||seen.has(event.id))return false;
   tick();seen.add(event.id);if(seen.size>5000)seen.delete(seen.values().next().value);
   const viewer=String(event.user_name||'Viewer').slice(0,150);
   if(title==='feed sprite'||title==='hydrate sprite'){
    const food=title==='feed sprite',items=food?foods:drinks,key=food?'food':'drink';
    const item=items[Math.min(items.length-1,Math.max(0,Math.floor(random()*items.length)))];
    state.lastGift={id:event.id,item,type:food?'feed':'hydrate'};
    state[key]=Math.min(100,state[key]+25);state.notice=`${viewer} gave Sprite ${item}! (+25 ${key})`;
   }else{state.happiness=Math.min(100,state.happiness+20);state.notice=`${viewer} cheered Sprite up! (+20 happiness)`;}
   // Care restores a little health once every need is above zero, even from exhaustion.
   if(state.food>0&&state.drink>0&&state.happiness>0)state.health=Math.min(100,state.health+5);
   emit();return true;
  }
 };
}
