import {world,system,ItemStack} from '@minecraft/server';
import {ActionFormData,MessageFormData} from '@minecraft/server-ui';
import {saveAirportHome,resetAircraft} from './airport.js';
import {buildRunway} from './runway.js';

const ITEM='skyhawk:flight_toolkit',PLANE='skyhawk:cessna172s';
const RECEIVED='skyhawk:toolkit_received',open=new Set();
const tell=(p,message)=>p.sendMessage('§b[Flight Toolkit]§r '+message);
function deliver(player){
  if(player.getDynamicProperty(RECEIVED))return;
  const inventory=player.getComponent('minecraft:inventory')?.container;
  if(!inventory)return;
  for(let slot=0;slot<inventory.size;slot++)if(inventory.getItem(slot)?.typeId===ITEM){
    player.setDynamicProperty(RECEIVED,true);return;
  }
  // Retry later if full; never mark delivery complete until it succeeds.
  const remaining=inventory.addItem(new ItemStack(ITEM,1));
  if(remaining)return;
  player.setDynamicProperty(RECEIVED,true);
  tell(player,'Your Flight Toolkit is ready! Hold it and use it to open the menu.');
}
function nearbyPlane(player){
  const ridden=player.getComponent('minecraft:riding')?.entityRidingOn;
  const plane=ridden?.typeId===PLANE?ridden:player.dimension.getEntities({type:PLANE,location:player.location,maxDistance:16,closest:1})[0];
  if(!plane)throw Error('Board a Cessna or stand within 16 blocks of one.');
  if(plane.getComponent('minecraft:rideable').getRiders().some(r=>r.id!==player.id))throw Error('That plane has another pilot.');
  return plane;
}
function requireOnFoot(player){
  if(player.getComponent('minecraft:riding')?.entityRidingOn)throw Error('Exit your mount first.');
}
function spawnAircraft(player){
  requireOnFoot(player);
  const direction=player.getViewDirection(),length=Math.hypot(direction.x,direction.z)||1;
  const location={x:player.location.x+direction.x/length*6,y:Math.floor(player.location.y)+1,z:player.location.z+direction.z/length*6};
  // Check the collision box before spawning in the loaded area.
  for(let x=Math.floor(location.x-1.3);x<=Math.floor(location.x+1.3);x++)
    for(let z=Math.floor(location.z-1.3);z<=Math.floor(location.z+1.3);z++)
      for(let y=Math.floor(location.y);y<=Math.floor(location.y+4);y++){
        const block=player.dimension.getBlock({x,y,z});
        if(!block?.isAir)throw Error('There is not enough clear space ahead. Face an open area and try again.');
      }
  const plane=player.dimension.spawnEntity(PLANE,location);
  plane.setRotation({x:0,y:player.getRotation().y});
  tell(player,'Cessna spawned ahead. Park it and use Set home to save a return point.');
}
export function registerFlightToolkit(onReset,recover){
  async function show(player){
    if(open.has(player.id))return;
    open.add(player.id);
    try{
      const response=await new ActionFormData().title('Flight Toolkit')
        .body('Choose an action. Reset and Set home use your aircraft or the nearest Cessna within 16 blocks.')
        .button('Spawn aircraft').button('Build runway').button('Reset aircraft')
        .button('Set home').button('Recover controls')
        .button(player.getDynamicProperty('skyhawk:g5_hidden')?'Turn G5 display on':'Turn G5 display off')
        .button('Close').show(player);
      if(response.canceled){
        if(response.cancelationReason==='UserBusy')tell(player,'Close other screens, then use the toolkit again.');
        return;
      }
      switch(response.selection){
        case 0:spawnAircraft(player);break;
        case 1:{
          requireOnFoot(player);
          if(player.dimension.id!=='minecraft:overworld')throw Error('Build the runway in the Overworld.');
          const confirmation=await new MessageFormData().title('Build runway?')
            .body('Creates a 640 × 25 elevated runway south of your current position and moves you there. This changes the world. Obstructions stop construction, but completed sections remain.')
            .button1('Cancel').button2('Build runway').show(player);
          if(confirmation.canceled||confirmation.selection!==1)return;
          requireOnFoot(player);
          if(player.dimension.id!=='minecraft:overworld')throw Error('Build the runway in the Overworld.');
          const dimension=player.dimension;
          await buildRunway(dimension,player.location,m=>tell(player,m),pos=>player.teleport(pos,{dimension,rotation:{x:0,y:0}}));
          break;
        }
        case 2:await resetAircraft(nearbyPlane(player),player,onReset);break;
        case 3:{
          const plane=nearbyPlane(player);
          if(!plane.isOnGround)throw Error('Park on the runway before saving its start.');
          saveAirportHome(plane);tell(player,'Home saved. Reset aircraft will return here.');break;
        }
        case 4:recover(player);tell(player,'Camera and controls restored.');break;
        case 5:{
          const hidden=player.getDynamicProperty('skyhawk:g5_hidden')!==true;
          player.setDynamicProperty('skyhawk:g5_hidden',hidden);
          tell(player,hidden?'G5 off. Compare flight performance, then use the toolkit to turn it back on.':'G5 on.');break;
        }
      }
    }catch(error){try{tell(player,error.message);}catch{}}
    finally{open.delete(player.id);}
  }
  world.afterEvents.itemUse.subscribe(({source,itemStack})=>{
    if(itemStack.typeId===ITEM)system.run(()=>show(source));
  });
  world.afterEvents.playerSpawn.subscribe(({player,initialSpawn})=>{
    if(initialSpawn)system.runTimeout(()=>{try{deliver(player);}catch{}},20);
  });
  // Also covers players already online after a script reload, and full inventories.
  system.runInterval(()=>{
    for(const player of world.getAllPlayers())try{deliver(player);}catch{}
  },100);
}
