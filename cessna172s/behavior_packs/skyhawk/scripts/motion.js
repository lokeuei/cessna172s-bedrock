// Native physics resolves collisions. Aerodynamics owns the commanded velocity;
// never infer a collision from delayed/quantised entity position samples.
export function synchronizeMotion(state,nativeVelocity,onGround) {
  state.blockedTicks??={x:0,y:0,z:0};
  if(onGround&&state.velocity.y<0)state.velocity.y=0;
  if(!state.commandedVelocity)return;
  for(const axis of ['x','y','z']) {
    const commanded=state.commandedVelocity[axis],actual=nativeVelocity[axis];
    // Ordinary air/ground drag is not a collision. Require two native velocity
    // stops after meaningful commands before discarding momentum on that axis.
    const stopped=Math.abs(commanded)>.015&&Math.abs(actual)<.0001;
    state.blockedTicks[axis]=stopped?state.blockedTicks[axis]+1:0;
    if(state.blockedTicks[axis]>=2)state.velocity[axis]=0;
  }
}
export function applyFlightMotion(plane,state,onGround) {
  const native=plane.getVelocity();
  const desired={x:state.velocity.x/20,y:state.velocity.y/20,z:state.velocity.z/20};
  if(onGround&&desired.y<=0)desired.y=-.015;
  const impulse={x:desired.x-native.x,y:desired.y-native.y,z:desired.z-native.z};
  if(Math.hypot(impulse.x,impulse.y,impulse.z)>.00001)plane.applyImpulse(impulse);
  state.commandedVelocity=desired;
}
