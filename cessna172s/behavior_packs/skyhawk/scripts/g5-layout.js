// Shared encoder/renderer ranges: one selected texture per instrument layer.
export const G5={speedMax:200,altMin:-1000,altMax:20000,altStep:20,attitudeStep:15};
export function g5Values(s,l){
 const limit=(v,a,b)=>Math.max(a,Math.min(b,v));
 return {speed:limit(Math.round(s.airspeed*1.94384),0,G5.speedMax),
 altitude:limit(Math.round(l.y*3.28084/G5.altStep)*G5.altStep,G5.altMin,G5.altMax),
 pitch:limit(Math.round((s.pitch+90)/G5.attitudeStep),0,12),bank:((Math.round((s.bank+180)/G5.attitudeStep)%24)+24)%24,
 heading:String(Math.round(((s.yaw+180)%360+360)%360)%360).padStart(3,'0'),
 power:limit(Math.round(s.throttle*10),0,10),
 vsi:limit(Math.round(s.verticalSpeed*196.85/100),-60,60),
 ground:String(limit(Math.round((s.groundSpeed??s.airspeed)*1.94384),0,999)).padStart(3,'0')};
}
