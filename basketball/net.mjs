import {RIM_Y,RIM_HEIGHT,RIM_RADIUS,hoopWorldX,clamp} from './physics.mjs?v=13';
export function netShape(reaction,now,t){
 if(!reaction)return {shift:0,stretch:0,bulge:0,rim:0};
 const elapsed=Math.max(0,(now-reaction.time)/1000),decay=Math.exp(-elapsed*3.4);
 if(elapsed>=2)return {shift:0,stretch:0,bulge:0,rim:0};
 if(reaction.rim){return {shift:Math.sin(elapsed*22)*4.8*decay*t*t,stretch:Math.sin(elapsed*18)*3.2*decay*t,bulge:Math.sin(elapsed*17)*1.6*decay*t,rim:Math.sin(elapsed*33)*.8*decay};}
 const progress=reaction.ball.netExited?1.5:clamp((RIM_HEIGHT-reaction.ball.h)/150,0,1.5);
 const entry=reaction.ball.entry??reaction.entry;
 const speed=clamp((entry.speed??1100)/1100,.7,1.25),swish=entry.swish;
 // Ball-driven expansion travels down the mesh, then the bottom collar snaps
 // back and swings. Anchors stay fixed and the rim does not stretch.
 const pull=Math.sin(Math.min(elapsed/.34,1)*Math.PI);
 const after=Math.max(0,elapsed-.24),recoil=Math.sin(after*19)*Math.exp(-after*5);
 const offset=clamp(entry.x*.24,-10,10);
 const lane=reaction.ball.scoredLane??entry.lane;
 const sideways=lane!==undefined&&Number.isFinite(reaction.ball.x)?clamp(reaction.ball.x-hoopWorldX(lane),-80,80)*.25:0;
 return {shift:(offset*pull+sideways*pull*.6+Math.sin(elapsed*13)*decay*(swish?2.5:6))*t*t,
   stretch:(pull*21*speed-recoil*7)*t*t,
   bulge:(Math.exp(-Math.pow((t-progress)/.25,2))*Math.sin(Math.min(progress,1)*Math.PI)*13*speed-recoil*3*t)*t,
   rim:0};
}
export function drawNet(ctx,x,now,front,reaction){
 const rows=5,segments=6,rimRadius=RIM_RADIUS*.6;
 function point(t,angle){
  const shape=netShape(reaction,now,t),radius=rimRadius-25*Math.pow(t,.8)+shape.bulge;
  return [x+radius*Math.cos(angle)+shape.shift,RIM_Y+94*t+(16-9*t)*Math.sin(angle)+shape.stretch+shape.rim];
 }
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
 // Twelve tied loops at the rim, loose knotted diamonds, then blue lower cords.
 // Draw only this half of the mesh so a ball can pass between the two surfaces.
 for(let row=0;row<rows;row++)for(let i=0;i<=segments;i++){
  const angle=(front?0:Math.PI)+(i+(row%2)*.5)*Math.PI/segments;
  if(angle>(front?Math.PI:2*Math.PI))continue;
  const from=point(row/rows,angle);
  for(const direction of [-1,1]){
   const nextAngle=angle+direction*Math.PI/segments*.5;
   if(nextAngle<(front?0:Math.PI)||nextAngle>(front?Math.PI:2*Math.PI))continue;
   const to=point((row+1)/rows,nextAngle),slack=1.8+row*.5;
   ctx.beginPath();ctx.moveTo(...from);ctx.quadraticCurveTo((from[0]+to[0])/2,(from[1]+to[1])/2+slack,...to);
   ctx.strokeStyle='#0b122455';ctx.lineWidth=front?3.4:2.4;ctx.stroke();
   ctx.strokeStyle=row>=3?(front?'#438bc9':'#285581'):(front?'#eee8d8':'#9ca5a3');ctx.lineWidth=front?1.9:1.3;ctx.stroke();
  }
  if(row>0){ctx.beginPath();ctx.arc(...from,front?1.6:1,0,Math.PI*2);ctx.fillStyle=row>=3?'#5997c7':front?'#f1edde':'#a0aaa5';ctx.fill();}
 }
 // Bottom loops hang freely instead of forming a rigid horizontal collar.
 for(let i=0;i<segments;i++){
  const angle=(front?0:Math.PI)+i*Math.PI/segments,from=point(1,angle),to=point(1,angle+Math.PI/segments);
  ctx.beginPath();ctx.moveTo(...from);ctx.quadraticCurveTo((from[0]+to[0])/2,(from[1]+to[1])/2+6,...to);ctx.strokeStyle=front?'#397cbd':'#264f7b';ctx.lineWidth=front?2:1.3;ctx.stroke();
 }
 const rim=netShape(reaction,now,0).rim;
 ctx.beginPath();ctx.ellipse(x,RIM_Y+rim,rimRadius,16,0,front?0:Math.PI,front?Math.PI:2*Math.PI);ctx.strokeStyle=front?'#db641d':'#8d391b';ctx.lineWidth=6;ctx.stroke();
 ctx.beginPath();ctx.ellipse(x,RIM_Y+rim-1,rimRadius,16,0,front?0:Math.PI,front?Math.PI:2*Math.PI);ctx.strokeStyle=front?'#ffad57':'#ce6e28';ctx.lineWidth=1.6;ctx.stroke();
 for(let i=0;i<=segments;i++){
  const a=(front?0:Math.PI)+i*Math.PI/segments,p=point(0,a);
  ctx.beginPath();ctx.moveTo(p[0]-1.6,p[1]);ctx.quadraticCurveTo(p[0]-2,p[1]+6,p[0]+1.6,p[1]+5);ctx.strokeStyle=front?'#e2dccc':'#959f9d';ctx.lineWidth=1.6;ctx.stroke();
 }
 ctx.restore();
}
