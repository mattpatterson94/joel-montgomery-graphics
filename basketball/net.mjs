import {RIM_Y,RIM_HEIGHT,clamp} from './physics.mjs?v=11';
export function netShape(reaction,now,t){
 if(!reaction)return {shift:0,stretch:0,bulge:0,rim:0};
 const elapsed=Math.max(0,(now-reaction.time)/1000),decay=Math.exp(-elapsed*3.4);
 if(elapsed>=2)return {shift:0,stretch:0,bulge:0,rim:0};
 if(reaction.rim){return {shift:Math.sin(elapsed*22)*4.8*decay*t*t,stretch:Math.sin(elapsed*18)*3.2*decay*t,bulge:Math.sin(elapsed*17)*1.6*decay*t,rim:Math.sin(elapsed*33)*.8*decay};}
 const progress=clamp((RIM_HEIGHT-reaction.ball.h)/125,0,1.5);
 const speed=clamp((reaction.ball.entry.speed??1100)/1100,.7,1.25),swish=reaction.ball.entry.swish;
 // Ball-driven expansion travels down the mesh, then the bottom collar snaps
 // back and swings. Anchors stay fixed and the rim does not stretch.
 const pull=Math.sin(Math.min(elapsed/.34,1)*Math.PI);
 const after=Math.max(0,elapsed-.24),recoil=Math.sin(after*19)*Math.exp(-after*5);
 const offset=clamp(reaction.ball.entry.x*.24,-10,10);
 return {shift:(offset*pull+Math.sin(elapsed*13)*decay*(swish?2.5:6))*t*t,
   stretch:(pull*21*speed-recoil*7)*t*t,
   bulge:(Math.exp(-Math.pow((t-progress)/.25,2))*Math.sin(Math.min(progress,1)*Math.PI)*13*speed-recoil*3*t)*t,
   rim:0};
}
export function drawNet(ctx,x,now,front,reaction){
 const rows=5,segments=9;
 function point(t,angle){const shape=netShape(reaction,now,t);const radius=64-25*t+shape.bulge;return [x+radius*Math.cos(angle)+shape.shift,RIM_Y+78*t+(16-7*t)*Math.sin(angle)+shape.stretch+shape.rim];}
 ctx.save();ctx.lineWidth=front?1.65:1.2;ctx.strokeStyle=front?'#e5e3df':'#797e88';
 // Diamond mesh. Top nodes stay on the rim while a travelling bulge and lower
 // collar stretch follow the ball, followed by a small damped return motion.
 for(let row=0;row<rows;row++)for(let i=0;i<=segments;i++){
   const angle=(front?0:Math.PI)+(i+(row%2)*.5)*Math.PI/segments;
   const from=point(row/rows,angle);
   for(const direction of [-1,1]){
     const to=point((row+1)/rows,angle+direction*Math.PI/segments*.5);
     ctx.beginPath();ctx.moveTo(...from);ctx.quadraticCurveTo((from[0]+to[0])/2,(from[1]+to[1])/2+1.1,...to);ctx.stroke();
   }
 }
 const lower=netShape(reaction,now,1);
 ctx.beginPath();ctx.ellipse(x+lower.shift,RIM_Y+78+lower.stretch,39+lower.bulge,9,0,front?0:Math.PI,front?Math.PI:2*Math.PI);ctx.strokeStyle='#3270b6';ctx.lineWidth=2;ctx.stroke();
 const rim=netShape(reaction,now,0).rim;
 ctx.beginPath();ctx.ellipse(x,RIM_Y+rim,64,16,0,front?0:Math.PI,front?Math.PI:2*Math.PI);ctx.strokeStyle=front?'#ef8035':'#a84a22';ctx.lineWidth=6;ctx.stroke();ctx.restore();
}
