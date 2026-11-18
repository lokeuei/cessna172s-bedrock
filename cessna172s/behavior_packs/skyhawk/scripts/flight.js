// Deterministic 20 Hz point-mass aerodynamics. SI units internally, blocks = metres.
// This is a C172-inspired game model, not validated aircraft performance data.
export const DT = 0.05;
export const AIRCRAFT = Object.freeze({ mass: 1100, wingArea: 16.2, gravity: 9.81,
  enginePower: 134000, propEfficiency: 0.76, maxThrust: 2650, maxSpeed: 90 });
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const wrap = x => ((x + 180) % 360 + 360) % 360 - 180;
const rad = x => x * Math.PI / 180;
const deg = x => x * 180 / Math.PI;
const dot = (a,b) => a.x*b.x+a.y*b.y+a.z*b.z;
const mul = (a,n) => ({x:a.x*n,y:a.y*n,z:a.z*n});
const add = (a,b) => ({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
export const length = v => Math.hypot(v.x,v.y,v.z);
const unit = v => mul(v,1/Math.max(length(v),0.0001));

function eulerAxes(s) {
  const p=rad(s.pitch), y=rad(s.yaw), b=rad(s.bank);
  const forward={x:-Math.sin(y)*Math.cos(p),y:Math.sin(p),z:Math.cos(y)*Math.cos(p)};
  const levelRight={x:-Math.cos(y),y:0,z:-Math.sin(y)};
  const levelUp={x:Math.sin(y)*Math.sin(p),y:Math.cos(p),z:-Math.cos(y)*Math.sin(p)};
  return {forward,right:add(mul(levelRight,Math.cos(b)),mul(levelUp,-Math.sin(b))),
    up:add(mul(levelUp,Math.cos(b)),mul(levelRight,Math.sin(b)))};
}
export function axes(s){return s.attitude??eulerAxes(s);}
function rotate(v,axis,angle){
 const c=Math.cos(angle),sn=Math.sin(angle);
 return add(add(mul(v,c),mul(cross(axis,v),sn)),mul(axis,dot(axis,v)*(1-c)));
}
function rotateFrame(frame,axis,angle){
 return {forward:rotate(frame.forward,axis,angle),right:rotate(frame.right,axis,angle),up:rotate(frame.up,axis,angle)};
}
function publishAngles(s){
 const f=unit(s.attitude.forward),right=unit(cross(f,s.attitude.up)),up=unit(cross(right,f));
 s.attitude={forward:f,right,up};
 const horizontal=Math.hypot(f.x,f.z);
 if(horizontal>1e-7)s.yaw=wrap(deg(Math.atan2(-f.x,f.z)));
 s.pitch=deg(Math.asin(clamp(f.y,-1,1)));
 const level=eulerAxes({pitch:s.pitch,yaw:s.yaw,bank:0});
 s.bank=wrap(deg(Math.atan2(dot(up,level.right),dot(up,level.up))));
 s.lastEuler={pitch:s.pitch,bank:s.bank,yaw:s.yaw};
}

export function createFlightState(yaw=0,velocity={x:0,y:0,z:0}) {
  return {yaw,pitch:0,bank:0,pitchRate:0,rollRate:0,yawRate:0,velocity:{...velocity},
    throttle:0,airspeed:length(velocity),aoa:0,stall:false,verticalSpeed:velocity.y,
    lift:0,loadFactor:0,groundSpeed:0,onGround:true,braking:false,pitchTravel:0};
}

export function stepFlight(s,controls,environment={}) {
  const dt=DT, c=AIRCRAFT;
  const grounded=!!environment.onGround;
  const speed=length(s.velocity);
  // Store a full orthonormal body frame, not a clamped Euler pitch. This avoids
  // gimbal lock and keeps elevator/aileron/rudder relative to the aircraft.
  if(!s.attitude||!s.lastEuler||['pitch','bank','yaw'].some(k=>Math.abs(wrap(s[k]-s.lastEuler[k]))>1e-5))s.attitude=eulerAxes(s);
  const authority=clamp((speed-5)/30,0.06,1);
  const elevator=clamp(controls.pitch??0,-1,1); // positive = pull / nose up
  const aileron=clamp(controls.roll??0,-1,1); // positive = right bank
  const rudder=clamp(controls.rudder??0,-1,1);
  s.throttle=clamp(controls.throttle??s.throttle,0,1);
  s.braking=!!controls.brake;

  // Control input sets angular rate, not attitude. Releasing it does not auto-level.
  const pitchTarget=elevator*24*authority;
  const rollTarget=aileron*48*authority;
  s.pitchRate+=(pitchTarget-s.pitchRate)*(1-Math.exp(-3*dt));
  s.rollRate+=(rollTarget-s.rollRate)*(1-Math.exp(-4*dt));
  if(grounded) {
    s.bank*=Math.exp(-8*dt); s.rollRate=0;
    // Main wheels hold the plane level until rotation speed; W lowers the nose.
    if(speed<26) {s.pitch*=Math.exp(-5*dt);s.pitchRate=0;}
    else {s.pitch=clamp(s.pitch+s.pitchRate*dt,0,13);}
    s.yawRate+=(rudder*28*clamp(speed/8,0,1)-s.yawRate)*(1-Math.exp(-2.5*dt));
    s.yaw=wrap(s.yaw+s.yawRate*dt);s.attitude=eulerAxes(s);
  } else {
    const sideslip=deg(Math.asin(clamp(dot(unit(s.velocity),s.attitude.right),-1,1)));
    // The vertical tail weathercocks into the relative wind as banked lift
    // changes the flight path. Rudder rotates around the aircraft's own up axis.
    const targetYaw=rudder*14*authority+clamp(sideslip,-25,25)*1.25;
    s.yawRate+=(targetYaw-s.yawRate)*(1-Math.exp(-2.5*dt));
    s.attitude=rotateFrame(s.attitude,s.attitude.right,rad(s.pitchRate*dt));
    s.attitude=rotateFrame(s.attitude,s.attitude.forward,rad(s.rollRate*dt));
    s.attitude=rotateFrame(s.attitude,s.attitude.up,rad(-s.yawRate*dt));
    s.pitchTravel+=s.pitchRate*dt;
  }
  publishAngles(s);
  const {forward,right,up}=axes(s);
  const v=s.velocity, vhat=unit(v);
  const forwardSpeed=dot(v,forward), verticalAir=dot(v,up), sideSpeed=dot(v,right);
  const aoa=deg(Math.atan2(-verticalAir,Math.max(1,forwardSpeed)));
  s.aoa=aoa;
  const density=1.225*Math.exp(-Math.max(-300,environment.altitude??0)/8500);
  const q=0.5*density*speed*speed;
  const absAoa=Math.abs(aoa);
  let cl=clamp(0.24+5.0*rad(aoa),-1.35,1.55);
  const stalled=absAoa>16 && speed>8;
  if(stalled) cl*=clamp(1-(absAoa-16)/24,0.2,1);
  // Profile + induced + separated-flow drag; high AoA costs energy.
  const cd=0.032+0.055*cl*cl+(stalled?0.15*clamp((absAoa-16)/25,0,1):0);
  const lift=q*c.wingArea*cl;
  const liftDirection=unit(add(up,mul(vhat,-dot(up,vhat))));
  const thrust=Math.min(c.maxThrust,c.propEfficiency*c.enginePower/Math.max(speed,25))*s.throttle;
  let force=add(mul(forward,thrust),mul(liftDirection,lift));
  force=add(force,mul(vhat,-q*c.wingArea*cd));
  // Vertical-tail side force damps sideslip progressively; no instantaneous velocity snapping.
  force=add(force,mul(right,-sideSpeed*c.mass*(grounded?3.5:0.3)));
  force.y-=c.mass*c.gravity;
  if(grounded) {
    const rolling=(controls.brake?0.45:0.025)*c.mass*c.gravity;
    const groundDir=unit({x:v.x,y:0,z:v.z});
    // Clamp rolling resistance so it can never pull a stopped aircraft backwards.
    const friction=Math.min(rolling,Math.hypot(v.x,v.z)*c.mass/dt);
    force=add(force,mul(groundDir,-friction));
    if(force.y<0) {force.y=0;v.y=0;}
  }
  s.velocity=add(v,mul(force,dt/c.mass));
  if(grounded && length(s.velocity)<0.04 && thrust<1) s.velocity={x:0,y:0,z:0};
  const newSpeed=length(s.velocity);
  if(newSpeed>c.maxSpeed) s.velocity=mul(s.velocity,c.maxSpeed/newSpeed);
  // Loss of lift also produces a nose drop; reducing AoA allows recovery.
  if(stalled&&!grounded) s.pitchRate-=Math.min(12,(absAoa-16)*0.5)*dt;
  s.stall=stalled; s.lift=lift; s.loadFactor=lift/(c.mass*c.gravity);
  s.airspeed=length(s.velocity); s.groundSpeed=Math.hypot(s.velocity.x,s.velocity.z);
  s.verticalSpeed=s.velocity.y; s.onGround=grounded;
  return s;
}

