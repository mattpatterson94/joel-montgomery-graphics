import {RIM_Y,RIM_HEIGHT,clamp} from './physics.mjs?v=4';
export function netShape(reaction,now,t){
 if(!reaction)return {shift:0,stretch:0,bulge:0,rim:0};
 const elapsed=(now-reaction.time)/1000,decay=Math.exp(-elapsed*4);
 if(elapsed>1.6)return {shift:0,stretch:0,bulge:0,rim:0};
 if(reaction.rim){return {shift:Math.sin(elapsed*24)*2.5*decay*t,stretch:Math.sin(elapsed*19)*1.5*decay*t,bulge:0,rim:Math.sin(elapsed*33)*.8*decay};}
 const progress=clamp((RIM_HEIGHT-reaction.ball.h)/120,0,1.4);
 const wave=Math.sin(Math.min(elapsed/.42,1)*Math.PI),swish=reaction.ball.entry.swish;
 const offset=clamp(reaction.ball.entry.x*.13,-5,5);
 return {shift:(offset*wave+Math.sin(elapsed*16)*decay*(swish?1:3))*t*t,
   stretch:wave*(swish?11:7)*t*t,
   bulge:Math.exp(-Math.pow((t-progress)/.28,2))*Math.sin(Math.min(progress,1)*Math.PI)*6*t,
   rim:0};
}
export function drawNet(ctx,x,now,front,reaction){
 const rows=4,segments=8;
 function point(t,angle){const shape=netShape(reaction,now,t);const radius=49-21*t+shape.bulge;return [x+radius*Math.cos(angle)+shape.shift,RIM_Y+70*t+(13-6*t)*Math.sin(angle)+shape.stretch+shape.rim];}
 ctx.save();ctx.lineWidth=front?1.35:1.1;ctx.strokeStyle=front?'#e5e3df':'#797e88';
 // Diamond mesh. Top nodes stay on the rim while a travelling bulge and lower
 // collar stretch follow the ball, followed by a small damped return motion.
 for(let row=0;row<rows;row++)for(let i=0;i<=segments;i++){
   const angle=(front?0:Math.PI)+(i+(row%2)*.5)*Math.PI/segments;
   const from=point(row/rows,angle);
   for(const direction of [-1,1]){
     const to=point((row+1)/rows,angle+direction*Math.PI/segments*.5);
     ctx.beginPath();ctx.moveTo(...from);ctx.lineTo(...to);ctx.stroke();
   }
 }
 const lower=netShape(reaction,now,1);
 ctx.beginPath();ctx.ellipse(x+lower.shift,RIM_Y+70+lower.stretch,28+lower.bulge,7,0,front?0:Math.PI,front?Math.PI:2*Math.PI);ctx.strokeStyle='#3270b6';ctx.lineWidth=2;ctx.stroke();
 const rim=netShape(reaction,now,0).rim;
 ctx.beginPath();ctx.ellipse(x,RIM_Y+rim,49,13,0,front?0:Math.PI,front?Math.PI:2*Math.PI);ctx.strokeStyle=front?'#ef8035':'#a84a22';ctx.lineWidth=6;ctx.stroke();ctx.restore();
}
