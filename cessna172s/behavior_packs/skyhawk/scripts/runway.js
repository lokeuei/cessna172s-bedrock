import {world,system} from '@minecraft/server';
import {saveAirportHome} from './airport.js';
let building=false;
const pause=t=>new Promise(resolve=>system.runTimeout(resolve,t));

// Build in loaded segments: one enormous /fill fails outside loaded chunks.
export async function buildRunway(dimension,origin,notify=()=>{},onReady=()=>{}) {
 if(building) {notify('A runway is already being built. Please wait.');return false;}
 building=true;
 const x=Math.floor(origin.x),z=Math.floor(origin.z);
 const y=Math.min(280,Math.max(220,Math.ceil(origin.y)+32));
 const length=640,width=25,prefix='skyhawk_build_'+system.currentTick+'_';
 const activeZones=new Set();let previousZone;
 const command=c=>dimension.runCommand(c);
 try {
  notify('Building a 640 × 25 sky runway at Y '+y+'. This takes about 30 seconds.');
  for(let start=0;start<length;start+=64) {
   const a=z+start,b=a+63;
   const zone=prefix+start;
   const added=command(`tickingarea add ${x-12} ${y} ${a} ${x+12} ${y+8} ${b} ${zone} true`);
   if(added.successCount<1)throw Error('Could not reserve runway chunks. Check your world ticking-area limit.');
   activeZones.add(zone);
   await pause(24);
   // Newly generated chunks can take longer than a fixed delay to become
   // accessible, even when the ticking-area command has already succeeded.
   let ready=false;
   for(let attempt=0;attempt<100;attempt++){
    try {ready=!!dimension.getBlock({x:x-12,y,z:a})&&!!dimension.getBlock({x:x+12,y,z:b});}catch{}
    if(ready)break;await pause(4);
   }
   if(!ready)throw Error('Timed out waiting for runway chunks to load.');
   if(previousZone){command('tickingarea remove '+previousZone);activeZones.delete(previousZone);}
   previousZone=zone;
   // Abort instead of cutting through existing terrain or buildings. Yield
   // regularly so inspecting the clearance volume cannot stall a game tick.
   let checked=0;
   for(let zz=a;zz<=b;zz++)for(let xx=x-12;xx<=x+12;xx++)for(let yy=y;yy<=y+7;yy++) {
    let block=dimension.getBlock({x:xx,y:yy,z:zz});
    if(!block){await pause(10);block=dimension.getBlock({x:xx,y:yy,z:zz});}
    if(!block||!block.isAir)throw Error('Runway space is obstructed near '+xx+' '+yy+' '+zz+'. Move elsewhere and try again.');
    if(++checked%500===0)await pause(1);
   }
   command(`fill ${x-12} ${y} ${a} ${x+12} ${y} ${b} gray_concrete`);
   for(const side of [-11,11])command(`fill ${x+side} ${y} ${a} ${x+side} ${y} ${b} white_concrete`);
   for(let zz=a;zz<=b;zz+=16)command(`fill ${x} ${y} ${zz} ${x} ${y} ${Math.min(zz+7,b)} white_concrete`);
   if(start===0||start===length-64) {
    const threshold=start===0?a+12:b-12;
    for(const offset of [-8,-6,-4,4,6,8])command(`fill ${x+offset} ${y} ${threshold} ${x+offset} ${y} ${threshold+5} white_concrete`);
   }
   for(let zz=a;zz<=b;zz+=32)for(const side of [-12,12])command(`setblock ${x+side} ${y} ${zz} sea_lantern`);
  }
  // Reload the departure end before spawning and moving the pilot there.
  const zone=prefix+'departure';
  command(`tickingarea add circle ${x} ${y} ${z+20} 2 ${zone} true`);
  activeZones.add(zone);
  await pause(24);
  const plane=dimension.spawnEntity('skyhawk:cessna172s',{x:x+.5,y:y+1,z:z+20.5});
  plane.setRotation({x:0,y:0});plane.nameTag='Cessna 172S — Runway';
  saveAirportHome(plane);
  await onReady({x:x+4.5,y:y+1,z:z+20.5});
  notify('Runway ready! Plane faces south (+Z). Board, select hotbar 9, accelerate to about 60 kt, then gently press S.');
  return true;
 }catch(error){notify('Runway stopped: '+error.message+' Any completed platform sections remain.');return false;}
 finally {for(const zone of activeZones)try{command('tickingarea remove '+zone);}catch{} building=false;}
}

system.afterEvents.scriptEventReceive.subscribe(event=>{
 if(event.id!=='skyhawk:runway')return;
 const player=event.sourceEntity;
 if(player?.typeId!=='minecraft:player')return;
 if(player.dimension.id!=='minecraft:overworld'){
  player.sendMessage('Build the runway in the Overworld.');return;
 }
 if(player.getComponent('minecraft:riding')){
  player.sendMessage('Exit the aircraft before building a runway.');return;
 }
 buildRunway(player.dimension,player.location,m=>player.sendMessage('§b[Runway]§r '+m),
  pos=>player.teleport(pos,{dimension:player.dimension,rotation:{x:0,y:0}}));
});
