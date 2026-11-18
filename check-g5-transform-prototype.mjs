import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root='cessna172s/';
const source=fs.readFileSync(root+'behavior_packs/skyhawk/scripts/display.js','utf8');
const context={};vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('export function flightDisplayText')).replace('export ',''),context);
const decode=(p,start)=>(Number(p.slice(start,start+7))-500000)/100;
let cases=0;
for(const pitch of [-90,-45,0,45,90])for(const bank of [-180,-95,-40,0,40,95,180])for(const speed of [0,50,200])for(const altitude of [-1000,0,720,20000]){
 const p=context.flightDisplayText({pitch,bank,airspeed:speed/1.94384,groundSpeed:20,verticalSpeed:0,throttle:.8,yaw:0},{y:altitude/3.28084});
 assert.equal(p.length,72);assert.equal(p.slice(0,5),'G5T1|');
 assert(fs.existsSync(root+'resource_packs/skyhawk/textures/ui/skyhawk/g5/roll_'+Number(p.slice(5,7))+'.png'));
 assert(Math.abs(decode(p,21)+(200-speed)*3.6*.49)<.011);
 assert(Math.abs(decode(p,28)+(20000-altitude)*.18*.49)<.011);
 const x=decode(p,7),y=decode(p,14);
 assert(x<=0&&x+768*.49>=240*.49,'horizon covers viewport at extreme pitch/roll');
 assert(y<=0&&y+768*.49>=216*.49,'horizon covers viewport at extreme pitch/roll');
 assert.equal(Number(p.slice(35,39)),speed);assert.equal(Number(p.slice(39,45)),altitude);cases++;
}
for(const [yaw,expected]of [[-180,'000 N'],[-90,'090 E'],[0,'180 S'],[90,'270 W']]){
 const p=context.flightDisplayText({pitch:0,bank:0,airspeed:0,verticalSpeed:0,throttle:0,yaw},{y:0});
 assert.equal(p.slice(45,53).trim(),expected);
}
const east=context.flightDisplayText({pitch:10,bank:40,airspeed:50,groundSpeed:48,verticalSpeed:2,throttle:.5,yaw:-90,velocity:{x:48,y:2,z:0}},{y:220});
assert.equal(east.slice(53,57).trim(),'93');assert.equal(east.slice(57,64).trim(),'394');assert.equal(east.slice(64,68).trim(),'50');assert.equal(east.slice(68,72).trim(),'090');
const ui=JSON.parse(fs.readFileSync(root+'resource_packs/skyhawk/ui/hud_screen.json'));
const instrument=ui.hud_actionbar_text.controls[0].g5;
let count=0;const moving=[];
function walk(c){count++;assert(!c.factory,'only one outer telemetry snapshot factory');
 if(c.use_anchored_offset)moving.push(c);
 for(const child of c.controls??[])Object.values(child).forEach(walk);
}walk(instrument);
assert.equal(count,20);assert.equal(moving.length,3);
for(const c of moving){
 const bindings=c.bindings.map(b=>b.source_property_name).join('\n');
 assert(bindings.includes('(0 + #y_text)'),'parse fixed-width string before arithmetic');
 assert(bindings.includes('#factor_y * (#y_number - 500000)'),'float property must be left operand');
 assert(Math.abs(c.property_bag['#factor_y']-1/10584)<1e-12,'offsets are viewport proportions, not pixels');
}
assert.equal(ui.root_panel.modifications[0].value.hud_actionbar_text_area.factory.max_children_size,1);
const entity=JSON.parse(fs.readFileSync(root+'behavior_packs/skyhawk/entities/cessna172s.json'))['minecraft:entity'];
const seat=entity.components['minecraft:rideable'].seats[0];
assert.deepEqual(seat.position,[0,1.15,.35]);assert.equal(seat.lock_rider_rotation,undefined);
const pose=JSON.parse(fs.readFileSync(root+'resource_packs/skyhawk/animations/pilot_seated.animation.json')).animations['animation.skyhawk.pilot_seated_v284'];
assert(pose.loop&&pose.override_previous_animation);
assert(pose.bones.root.position[0].startsWith('12 * math.sin'));
assert(pose.bones.root.position[2].startsWith('-12 * math.sin'));
// Bedrock rendered rotation signs: compensate the rotated hip, not the feet.
for(const pitch of [-90,-30,0,30,90])for(const bank of [-180,-90,-40,0,40,90,180]){
 const p=pitch*Math.PI/180,b=bank*Math.PI/180;
 const rotated=[-12*Math.sin(b)*Math.cos(p),12*Math.cos(b)*Math.cos(p),12*Math.sin(p)];
 const offset=[12*Math.sin(b)*Math.cos(p),12*(1-Math.cos(b)*Math.cos(p)),-12*Math.sin(p)];
 assert(rotated.every((n,i)=>Math.abs(n+offset[i]-[0,12,0][i])<1e-10));
}
const main=fs.readFileSync(root+'behavior_packs/skyhawk/scripts/main.js','utf8');
assert(main.includes("if(key==='yaw')plane.setRotation({x:0,y:value})"),'native seat must turn with visual heading');
assert(!main.includes('seat probe')&&!main.includes('Temporary stationary'),'diagnostic overrides must not ship');
for(const kind of ['behavior','resource']){
 const m=JSON.parse(fs.readFileSync(root+kind+'_packs/skyhawk/manifest.json'));assert.deepEqual(m.header.version,[2,8,5]);
 for(const dep of m.dependencies??[])if(dep.uuid){
  const other=JSON.parse(fs.readFileSync(root+(kind==='behavior'?'resource':'behavior')+'_packs/skyhawk/manifest.json'));
  assert.equal(dep.uuid,other.header.uuid);assert.deepEqual(dep.version,other.header.version);
 }
}
console.log(`PASS ${cases} telemetry/crop cases; ${count} G5 controls; heading/track/GS/VS; normalized float bindings; fixed hip and native heading; bundled dependencies`);
