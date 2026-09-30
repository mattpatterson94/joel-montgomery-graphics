import {RIM_Y} from './physics.mjs?v=8';
// A hinged paddle reaches into the basket from its back edge. It swings down
// with the ball, then the spring returns it with a small damped overshoot.
export function sensorAngle(reaction,now,reducedMotion=false){
 if(!reaction)return 0;
 const t=(now-reaction.time)/1000;
 if(t<0||t>1.15)return 0;
 if(reducedMotion)return t<.16?.72:0;
 if(t<.075)return Math.sin(t/.075*Math.PI/2)*1.2;
 const elapsed=t-.075;
 return 1.2*Math.exp(-elapsed*5.5)*Math.cos(elapsed*14);
}
export function drawSensorArm(ctx,x,now,reaction,reducedMotion){
 const angle=sensorAngle(reaction,now,reducedMotion),pivotY=RIM_Y+25;
 const extension=27*Math.cos(angle),drop=60*Math.sin(angle);
 ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
 ctx.fillStyle='#111214';ctx.strokeStyle='#46464a';ctx.lineWidth=1.5;
 ctx.beginPath();ctx.roundRect(x-12,pivotY-9,24,18,4);ctx.fill();ctx.stroke();
 // Broad black tongue, tapered at the hinge and rounded at the tip.
 ctx.beginPath();ctx.moveTo(x-6,pivotY);ctx.lineTo(x+6,pivotY);
 ctx.lineTo(x+12,pivotY+extension+drop);ctx.quadraticCurveTo(x,pivotY+extension+drop+6,x-12,pivotY+extension+drop);ctx.closePath();
 ctx.fillStyle='#242529';ctx.fill();ctx.strokeStyle='#77767a';ctx.stroke();
 ctx.beginPath();ctx.moveTo(x-9,pivotY);ctx.lineTo(x+9,pivotY);ctx.strokeStyle='#919094';ctx.lineWidth=3;ctx.stroke();
 ctx.restore();
}
