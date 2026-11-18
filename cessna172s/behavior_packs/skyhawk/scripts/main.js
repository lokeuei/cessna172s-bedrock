import { world, system, InputButton, ButtonState, InputPermissionCategory } from '@minecraft/server';
import './runway.js';
import {registerFlightToolkit} from './toolkit.js';
import { createFlightState, stepFlight, wrap } from './flight.js';
import { synchronizeMotion, applyFlightMotion } from './motion.js';
import {ensureAirportHome,registerAirportControls} from './airport.js';
import {startFlightDisplay,stopFlightDisplay,flightDisplayText} from './display.js';
const TYPE='skyhawk:cessna172s', OWNED='skyhawk:flight_camera';
const states=new Map();
const parked=new Set();
let ticks=0;
const pressed=(player,key)=>player.inputInfo.getButtonState(key)===ButtonState.Pressed;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const SEAT_PERMISSIONS=[
  [InputPermissionCategory.LateralMovement,'skyhawk:restore_lateral'],
  [InputPermissionCategory.Jump,'skyhawk:restore_jump']
];
function lockSeatInputs(player) {
  // Raw inputInfo remains readable with native movement disabled. This stops
  // walking/jumping from competing with the vehicle's seat and animation.
  for(const [category,key] of SEAT_PERMISSIONS) {
    if(player.getDynamicProperty(key)===undefined)
      player.setDynamicProperty(key,player.inputPermissions.isPermissionCategoryEnabled(category));
    player.inputPermissions.setPermissionCategory(category,false);
  }
}
function restoreSeatInputs(player) {
  for(const [category,key] of SEAT_PERMISSIONS) {
    const previous=player.getDynamicProperty(key);
    if(typeof previous==='boolean') {
      player.inputPermissions.setPermissionCategory(category,previous);
      player.setDynamicProperty(key,undefined);
    }
  }
}

function restoreCamera(player) {
  stopFlightDisplay(player);
  if(player.getProperty('skyhawk:seated')){player.setProperty('skyhawk:seated',false);player.triggerEvent('skyhawk:seat_off');}
  // Permission recovery is independent of camera ownership, including after a
  // reload or a partially completed boarding/cleanup operation.
  restoreSeatInputs(player);
  if(!player?.getDynamicProperty(OWNED)) return;
  try {player.camera.clear(); player.onScreenDisplay.setActionBar('');player.onScreenDisplay.setTitle('');stopFlightSounds(player);}
  finally {player.setDynamicProperty(OWNED,undefined);}
}
function stopFlightSounds(player) {
  // The command works on Script API 2.0; newer stopSound APIs are not required.
  for(const id of ['skyhawk.engine_start','skyhawk.engine','skyhawk.wind']) {
    try {player.runCommand('stopsound @s '+id);} catch {}
  }
}
function releasePilot(s) {
  if(!s?.pilotId) return;
  const player=world.getAllPlayers().find(p=>p.id===s.pilotId);
  if(player) restoreCamera(player);
  s.pilotId=undefined;
}
function board(plane,player,s) {
  ensureAirportHome(plane);
  releasePilot(s); s.pilotId=player.id;
  player.setDynamicProperty(OWNED,true);
  lockSeatInputs(player);
  startFlightDisplay(player);
  // Establish an elevated rear view. Subsequent look input only orbits.
  player.setRotation({x:18,y:s.yaw});
  // Camera look is independent of the locked rider body. Apply once on boarding;
  // the client handles mouse orbit and follows the interpolated vehicle.
  player.camera.setCamera('skyhawk:flight_orbit',{rotation:{x:18,y:s.yaw}});
  player.setProperty('skyhawk:seated',true);
  player.triggerEvent('skyhawk:seat_on');
  plane.triggerEvent('skyhawk:board');
  s.physicsActive=true;
  player.sendMessage('§bC172S v2.8.5§r | W nose down / S nose up | A left / D right | Space+A/D rudder | 1–9 throttle | mouse orbit | Shift exit.');
  s.engineSoundAt=0; s.windSoundAt=0; s.engineRunning=false;
}
function sounds(plane,pilot,s) {
  const play=(id,options)=>pilot?pilot.playSound(id,options):plane.dimension.playSound(id,plane.location,options);
  if(s.throttle>.02) {
    if(!s.engineRunning) {
      play('skyhawk.engine_start',{volume:.65,pitch:1});
      s.engineRunning=true; s.engineSoundAt=ticks+24;
    }
    if(ticks>=s.engineSoundAt) {
      const rpmPitch=.68+s.throttle*.55;
      play('skyhawk.engine',{volume:.3+s.throttle*.5,pitch:rpmPitch});
      s.engineSoundAt=ticks+Math.max(8,Math.round(40/rpmPitch)-2);
    }
  } else {
    if(s.engineRunning&&pilot) {
      for(const id of ['skyhawk.engine','skyhawk.engine_start'])try {pilot.runCommand('stopsound @s '+id);}catch{}
    }
    s.engineRunning=false;
  }
  if(pilot && s.airspeed>12 && ticks>=s.windSoundAt) {
    const pitch=.8+clamp(s.airspeed/100,0,.55);
    pilot.playSound('skyhawk.wind',{volume:clamp((s.airspeed-12)/65,0,.7),pitch});
    s.windSoundAt=ticks+Math.round(40/pitch)-2;
  }
}
system.runInterval(()=>{
  ticks++;
  const seen=new Set(), pilots=new Set();
  for(const dim of ['overworld','nether','the_end']) {
    const dimension=world.getDimension(dim);
    for(const plane of dimension.getEntities({type:TYPE})) {
      seen.add(plane.id);
      try {
        const pilot=plane.getComponent('minecraft:rideable')?.getRiders().find(p=>p.typeId==='minecraft:player');
        let s=states.get(plane.id);
        if(!s && !pilot) {
          if(!parked.has(plane.id)){plane.triggerEvent('skyhawk:park');parked.add(plane.id);}
          continue;
        }
        parked.delete(plane.id);
        if(!s) {
          const v=plane.getVelocity();
          s=createFlightState(plane.getDynamicProperty('skyhawk:attitude_ready') ? plane.getProperty('skyhawk:yaw') : plane.getRotation().y,{x:v.x*20,y:v.y*20,z:v.z*20});
          if(plane.getDynamicProperty('skyhawk:attitude_ready')){
            s.pitch=plane.getProperty('skyhawk:pitch');s.bank=plane.getProperty('skyhawk:bank');
          }
          s.takeoffY=plane.location.y; states.set(plane.id,s);
        }
        if(pilot) {
          pilots.add(pilot.id);
          if(s.pilotId!==pilot.id) board(plane,pilot,s);
        } else if(s.pilotId) {releasePilot(s);}
        const onGround=plane.isOnGround;
        synchronizeMotion(s,plane.getVelocity(),onGround);
        let controls={pitch:0,roll:0,rudder:0,throttle:0,brake:false};
        if(pilot) {
          const input=pilot.inputInfo.getMovementVector(), rudderMode=pressed(pilot,InputButton.Jump);
          controls={pitch:-input.y,roll:rudderMode?0:-input.x,
            rudder:rudderMode?-input.x:0,throttle:pilot.selectedSlotIndex/8,
            brake:onGround&&pilot.selectedSlotIndex===0};
        }
        stepFlight(s,controls,{onGround,altitude:plane.location.y-s.takeoffY});
        if(!pilot&&onGround&&s.airspeed<.5) {
          plane.triggerEvent('skyhawk:park');parked.add(plane.id);states.delete(plane.id);continue;
        }
        // Continue simulating engine-off glide after dismount until landing.
        if(!s.physicsActive){plane.triggerEvent('skyhawk:board');s.physicsActive=true;}
        plane.setDynamicProperty('skyhawk:attitude_ready',true);
        s.published??={};
        for(const [key,value] of [['yaw',Math.round(wrap(s.yaw))],['pitch',Math.round(s.pitch)],['bank',Math.round(s.bank)],['power',Math.round(s.throttle*100)]]) {
          if(s.published[key]!==value){plane.setProperty('skyhawk:'+key,value);if(key==='yaw')plane.setRotation({x:0,y:value});s.published[key]=value;}
        }
        applyFlightMotion(plane,s,onGround);
        sounds(plane,pilot,s);
        if(pilot) {
          for(const [key,value] of [['pitch',s.pitch],['bank',s.bank],['yaw',wrap(s.yaw)]]) {
            const prop='skyhawk:pilot_'+key,rounded=Math.round(value);
            if(pilot.getProperty(prop)!==rounded)pilot.setProperty(prop,rounded);
          }
          if(ticks%4===0) {
            // Refresh a bounded controller so loading/rejoining cannot leave a stale skin pose.
            pilot.playAnimation('animation.skyhawk.pilot_seated_v284',{controller:'skyhawk_pilot_pose',blendOutTime:0,stopExpression:"!q.property('skyhawk:seated')"});
            const hidden=pilot.getDynamicProperty('skyhawk:g5_hidden')===true;
            const payload=hidden?'':flightDisplayText(s,plane.location);
            // Refresh unchanged snapshots only to keep their three-second lifetime alive.
            if(payload!==s.lastHud||ticks-(s.lastHudTick??-100)>=40){
              if(hidden)stopFlightDisplay(pilot);else startFlightDisplay(pilot);
              pilot.onScreenDisplay.setActionBar(payload);
              s.lastHud=payload;s.lastHudTick=ticks;
            }
          }
        }
      } catch(error) {
        try {releasePilot(states.get(plane.id));} catch {}
        if(ticks%100===0) console.warn('[C172S flight] '+error);
      }
    }
  }
  for(const [id,s] of states) if(!seen.has(id)) {try {releasePilot(s);} catch{} states.delete(id);}
  for(const id of parked)if(!seen.has(id))parked.delete(id);
  // Recover cameras on exit, death, removal, dimension change and world reload.
  for(const player of world.getAllPlayers()) if(!pilots.has(player.id)) {
    try {restoreCamera(player);} catch {}
  }
},1);
console.log('[C172S v2] Aerodynamics, orbit camera and sound controller loaded.');
function clearAircraftState(plane){
  releasePilot(states.get(plane.id));states.delete(plane.id);parked.delete(plane.id);
}
registerAirportControls(clearAircraftState);
registerFlightToolkit(clearAircraftState,player=>{
  const plane=player.getComponent('minecraft:riding')?.entityRidingOn;
  if(plane?.typeId===TYPE){plane.getComponent('minecraft:rideable').ejectRider(player);clearAircraftState(plane);}
  restoreCamera(player);
});
