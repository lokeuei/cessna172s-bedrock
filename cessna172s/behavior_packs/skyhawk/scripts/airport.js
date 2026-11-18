import {world,system} from '@minecraft/server';
const PLANE='skyhawk:cessna172s',HOME='skyhawk:airport_home';
const resetting=new Set();
let resetSequence=0;
const pause=t=>new Promise(resolve=>system.runTimeout(resolve,t));
function parseHome(value){
 try{
  const h=JSON.parse(value);
  if(typeof h.dimension==='string'&&['x','y','z'].every(k=>Number.isFinite(h.location?.[k]))&&Number.isFinite(h.yaw))return h;
 }catch{}
}
export function saveAirportHome(plane){
 const h={dimension:plane.dimension.id,location:{...plane.location},yaw:plane.getDynamicProperty('skyhawk:attitude_ready') ? plane.getProperty('skyhawk:yaw') : plane.getRotation().y};
 plane.setDynamicProperty(HOME,JSON.stringify(h));world.setDynamicProperty(HOME,JSON.stringify(h));return h;
}
export function ensureAirportHome(plane){
 if(parseHome(plane.getDynamicProperty(HOME)))return;
 const airport=parseHome(world.getDynamicProperty(HOME));
 if(airport&&airport.dimension===plane.dimension.id)plane.setDynamicProperty(HOME,JSON.stringify(airport));
 else if(plane.isOnGround)saveAirportHome(plane);
}
export async function resetAircraft(plane,player,onReset=()=>{}){
 if(resetting.has(plane.id))return false;
 const home=parseHome(plane.getDynamicProperty(HOME))??parseHome(world.getDynamicProperty(HOME));
 if(!home)throw Error('No airport start saved. Park at the runway start and choose Set home in the Flight Toolkit.');
 const riders=plane.getComponent('minecraft:rideable');
 if(riders.getRiders().some(r=>r.typeId==='minecraft:player'&&r.id!==player?.id))throw Error('That plane has another pilot.');
 resetting.add(plane.id);
 const dimension=world.getDimension(home.dimension),p=home.location;
 const zone='skyhawk_reset_'+system.currentTick+'_'+resetSequence++;
 let zoneAdded=false;
 try{
  const result=dimension.runCommand(`tickingarea add circle ${Math.floor(p.x)} ${Math.floor(p.y)} ${Math.floor(p.z)} 1 ${zone} true`);
  if(result.successCount<1)throw Error('Could not load the airport start. Check the ticking-area limit.');
  zoneAdded=true;await pause(4);
  let loaded=false;
  for(let i=0;i<100;i++){
   try{loaded=!!dimension.getBlock({x:Math.floor(p.x),y:Math.floor(p.y)-1,z:Math.floor(p.z)});}catch{}
   if(loaded)break;await pause(2);
  }
  if(!loaded)throw Error('Airport chunks did not load in time.');
  const wasRider=!!player&&riders.getRiders().some(r=>r.id===player.id);
  riders.ejectRiders();onReset(plane);
  plane.clearVelocity();plane.triggerEvent('skyhawk:park');
  plane.teleport(p,{dimension,rotation:{x:0,y:home.yaw},keepVelocity:false});
  plane.clearVelocity();
  plane.setProperty('skyhawk:yaw',Math.round(home.yaw));
  plane.setDynamicProperty('skyhawk:attitude_ready',true);
  for(const key of ['pitch','bank','power'])plane.setProperty('skyhawk:'+key,0);
  if(player){
   player.selectedSlotIndex=0;
   player.teleport({x:p.x+3,y:p.y,z:p.z},{dimension,rotation:{x:18,y:home.yaw},keepVelocity:false});
   if(wasRider){await pause(2);plane.getComponent('minecraft:rideable').addRider(player);}
   player.sendMessage('§b[Airport]§r Plane reset to the runway start. Throttle idle; pitch and bank level.');
  }
  await pause(4);return true;
 }finally{
  if(zoneAdded)try{dimension.runCommand('tickingarea remove '+zone);}catch{}
  resetting.delete(plane.id);
 }
}
export function registerAirportControls(onReset){
 system.afterEvents.scriptEventReceive.subscribe(event=>{
  if(!['skyhawk:reset','skyhawk:set_home'].includes(event.id))return;
  const player=event.sourceEntity;if(player?.typeId!=='minecraft:player')return;
  const ridden=player.getComponent('minecraft:riding')?.entityRidingOn;
  const plane=ridden?.typeId===PLANE?ridden:player.dimension.getEntities({type:PLANE,location:player.location,maxDistance:16,closest:1})[0];
  if(!plane){player.sendMessage('§b[Airport]§r Board a Cessna or stand within 16 blocks of one.');return;}
  if(event.id==='skyhawk:set_home'){
   if(!plane.isOnGround){player.sendMessage('Park on the runway before saving its start.');return;}
   saveAirportHome(plane);player.sendMessage('§b[Airport]§r Runway start saved. Use /function skyhawk/reset to return here.');
  }else resetAircraft(plane,player,onReset).catch(error=>player.sendMessage('§b[Airport]§r '+error.message));
 });
}
