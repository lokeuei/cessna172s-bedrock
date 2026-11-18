import fs from 'node:fs';
const base=new URL('./cessna172s/resource_packs/skyhawk/',import.meta.url);
const rate=22050; let seed=172;
const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/2147483648-1;};
function wav(name,seconds,sample) {
 const n=Math.floor(rate*seconds), b=Buffer.alloc(44+n*2);
 b.write('RIFF');b.writeUInt32LE(36+n*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);
 b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);
 b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);
 for(let i=0;i<n;i++){
   const t=i/rate, fade=Math.min(1,t/.07,(seconds-t)/.1);
   b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,sample(t)*fade))*.75*32767),44+i*2);
 }
 const url=new URL(`sounds/skyhawk/${name}.wav`,base);fs.mkdirSync(new URL('.',url),{recursive:true});fs.writeFileSync(url,b);
}
const tau=2*Math.PI; let low=0;
wav('engine',2,t=>{
 low=.82*low+.18*noise();
 const firing=Math.sin(tau*80*t)+.42*Math.sin(tau*160*t)+.21*Math.sin(tau*240*t);
 return .44*firing+.14*Math.sin(tau*40*t)*(1+.25*Math.sin(tau*8*t))+.15*low;
});
let phase=0;
wav('engine_start',1.4,t=>{
 const rpm=24+56*Math.min(1,t/1.1);phase+=tau*rpm/rate;
 return (.6*Math.sin(phase)+.19*Math.sin(phase*2)+.1*noise())*Math.min(1,t*5);
});
let previous=0,filtered=0;
wav('wind',2,t=>{
 const n=noise(), high=n-previous*.8;previous=n;filtered=.4*filtered+.6*high;
 return filtered*(.5+.12*Math.sin(tau*1.5*t));
});
const sound_definitions={};
for(const name of ['engine','engine_start','wind'])sound_definitions[`skyhawk.${name}`]={category:'neutral',sounds:[{name:`sounds/skyhawk/${name}`,stream:false,volume:1}]};
fs.writeFileSync(new URL('sounds/sound_definitions.json',base),JSON.stringify({format_version:'1.14.0',sound_definitions},null,2)+'\n');
console.log('Generated 3 mono PCM engine/propeller and wind sound effects.');
