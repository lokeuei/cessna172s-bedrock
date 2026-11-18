import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const flight=await import('./cessna172s/behavior_packs/skyhawk/scripts/flight.js');
const motion=await import('./cessna172s/behavior_packs/skyhawk/scripts/motion.js');
const {createFlightState,stepFlight,axes,length,DT}=flight;
let cases=0;
function test(name,fn){fn();cases++;console.log('PASS '+name);}
test('body axes remain orthonormal through bank/pitch/yaw',()=>{
 const s={yaw:63,pitch:21,bank:47},a=axes(s);
 for(const axis of Object.values(a))assert(Math.abs(length(axis)-1)<1e-10);
 assert(Math.abs(a.forward.x*a.up.x+a.forward.y*a.up.y+a.forward.z*a.up.z)<1e-10);
});
test('idle ground aircraft stays parked; thrust accelerates gradually',()=>{
 const s=createFlightState();for(let i=0;i<100;i++)stepFlight(s,{throttle:0},{onGround:true});
 assert.equal(length(s.velocity),0);
 stepFlight(s,{throttle:1},{onGround:true});assert(s.airspeed>0&&s.airspeed<.2);
 for(let i=0;i<400;i++)stepFlight(s,{throttle:1},{onGround:true});
 assert(s.airspeed>30&&s.airspeed<65);
});
test('runway acceleration and rotation produce positive climb',()=>{
 const s=createFlightState();let airborne=false, altitude=0, distance=0;
 for(let i=0;i<900;i++){
  stepFlight(s,{throttle:1,pitch:s.airspeed>30&&s.pitch<8?.3:0},{onGround:!airborne,altitude});
  if(s.velocity.y>0.05)airborne=true;
  altitude+=s.velocity.y*DT;distance+=s.groundSpeed*DT;
 }
 assert(airborne,'never left runway');assert(altitude>10,'failed to gain height');
 console.log('  takeoff scenario: '+Math.round(altitude)+'m climb, '+Math.round(distance)+'m travel, '+Math.round(s.airspeed*1.94384)+'kt');
});
test('inverted pitch controls change attitude in the correct direction',()=>{
 const up=createFlightState(0,{x:0,y:0,z:45}),down=createFlightState(0,{x:0,y:0,z:45});
 for(let i=0;i<20;i++){stepFlight(up,{pitch:1,throttle:.7});stepFlight(down,{pitch:-1,throttle:.7});}
 assert(up.pitch>5);assert(down.pitch<-5);assert(up.velocity.y>down.velocity.y);
});

test('held elevator completes positive and negative loops without an 80 degree stop',()=>{
 for(const direction of [1,-1]){
  const s=createFlightState(0,{x:0,y:0,z:70});let vertical=false,inverted=false,returned=false;
  for(let i=0;i<500;i++){
   stepFlight(s,{pitch:direction,throttle:1},{onGround:false,altitude:500});
   const a=axes(s);
   if(Math.abs(a.forward.y)>.99)vertical=true;
   if(a.up.y<-.95)inverted=true;
   if(Math.abs(s.pitchTravel)>350&&a.forward.z>.95&&a.up.y>.95)returned=true;
   for(const v of Object.values(a))assert(Math.abs(length(v)-1)<1e-9);
  }
  assert(vertical&&inverted&&returned,'must pass vertical, inverted and return upright');
  assert(Math.abs(s.pitchTravel)>360);
 }
});

test('inverted S pulls toward aircraft roof; W pushes away',()=>{
 for(const bank of [0,90,180,-90])for(const direction of [1,-1]){
  const s=createFlightState(37,{x:0,y:0,z:60});s.bank=bank;
  const before=axes(s),roof=before.up;
  s.velocity={x:before.forward.x*60,y:before.forward.y*60,z:before.forward.z*60};
  stepFlight(s,{pitch:direction,throttle:1});
  const f=axes(s).forward;
  assert(direction*((f.x-before.forward.x)*roof.x+(f.y-before.forward.y)*roof.y+(f.z-before.forward.z)*roof.z)>0);
 }
});
test('roll holds a bank and produces a turn; rudder yaws without commanding roll',()=>{
 const s=createFlightState(0,{x:0,y:0,z:45});
 for(let i=0;i<20;i++)stepFlight(s,{roll:1,throttle:.7});
 const bank=s.bank;for(let i=0;i<50;i++)stepFlight(s,{throttle:.7});
 assert(s.bank>=bank&&s.bank>20);assert(s.yaw>1);
 const r=createFlightState(0,{x:0,y:0,z:45});for(let i=0;i<40;i++)stepFlight(r,{rudder:-1,throttle:.7});
 assert(r.yaw<-5);assert.equal(r.bank,0);
});
test('excess angle of attack stalls; lowering nose restores lift coefficient',()=>{
 const s=createFlightState(0,{x:0,y:0,z:28});s.pitch=28;
 stepFlight(s,{throttle:0});assert(s.stall);assert(s.pitchRate<0);
 s.pitch=2;s.velocity={x:0,y:0,z:40};stepFlight(s,{throttle:.7});assert(!s.stall);
});
test('engine-off flight preserves momentum and gravity prevents hovering',()=>{
 const s=createFlightState(0,{x:0,y:0,z:40});
 stepFlight(s,{throttle:0});assert(s.airspeed>39);assert(s.velocity.y<0);
 const stopped=createFlightState();stepFlight(stopped,{throttle:0});assert(stopped.velocity.y<-.45);
});
test('long flight remains finite and ground brakes stop the aircraft',()=>{
 const s=createFlightState(0,{x:0,y:0,z:50});
 for(let i=0;i<5000;i++)stepFlight(s,{throttle:.7,pitch:Math.sin(i*.02)*.1,roll:Math.sin(i*.03)*.1});
 for(const v of [s.pitch,s.bank,s.yaw,...Object.values(s.velocity)])assert(Number.isFinite(v));
 assert(s.airspeed<=90.001);
 const b=createFlightState(0,{x:0,y:0,z:20});for(let i=0;i<200;i++)stepFlight(b,{brake:true,throttle:0},{onGround:true});assert(b.airspeed<.1);
});

// Integration checks exercise board/dismount/removal/reload with a mocked Bedrock host.
function host(){
 let tick,mounted=true,exists=true,look={x:0,y:0},input={x:0,y:0},jump=false;
 let velocity={x:0,y:0,z:0}, location={x:0,y:70,z:0},rotation={x:0,y:0};
 const properties={},pilotProperties={},planeDynamic=new Map(),dynamic=new Map(),cameraCalls=[],animations=[],errors=[],sounds=[],players=[],permissions=new Map([[4,true],[6,true]]);
 const pilot={id:'pilot',typeId:'minecraft:player',selectedSlotIndex:0,
  getProperty:k=>pilotProperties[k],setProperty:(k,v)=>pilotProperties[k]=v,
  inputInfo:{getMovementVector:()=>input,getButtonState:()=>jump?'Pressed':'Released'},
  inputPermissions:{isPermissionCategoryEnabled:k=>permissions.get(k)??true,setPermissionCategory:(k,v)=>permissions.set(k,v)},
  getRotation:()=>look,setRotation:r=>look={...r},sendMessage:()=>{},playAnimation:(...args)=>animations.push(args),triggerEvent:()=>{},
  getDynamicProperty:k=>dynamic.get(k),setDynamicProperty:(k,v)=>v===undefined?dynamic.delete(k):dynamic.set(k,v),
  camera:{setCamera:(...args)=>cameraCalls.push(args),clear:()=>cameraCalls.push('clear')},
  playSound:(...args)=>sounds.push(args),onScreenDisplay:{setActionBar:()=>{}}};players.push(pilot);
 const dimension={getEntities:()=>exists?[plane]:[],getBlockFromRay:()=>undefined,playSound:(...args)=>sounds.push(args)};
 const plane={id:'plane',get location(){return location;},dimension,isOnGround:true,
  getComponent:()=>({getRiders:()=>mounted?[pilot]:[]}),getRotation:()=>rotation,
  getDynamicProperty:k=>planeDynamic.get(k),setDynamicProperty:(k,v)=>planeDynamic.set(k,v),getProperty:k=>properties[k],
  getVelocity:()=>velocity,triggerEvent:()=>{},setProperty:(k,v)=>properties[k]=v,
  setRotation:r=>rotation={...r},applyImpulse:v=>{for(const k of ['x','y','z'])velocity[k]+=v[k];}};
 const world={getAllPlayers:()=>players,getDimension:id=>id==='overworld'?dimension:{getEntities:()=>[]}};
 const source=fs.readFileSync('cessna172s/behavior_packs/skyhawk/scripts/main.js','utf8').replace(/^import[^\n]+\n/gm,'');
 vm.runInNewContext(source,{...flight,...motion,startFlightDisplay:()=>{},stopFlightDisplay:()=>{},flightDisplayText:()=>'',ensureAirportHome:()=>{},registerAirportControls:()=>{},registerFlightToolkit:()=>{},world,system:{runInterval:fn=>tick=fn},InputButton:{Jump:'Jump'},ButtonState:{Pressed:'Pressed'},InputPermissionCategory:{LateralMovement:4,Jump:6},console:{warn:m=>errors.push(m),log:()=>{}}});
 return {pilot,plane,pilotProperties,dynamic,cameraCalls,animations,properties,errors,sounds,players,permissions,
  tick(){tick();location={x:location.x+velocity.x,y:location.y+velocity.y,z:location.z+velocity.z};},
  set mounted(v){mounted=v;},set exists(v){exists=v;},set jump(v){jump=v;},set input(v){input=v;},set look(v){look=v;}};
}
test('boarding enables orbit, dismount clears once, stale ownership recovers',()=>{
 const h=host();h.tick();assert(h.dynamic.get('skyhawk:flight_camera'));assert.equal(h.cameraCalls[0][0],'skyhawk:flight_orbit');
 h.mounted=false;h.tick();assert.equal(h.cameraCalls.at(-1),'clear');assert.equal(h.dynamic.size,0);
 h.tick();assert.equal(h.cameraCalls.filter(v=>v==='clear').length,1);
 h.dynamic.set('skyhawk:flight_camera',true);h.tick();assert.equal(h.cameraCalls.at(-1),'clear');assert.equal(h.errors.length,0);
});
test('boarding enables a synced pilot pose and exit disables it',()=>{
 const h=host();h.tick();assert.equal(h.pilotProperties['skyhawk:seated'],true);
 h.mounted=false;h.tick();assert.equal(h.pilotProperties['skyhawk:seated'],false);assert.equal(h.errors.length,0);
 assert(!fs.existsSync('cessna172s/resource_packs/skyhawk/entity/player.entity.json'),'must preserve the actual player skin');
 const mounted=host();for(let i=0;i<6;i++)mounted.tick();
 assert.equal(mounted.animations.length,1,'refresh one bounded pose controller every four ticks');
 assert.equal(mounted.animations[0][0],'animation.skyhawk.pilot_seated_v284');
 assert.equal(mounted.animations[0][1].controller,'skyhawk_pilot_pose');
 assert(!fs.existsSync('cessna172s/resource_packs/skyhawk/animations/skyhawk_native_riding.animation.json'),'obsolete native animation overrides must not be shipped');
});

test('visual pitch and roll agree with reported flight attitude',()=>{
 const a=JSON.parse(fs.readFileSync('cessna172s/resource_packs/skyhawk/animations/cessna172s.animation.json'));
 const rotation=a.animations['animation.skyhawk.flight_v284'].bones.root.rotation;
 // Client observation: in v2.1.2, +27 HUD pitch with +27 model X visibly
 // pointed the nose down. Bedrock's rendered pitch must negate our nose-up
 // flight convention. Keep this regression grounded in the client evidence.
 const evaluate=(expression,name,value)=>Function('return '+expression.replace(`q.property('skyhawk:${name}')`,'('+String(value)+')'))();
 assert.equal(evaluate(rotation[0],'pitch',27),-27,'reproduce the reported +27-degree pitch mismatch');
 assert.equal(evaluate(rotation[0],'pitch',-15),15,'negative HUD pitch must reverse the visual tilt');
 assert(evaluate(rotation[2],'bank',20)<0,'right wing is model +X; negative Z rotation lowers it for positive right bank');
 const geo=JSON.parse(fs.readFileSync('cessna172s/resource_packs/skyhawk/models/entity/cessna172s.geo.json'));
 assert.deepEqual(geo['minecraft:geometry'][0].bones.find(b=>b.name==='root').pivot,[0,23.2,-5.6]);
});
test('native camera is applied once and never repositions per physics tick',()=>{
 const h=host();h.tick();for(let i=0;i<100;i++)h.tick();
 assert.equal(h.cameraCalls.length,1);assert.equal(h.cameraCalls[0][0],'skyhawk:flight_orbit');
 assert.equal(h.cameraCalls[0].length,2);assert.deepEqual(JSON.parse(JSON.stringify(h.cameraCalls[0][1])),{rotation:{x:18,y:0}},'set starting angles only on boarding');
 const preset=JSON.parse(fs.readFileSync('cessna172s/behavior_packs/skyhawk/cameras/presets/flight_orbit.json'))['minecraft:camera_preset'];
 assert.equal(preset.inherit_from,'minecraft:follow_orbit');assert.equal(preset.radius,14);
 assert.equal(preset.control_scheme,'camera_relative');
 const entity=JSON.parse(fs.readFileSync('cessna172s/behavior_packs/skyhawk/entities/cessna172s.json'))['minecraft:entity'];
 assert.equal(entity.components['minecraft:rideable'].seats[0].third_person_camera_radius,14);
 assert.equal(entity.components['minecraft:conditional_bandwidth_optimization'].default_values.max_dropped_ticks,0);
 assert(!entity.components['minecraft:movement.basic']);
});
test('pilot receives the same pitch bank and heading as aircraft geometry',()=>{
 const h=host();h.tick();h.plane.isOnGround=false;h.pilot.selectedSlotIndex=8;h.input={x:-1,y:-1};
 for(let i=0;i<60;i++)h.tick();
 for(const k of ['pitch','bank','yaw'])assert.equal(h.pilotProperties['skyhawk:pilot_'+k],h.properties['skyhawk:'+k]);
 const pose=JSON.parse(fs.readFileSync('cessna172s/resource_packs/skyhawk/animations/pilot_seated.animation.json')).animations['animation.skyhawk.pilot_seated_v284'];
 assert(pose.bones.root.rotation[2].includes("q.property('skyhawk:pilot_bank')"));
 assert.equal(h.errors.length,0);
});

test('bounded pilot controller refreshes only while seated and restores mount sounds',()=>{
 const h=host();for(let i=0;i<40;i++)h.tick();assert.equal(h.animations.length,10);
 assert(h.animations.every(a=>a[1].controller==='skyhawk_pilot_pose'));
 assert(h.animations.every(a=>a[1].stopExpression==="!q.property('skyhawk:seated')"));
 h.mounted=false;for(let i=0;i<8;i++)h.tick();assert.equal(h.animations.length,10);
 assert.equal(h.pilotProperties['skyhawk:seated'],false);
 const player=JSON.parse(fs.readFileSync('cessna172s/behavior_packs/skyhawk/entities/player.json'))['minecraft:entity'];
 assert.equal(player.component_groups['skyhawk:quiet_seat']['minecraft:movement_sound_distance_offset'].value,1000000000);
 assert.deepEqual(player.events['skyhawk:seat_off'].remove.component_groups,['skyhawk:quiet_seat']);
 const plane=JSON.parse(fs.readFileSync('cessna172s/behavior_packs/skyhawk/entities/cessna172s.json'))['minecraft:entity'];
 assert.equal(plane.components['minecraft:movement_sound_distance_offset'].value,1000000000);
 const sounds=JSON.parse(fs.readFileSync('cessna172s/resource_packs/skyhawk/sounds.json'));
 assert.equal(sounds.entity_sounds.entities['skyhawk:cessna172s'].events.step,'');
});

test('native walk/jump are locked in the seat and restored exactly on exit',()=>{
 const h=host();h.tick();assert.equal(h.permissions.get(4),false);assert.equal(h.permissions.get(6),false);
 h.input={x:-1,y:-1};h.jump=true;assert.deepEqual(h.pilot.inputInfo.getMovementVector(),{x:-1,y:-1});
 assert.equal(h.pilot.inputInfo.getButtonState('Jump'),'Pressed');
 h.mounted=false;h.tick();assert.equal(h.permissions.get(4),true);assert.equal(h.permissions.get(6),true);assert.equal(h.dynamic.size,0);
 const restricted=host();restricted.permissions.set(4,false);restricted.tick();restricted.mounted=false;restricted.tick();
 assert.equal(restricted.permissions.get(4),false,'preserve a pre-existing movement restriction');
 assert.equal(restricted.permissions.get(6),true);
});
test('stale movement locks recover even without camera ownership',()=>{
 const h=host();h.mounted=false;h.permissions.set(4,false);h.permissions.set(6,false);
 h.dynamic.set('skyhawk:restore_lateral',true);h.dynamic.set('skyhawk:restore_jump',true);
 h.tick();assert.equal(h.permissions.get(4),true);assert.equal(h.permissions.get(6),true);assert.equal(h.dynamic.size,0);
});
test('native seat heading follows attitude while the camera is applied once',()=>{
 const h=host();h.tick();h.plane.isOnGround=false;h.pilot.selectedSlotIndex=8;h.input={x:-1,y:-1};
 for(let i=0;i<400;i++)h.tick();
 assert.equal(h.animations.length,100);assert.equal(h.plane.getRotation().y,h.properties['skyhawk:yaw']);assert.equal(h.cameraCalls.length,1);assert.equal(h.errors.length,0);
});

test('aircraft removal and pilot replacement release the original camera',()=>{
 const h=host();h.tick();h.exists=false;h.tick();assert.equal(h.cameraCalls.at(-1),'clear');assert.equal(h.errors.length,0);
});
test('mouse orbit never changes aircraft pitch, bank, or heading',()=>{
 const a=host(),b=host();a.tick();b.tick();
 for(let i=0;i<40;i++){a.look={x:50,y:170};b.look={x:-10,y:-40};a.tick();b.tick();}
 assert.deepEqual(a.properties,b.properties);assert.equal(a.cameraCalls.length,1);assert.equal(b.cameraCalls.length,1);
 assert.equal(a.errors.length,0);assert.equal(b.errors.length,0);
});
test('native drag and repeated position samples cannot erase flight momentum',()=>{
 const s=createFlightState(0,{x:0,y:0,z:40});s.commandedVelocity={x:0,y:0,z:2};
 s.lastPosition={x:0,y:100,z:0};
 for(let i=0;i<10;i++)motion.synchronizeMotion(s,{x:0,y:0,z:1.82},false);
 assert.equal(s.velocity.z,40);
 motion.synchronizeMotion(s,{x:0,y:0,z:0},false);assert.equal(s.velocity.z,40,'ignore one native sample');
 motion.synchronizeMotion(s,{x:0,y:0,z:0},false);assert.equal(s.velocity.z,0,'two genuine native stops cancel blocked momentum');
});
test('A/D rolls while Space+A/D yaws, W/S drives inverted elevator',()=>{
 const h=host();h.tick();h.plane.isOnGround=false;h.pilot.selectedSlotIndex=8;h.input={x:-1,y:-1};
 for(let i=0;i<60;i++)h.tick();assert(h.properties['skyhawk:bank']>0);assert(h.properties['skyhawk:pitch']>0);
 const b=host();b.tick();b.plane.isOnGround=false;b.pilot.selectedSlotIndex=8;b.input={x:-1,y:0};b.jump=true;
 for(let i=0;i<200;i++)b.tick();assert(b.properties['skyhawk:yaw']!==0);assert.equal(b.errors.length,0);
});
test('engine start and engine/wind sound events are wired to power and speed',()=>{
 const h=host();h.tick();h.pilot.selectedSlotIndex=8;
 for(let i=0;i<450;i++)h.tick();
 for(const event of ['skyhawk.engine_start','skyhawk.engine','skyhawk.wind'])assert(h.sounds.some(v=>v[0]===event),event);
 assert.equal(h.errors.length,0);
});
console.log(`${cases} flight, camera, input and sound checks passed. Host physics/rendering/audio require Minecraft verification.`);
