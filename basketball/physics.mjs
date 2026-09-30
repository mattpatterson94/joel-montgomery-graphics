// Depth is 0 at the player, 1 at the hoops. Heights and horizontal distances
// are world units; projection is shared by balls, rims, shadows and aim guides.
export const HOOPS = [216, 584];
export const RIM_Y = 366;
export const RIM_HEIGHT = (470 - RIM_Y) / .6;
export const GRAVITY = 1800;
export const BALL_RADIUS = 40;
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export function remaining(deadline, now) { return Math.max(0, (deadline - now) / 1000); }
export function pointsAt(seconds) { return seconds <= 0 ? 0 : seconds <= 10 ? 3 : seconds <= 20 ? 2 : 1; }
export function project(x, h, z) {
  const scale = 1 / (1 + Math.max(0, z) * 2 / 3);
  return {x:400+(x-400)*scale, y:760-290*z-h*scale, radius:BALL_RADIUS*scale, scale};
}
export function hoopWorldX(lane) { return 400+(HOOPS[lane]-400)/.6; }
export function makeBall(lane, dx, dy, round) {
  const targetX=hoopWorldX(lane);
  return {x:HOOPS[lane], h:76, z:0, vx:(targetX-HOOPS[lane])/1.1+clamp(dx*1.5,-600,600),
    vh:clamp(dy*3.85173,500,1380), vz:1/1.1, age:0, scored:false, round, bounces:0};
}
export function stepBall(ball, dt) {
  // Small substeps keep rim/backboard collisions consistent at different refresh rates.
  let basket=-1;
  const count=Math.ceil(dt/(1/240)), step=dt/count;
  for(let i=0;i<count;i++){
    const oldH=ball.h,oldX=ball.x,oldZ=ball.z;
    ball.x+=ball.vx*step;ball.z+=ball.vz*step;
    ball.h+=ball.vh*step-GRAVITY*step*step/2;ball.vh-=GRAVITY*step;ball.age+=step;
    // Board is behind the hoop; a high shot can bank off it and drop back in.
    if(ball.z>1.16 && ball.vz>0 && ball.h>55 && ball.h<650){
      ball.z=1.16;ball.vz*=-.65;ball.vx*=.8;
    }
    if(!ball.scored && oldH>RIM_HEIGHT && ball.h<=RIM_HEIGHT && ball.vh<0){
      const t=(oldH-RIM_HEIGHT)/(oldH-ball.h),x=oldX+(ball.x-oldX)*t,z=oldZ+(ball.z-oldZ)*t;
      for(let lane=0;lane<2;lane++){
        const distance=Math.hypot(x-hoopWorldX(lane),(z-1)*700);
        if(distance<44){
          ball.scored=true;basket=lane;
          // The net catches forward motion; the ball stays full-sized as it falls through.
          ball.z=1;ball.x=hoopWorldX(lane)+(x-hoopWorldX(lane))*.4;ball.vz=0;ball.vx*=.15;
          break;
        }
        if(distance>=44 && distance<112){
          ball.h=RIM_HEIGHT+2;ball.vh=Math.abs(ball.vh)*.48;
          ball.vx+=(x-hoopWorldX(lane))*2;ball.vz+=(z-1)*3;
          break;
        }
      }
    }
    if(ball.h<BALL_RADIUS && ball.vh<0){
      ball.h=BALL_RADIUS;ball.vh*=-.48;ball.vx*=.65;ball.vz=-.45;ball.bounces++;
      if(ball.bounces>3)ball.vh=0;
    }
    if(ball.z<0){ball.z=0;ball.vz=0;}
  }
  return basket;
}
