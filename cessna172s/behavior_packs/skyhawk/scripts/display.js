import {HudElement,HudVisibility} from '@minecraft/server';
const ELEMENTS=[[HudElement.Hunger,'skyhawk:hunger_was_hidden'],[HudElement.HorseHealth,'skyhawk:mount_health_was_hidden']];
export function startFlightDisplay(player){
 for(const [element,key] of ELEMENTS){
  if(player.getDynamicProperty(key)===undefined)
   player.setDynamicProperty(key,player.onScreenDisplay.getHiddenHudElements().includes(element));
  player.onScreenDisplay.setHudVisibility(HudVisibility.Hide,[element]);
 }
}
export function stopFlightDisplay(player){
 for(const [element,key] of ELEMENTS){
  const previous=player.getDynamicProperty(key);
  if(typeof previous==='boolean'){
   player.onScreenDisplay.setHudVisibility(previous?HudVisibility.Hide:HudVisibility.Reset,[element]);
   player.setDynamicProperty(key,undefined);
  }
 }
}
export function flightDisplayText(s,location){
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),field=(v,n)=>String(v).padEnd(n,' '),off=v=>String(Math.round(v*100)+500000).padStart(7,'0');
 const speed=clamp(Math.round(s.airspeed*1.94384),0,200),alt=clamp(Math.round(location.y*3.28084/20)*20,-1000,20000),bank=((Math.round((s.bank+180)/10)%36)+36)%36,r=(bank*10-180)*Math.PI/180,pitch=clamp(s.pitch,-90,90)*2;
 const yaw=Math.round(((s.yaw+180)%360+360)%360)%360,card=['N','NE','E','SE','S','SW','W','NW'][Math.round(yaw/45)%8];
 const h=s.velocity?Math.hypot(s.velocity.x,s.velocity.z):0,track=h>.5?Math.round((Math.atan2(-s.velocity.x,s.velocity.z)*180/Math.PI+540)%360)%360:yaw;
 return 'G5T1|'+String(bank).padStart(2,'0')+off((-264+pitch*Math.sin(r))*.49)+off((-276+pitch*Math.cos(r))*.49)+off(-(200-speed)*3.6*.49)+off(-(20000-alt)*.18*.49)+field(speed,4)+field(alt,6)+field(String(yaw).padStart(3,'0')+' '+card,8)+field(clamp(Math.round((s.groundSpeed??s.airspeed)*1.94384),0,999),4)+field(clamp(Math.round(s.verticalSpeed*196.85),-20000,20000),7)+field(Math.round(s.throttle*100),4)+field(String(track).padStart(3,'0'),4);
}
