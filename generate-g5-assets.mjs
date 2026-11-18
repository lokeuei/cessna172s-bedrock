import fs from 'node:fs';
import {PNG} from 'pngjs';
import {font} from './g5-font.mjs';
const root='cessna172s',rp=root+'/resource_packs/skyhawk/';
const out=rp+'textures/ui/skyhawk/g5/';
for(const f of fs.readdirSync(out))if(f.endsWith('.png'))fs.unlinkSync(out+f);
const C={sky:[34,93,164,255],earth:[112,73,31,255],white:[238,244,247,255],black:[7,9,12,255],tape:[34,40,51,255]};
const img=(w,h)=>new PNG({width:w,height:h});
function px(p,x,y,c){x=Math.round(x);y=Math.round(y);if(x>=0&&y>=0&&x<p.width&&y<p.height)p.data.set(c,(y*p.width+x)*4);}
function rect(p,x,y,w,h,c){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)px(p,xx,yy,c);}
function line(p,x,y,xx,yy,c){let n=Math.max(Math.abs(xx-x),Math.abs(yy-y),1);for(let i=0;i<=n;i++)px(p,x+(xx-x)*i/n,y+(yy-y)*i/n,c);}
function text(p,s,x,y,k=2){for(const ch of String(s)){const g=font[ch];if(g)for(let yy=0;yy<5;yy++)for(let xx=0;xx<3;xx++)if(g[yy][xx]==='1')rect(p,x+xx*k,y+yy*k,k,k,C.white);x+=4*k;}}
function save(name,p){fs.writeFileSync(out+name+'.png',PNG.sync.write(p));return 'textures/ui/skyhawk/g5/'+name;}
// One cached texture per roll angle, independent of pitch/speed/altitude.
for(let index=0;index<36;index++){
 const p=img(768,768),r=(index*10-180)*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
 for(let y=0;y<768;y++)for(let x=0;x<768;x++)px(p,x,y,(x-384)*s+(y-384)*c<0?C.sky:C.earth);
 const tr=(x,y)=>[384+x*c+y*s,384-x*s+y*c];
 for(let angle=-90;angle<=90;angle+=10){let y=-angle*2;line(p,...tr(-25,y),...tr(25,y),C.white);}
 line(p,...tr(-380,0),...tr(380,0),C.white);save('roll_'+String(index).padStart(2,'0'),p);
}
const speed=img(42,936);rect(speed,0,0,42,936,C.tape);
for(let v=0;v<=200;v+=5){const y=108+(200-v)*3.6;line(speed,v%10?38:34,y,41,y,C.white);if(v%10===0)text(speed,v,2,y-5);}
save('speed_strip',speed);
const altitude=img(54,3996);rect(altitude,0,0,54,3996,C.tape);
for(let v=-1000;v<=20000;v+=100){const y=108+(20000-v)*.18;line(altitude,0,y,6,y,C.white);text(altitude,v,9,y-3,1);}
save('altitude_strip',altitude);
const readout=img(54,23);rect(readout,0,0,54,23,C.black);save('readout',readout);
const bezel=img(272,304);rect(bezel,0,0,272,304,C.black);rect(bezel,3,3,266,298,[43,46,51,255]);rect(bezel,8,8,256,288,C.black);text(bezel,'SKYHAWK G5',96,13);text(bezel,'2.8.5',16,284,1);save('bezel',bezel);
const reference=img(240,216);line(reference,80,108,101,108,[255,224,39,255]);line(reference,101,108,120,119,[255,224,39,255]);line(reference,120,119,139,108,[255,224,39,255]);line(reference,139,108,160,108,[255,224,39,255]);save('reference',reference);

for(let i=0;i<10;i++)fs.copyFileSync(out+'roll_0'+i+'.png',out+'roll_'+i+'.png');
console.log('Generated cached horizon textures and fixed instrument tapes.');

const footer=img(240,38);rect(footer,0,0,240,38,C.black);save('footer',footer);
