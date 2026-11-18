import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync('cessna172s/behavior_packs/skyhawk/scripts/toolkit.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function');
let use,join,retry,selection=6,confirmation=0,builds=0,resets=0,homes=0,recoveries=0,spawns=0;
const properties=new Map(),items=[],messages=[];
let full=false,otherPilot=false;
const plane={isOnGround:true,getComponent:()=>({getRiders:()=>otherPilot?[{id:'other'}]:[]}),setRotation:()=>{}};
const dimension={id:'minecraft:overworld',getEntities:()=>[plane],getBlock:()=>({isAir:true}),spawnEntity:()=>{spawns++;return plane;}};
const player={id:'pilot',dimension,location:{x:0,y:64,z:0},getRotation:()=>({y:0}),getViewDirection:()=>({x:0,y:0,z:1}),
 getDynamicProperty:key=>properties.get(key),setDynamicProperty:(k,v)=>properties.set(k,v),sendMessage:m=>messages.push(m),teleport:()=>{},
 getComponent:id=>id==='minecraft:inventory'?{container:{size:items.length,getItem:i=>items[i],addItem:item=>{if(full)return item;items.push(item);}}}:undefined};
class Form{
 title(){return this;}body(){return this;}button(){return this;}button1(){return this;}button2(){return this;}
 async show(){return {selection:this instanceof Confirm?confirmation:selection};}
}
class Confirm extends Form{}
const context={world:{getAllPlayers:()=>[player],afterEvents:{itemUse:{subscribe:fn=>use=fn},playerSpawn:{subscribe:fn=>join=fn}}},
 system:{run:fn=>fn(),runTimeout:fn=>fn(),runInterval:fn=>retry=fn},ItemStack:class{constructor(typeId){this.typeId=typeId;}},ActionFormData:Form,MessageFormData:Confirm,
 saveAirportHome:()=>homes++,resetAircraft:async()=>resets++,buildRunway:async()=>builds++,recover:()=>recoveries++};
vm.runInNewContext(source+'\nregisterFlightToolkit(()=>{},recover);',context);
full=true;join({player,initialSpawn:true});assert.equal(properties.size,0);
full=false;retry();assert.equal(items.length,1);assert.equal(properties.get('skyhawk:toolkit_received'),true);
join({player,initialSpawn:true});retry();assert.equal(items.length,1);
items.length=0;join({player,initialSpawn:false});assert.equal(items.length,0);
console.log('PASS first-join delivery retries full inventory, persists success and avoids reconnect/respawn duplicates');
async function choose(value){selection=value;use({source:player,itemStack:{typeId:'skyhawk:flight_toolkit'}});await new Promise(r=>setImmediate(r));}
await choose(0);assert.equal(spawns,1);
await choose(1);assert.equal(builds,0);confirmation=1;await choose(1);assert.equal(builds,1);
await choose(2);assert.equal(resets,1);await choose(3);assert.equal(homes,1);await choose(4);assert.equal(recoveries,1);
otherPilot=true;await choose(2);await choose(3);assert.equal(resets,1);assert.equal(homes,1);
otherPilot=false;plane.isOnGround=false;await choose(3);assert.equal(homes,1);
dimension.id='minecraft:nether';await choose(1);assert.equal(builds,1);
console.log('PASS menu spawns, confirms runway changes, resets, saves home and recovers; blocks other pilots, airborne home and non-Overworld runway');
const entity=JSON.parse(fs.readFileSync('cessna172s/behavior_packs/skyhawk/entities/cessna172s.json'))['minecraft:entity'];
assert.equal(entity.description.is_spawnable,true);
const client=JSON.parse(fs.readFileSync('cessna172s/resource_packs/skyhawk/entity/cessna172s.entity.json'))['minecraft:client_entity'];
assert.ok(client.description.spawn_egg);
console.log('PASS Creative spawn egg enabled with resource definition');

await choose(5);assert.equal(properties.get('skyhawk:g5_hidden'),true);await choose(5);assert.equal(properties.get('skyhawk:g5_hidden'),false);console.log('PASS per-player G5 performance comparison switch');
