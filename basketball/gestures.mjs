import {clamp, makeBall, GRAVITY, SHOT_RATE} from './physics.mjs?v=8';

// Pointer coordinates are expressed in the same 800-unit court space on every
// screen. A short, time-weighted velocity window avoids device/event-rate bias.
export function releaseSpeed(samples, now) {
  if(samples.length<2)return 0;
  const end=samples.at(-1), cutoff=Math.max(samples[0].t,now-140);
  if(now-end.t>=140)return 0;
  let start=samples[0];
  for(let i=1;i<samples.length;i++){
    if(samples[i].t>=cutoff){
      const before=samples[i-1],after=samples[i],fraction=clamp((cutoff-before.t)/Math.max(1,after.t-before.t),0,1);
      start={y:before.y+(after.y-before.y)*fraction,t:cutoff};break;
    }
  }
  return clamp((start.y-end.y)*1000/Math.max(32,now-start.t),0,1800);
}
export function heldPosition(gesture) {
  const dx=gesture.end.x-gesture.start.x, dy=gesture.start.y-gesture.end.y;
  // The ball follows the hand within the return area. Beyond it the elastic
  // tether guides the throw, so a long drag cannot place the ball into the hoop.
  return {x:gesture.origin+clamp(dx*.55,-92,92),h:76+clamp(dy, -24,164)};
}
export function gestureBall(gesture, now, round=-1) {
  const dx=gesture.end.x-gesture.start.x,dy=gesture.start.y-gesture.end.y;
  if(dy<28)return null;
  const release=heldPosition(gesture),speed=releaseSpeed(gesture.samples,now);
  const power=clamp(218+dy*.26+clamp((speed-700)*.012,-6,14),210,352);
  const ball=makeBall(gesture.lane,0,power,round,release.x);
  ball.h=release.h;
  // Projection correction keeps a vertical screen gesture vertical in view.
  // This uses the camera only, never a hoop position or an aim snap.
  ball.vx=(release.x-400)*(2/3)*ball.vz+clamp(dx*1.05,-500,500)*SHOT_RATE;
  ball.vh-=(release.h-76)*ball.vz;
  ball.spin=[.45-dy*.008,.2+dx*.01,-.65];
  ball.omega=[-5.5-speed/550,ball.vx*.007, -dx*.018];
  return ball;
}
export function previewArc(ball) {
  if(!ball)return [];
  // Only the first portion: the guide communicates launch direction/arc,
  // leaving the actual landing to the player's judgement.
  const points=[];
  for(let t=.035;t<=.62/SHOT_RATE;t+=.055/SHOT_RATE)points.push({x:ball.x+ball.vx*t,h:ball.h+ball.vh*t-GRAVITY*t*t/2,z:ball.z+ball.vz*t});
  return points;
}
