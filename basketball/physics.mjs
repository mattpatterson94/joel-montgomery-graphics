// Depth is 0 at the player and 1 at the hoops. Horizontal position and height
// use world units; multiply depth by 700 for collision distances and velocities.
export const HOOPS = [216, 584];
export const RIM_Y = 366;
export const RIM_HEIGHT = (470 - RIM_Y) / .6;
export const GRAVITY = 1800;
export const BALL_RADIUS = 40;
const RIM_RADIUS = 82, CONTACT_RADIUS = BALL_RADIUS + 4;
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const remaining = (deadline, now) => Math.max(0, (deadline - now) / 1000);
export const pointsAt = seconds => seconds <= 0 ? 0 : seconds <= 10 ? 3 : seconds <= 20 ? 2 : 1;
export function chargePower(milliseconds) {
  const phase = Math.max(0, milliseconds) / 900 % 2;
  return 210 + 140 * (phase <= 1 ? phase : 2 - phase);
}
export function rackX(lane, shot) {
  const offsets = [0, 58, -46, 78, -66, 30, -20];
  return HOOPS[lane] + offsets[shot % offsets.length] * (lane ? -1 : 1);
}
export function project(x, h, z) {
  const scale = 1 / (1 + Math.max(0, z) * 2 / 3);
  return {x:400+(x-400)*scale, y:760-290*z-h*scale, radius:BALL_RADIUS*scale, scale};
}
export const hoopWorldX = lane => 400+(HOOPS[lane]-400)/.6;
export function makeBall(lane, aim, power, round, origin=HOOPS[lane]) {
  // No automatic aiming: straight ahead is a real miss from the starting rack.
  return {lane, x:origin, h:76, z:0, vx:clamp(aim*1.5,-600,600),
    vh:clamp(power*3.85173,500,1380), vz:1/1.1, age:0, scored:false,
    round, bounces:0, rimHits:0, bankHits:0, grounded:false, landed:false,
    spin:[.45,.2,-.65], omega:[-6,1.2,-aim*.02], events:[]};
}
export function stepBall(ball, dt) {
  let basket=-1;
  ball.events.length=0;
  const count=Math.ceil(dt/(1/240)), step=dt/count;
  for(let i=0;i<count;i++) {
    const oldH=ball.h, oldX=ball.x, oldZ=ball.z;
    ball.x+=ball.vx*step; ball.z+=ball.vz*step; ball.age+=step;
    for(let axis=0;axis<3;axis++)ball.spin[axis]+=ball.omega[axis]*step;
    if(ball.scored&&ball.h>RIM_HEIGHT-120&&ball.vh<0)ball.vh*=Math.exp(-3*step);
    if(!ball.grounded) {ball.h+=ball.vh*step-GRAVITY*step*step/2; ball.vh-=GRAVITY*step;}
    // Sphere against the board, accounting for the ball's radius and board width.
    const boardLimit=1.16-BALL_RADIUS/700;
    const onBoard=project(ball.x,ball.h,1.16);
    if(ball.z>boardLimit && ball.vz>0 && ball.h>55 && ball.h<700 && onBoard.x>36 && onBoard.x<764) {
      ball.events.push({type:'board',strength:clamp(Math.abs(ball.vz),.2,1)});
      ball.z=boardLimit; ball.vz*=-.68; ball.vx*=.85; ball.bankHits++;
      ball.omega[0]*=-.6;ball.omega[1]*=.8;
    }
    if(!ball.scored && !ball.landed) {
      // Score once, only when the centre descends inside the actual ring opening.
      if(oldH>RIM_HEIGHT && ball.h<=RIM_HEIGHT && ball.vh<0) {
        const t=(oldH-RIM_HEIGHT)/(oldH-ball.h), x=oldX+(ball.x-oldX)*t, z=oldZ+(ball.z-oldZ)*t;
        for(let lane=0;lane<2;lane++) {
          if(Math.hypot(x-hoopWorldX(lane),(z-1)*700)<RIM_RADIUS-CONTACT_RADIUS) {
            ball.entry={x:x-hoopWorldX(lane),speed:-ball.vh,swish:ball.rimHits===0&&ball.bankHits===0,age:ball.age};
            ball.scored=true; basket=lane; ball.z=1; ball.vz=0;ball.vh*=.55;
            ball.x=hoopWorldX(lane)+(x-hoopWorldX(lane))*.5; ball.vx*=.15;
            break;
          }
        }
      }
      // Sphere against the ring (a thin torus), using its surface normal. This
      // allows side/underside rim hits instead of only bouncing at one flat plane.
      if(!ball.scored && Math.abs(ball.h-RIM_HEIGHT)<CONTACT_RADIUS) {
        for(let lane=0;lane<2;lane++) {
          const dx=ball.x-hoopWorldX(lane), dz=(ball.z-1)*700, radial=Math.hypot(dx,dz);
          if(radial<1)continue;
          const edge=radial-RIM_RADIUS, dh=ball.h-RIM_HEIGHT, distance=Math.hypot(edge,dh);
          if(distance>=CONTACT_RADIUS || distance<.001)continue;
          const nx=dx/radial*edge/distance, nz=dz/radial*edge/distance, nh=dh/distance;
          const penetration=CONTACT_RADIUS-distance+.01;
          ball.x+=nx*penetration; ball.z+=nz*penetration/700; ball.h+=nh*penetration;
          const speed=ball.vx*nx+ball.vz*700*nz+ball.vh*nh;
          if(speed<0) {
            ball.vx-=1.58*speed*nx; ball.vz-=1.58*speed*nz/700; ball.vh-=1.58*speed*nh;
            if(ball.age-(ball.lastRimHit??-1)>.08){
              ball.rimHits++;ball.lastRimHit=ball.age;
              ball.events.push({type:'rim',strength:clamp(-speed/650,.15,1),lane});
              ball.omega[1]+=nx*speed*.003;ball.omega[2]-=nz*speed*.002;
            }
          }
        }
      }
    }
    if(ball.scored&&!ball.netExited&&ball.h<RIM_HEIGHT-115){ball.netExited=true;ball.events.push({type:'net',strength:.4});}
    if(ball.h<BALL_RADIUS && ball.vh<0) {
      if(-ball.vh>90)ball.events.push({type:'bounce',strength:clamp(-ball.vh/650,.1,1)});
      ball.h=BALL_RADIUS; ball.vh*=-.42; ball.vx*=.65; ball.vz=-.45;
      ball.bounces++; ball.landed=true;ball.omega=[ball.vz*700/BALL_RADIUS,ball.omega[1]*.5,-ball.vx/BALL_RADIUS];
      if(ball.vh<70 || ball.bounces>=4) {ball.vh=0;ball.grounded=true;}
    }
    if(ball.grounded){ball.vx*=Math.exp(-2*step);ball.omega[0]=ball.vz*700/BALL_RADIUS;ball.omega[2]=-ball.vx/BALL_RADIUS;}
    if(ball.z<0){ball.z=0;ball.vz=0;}
  }
  return basket;
}
