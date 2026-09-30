import {HOOPS, RIM_Y, clamp, remaining, pointsAt, makeBall, stepBall, project} from './physics.mjs';
const canvas = document.querySelector('#court'), ctx = canvas.getContext('2d');
const timer = document.querySelector('#timer'), scoreEls = [document.querySelector('#p1'),document.querySelector('#p2')];
const phase = document.querySelector('#phase'), multiplier = document.querySelector('#multiplier');
const start = document.querySelector('#start'), message = document.querySelector('#message');
let balls = [], flashes = [], scores = [0,0], deadline = 0, running = false, round = 0, last = performance.now();
const drags = new Map(), keys = new Map(), cooldown = [-Infinity,-Infinity];
const board = document.createElement('canvas'); board.width = 800; board.height = 800;
const b = board.getContext('2d');
function path(c, coords, fill, stroke, width=1) {c.beginPath();coords.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));if(fill){c.closePath();c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function ellipse(c,x,y,rx,ry,fill,stroke,width=1){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function ball(c,x,y,r,rotation=0,pink=false){
 c.save();c.translate(x,y);c.rotate(rotation);c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.clip();
 c.fillStyle=pink?'#ee187d':'#eee9db';c.fillRect(-r,-r,r*2,r*2);
 path(c,[[-r,-r],[r,-r],[r,r*.15],[-r,-r*.3]],pink?'#f52a8b':'#d73542');
 path(c,[[-r,-r*.3],[r,r*.15],[r,r],[-r,r]],pink?'#d50c65':'#13517f');
 // Curved cream panel and dark seams, like the machine's tricolour balls.
 c.beginPath();c.moveTo(-r*.55,-r);c.bezierCurveTo(-r*.6,-r*.1,r*.4,r*.2,r*.6,r);c.lineTo(r,r);c.bezierCurveTo(r*.6,0,r*.1,-r*.4,r*.35,-r);c.closePath();c.fillStyle=pink?'#f12786':'#f2eddf';c.fill();c.strokeStyle='#25232c';c.lineWidth=r*.045;c.stroke();
 c.beginPath();c.moveTo(-r,-r*.3);c.bezierCurveTo(-r*.2,-r*.15,r*.35,r*.45,r,r*.15);c.stroke();
 const shine=c.createRadialGradient(-r*.35,-r*.5,0,0,0,r*1.15);shine.addColorStop(0,'#ffffff28');shine.addColorStop(.65,'#00000000');shine.addColorStop(1,'#00000077');c.fillStyle=shine;c.fillRect(-r,-r,r*2,r*2);c.restore();ellipse(c,x,y,r,r,null,'#16151b',1.5);
}
const artwork = new Image();
artwork.src = new URL('./backboard-reference.png', import.meta.url).href;
function backboard(){
 b.clearRect(0,0,800,800);
 // Display the actual left-hand artwork from the supplied reference at its native
 // aspect ratio. Clip the white corners, without redrawing any of the print design.
 if(artwork.complete && artwork.naturalWidth){
  b.save();b.beginPath();b.roundRect(36,24,728,432,[65,65,0,0]);b.clip();
  const sourceScale=artwork.naturalWidth/1920;
  b.drawImage(artwork,155*sourceScale,213*sourceScale,746*sourceScale,443*sourceScale,36,24,728,432);b.restore();
 }
 const ramp=b.createLinearGradient(0,456,0,780);ramp.addColorStop(0,'#15161a');ramp.addColorStop(1,'#303034');
 path(b,[[47,456],[753,456],[774,773],[26,773]],ramp);
 for(const x of HOOPS){b.strokeStyle='#ffffff32';b.lineWidth=2;b.beginPath();b.moveTo(x-38,490);b.lineTo(x-72,591);b.quadraticCurveTo(x,655,x+72,591);b.lineTo(x+38,490);b.stroke();ellipse(b,x,580,34,11,null,'#ffffff28',2);}
 for(const flip of [1,-1]){
  b.save();b.translate(flip===1?0:800,0);b.scale(flip,1);
  path(b,[[40,166],[47,456],[26,773],[7,744]],'#ffffff04');
  for(let t=0;t<=1;t+=.09){path(b,[[40+7*t,166+290*t],[7+19*t,744+29*t]],null,'#aaa3ae35');path(b,[[40-33*t,166+578*t],[47-21*t,456+317*t]],null,'#aaa3ae35');}
  path(b,[[40,166],[7,744],[26,773]],null,'#8e8d93',4);b.restore();
 }
 path(b,[[26,775],[774,775]],null,'#aaa7ad',7);
 b.font='700 12px Arial';b.textAlign='center';b.fillStyle='#c1b5c1';b.fillText('P1',HOOPS[0],758);b.fillText('P2',HOOPS[1],758);
}
artwork.addEventListener('load',backboard);
artwork.addEventListener('error',()=>{message.textContent='Backboard image could not load. Reload the page to try again.';});
backboard();
function net(x,now,front){
 const wobble=flashes.some(f=>f.lane===HOOPS.indexOf(x)&&now-f.time<500)?Math.sin(now/40)*4:0;
 ctx.save();ctx.strokeStyle=front?'#dddde2':'#7b8190';ctx.lineWidth=1.5;
 // Crossed cords follow the front/back half of the elliptical rim.
 for(let i=0;i<8;i++){
  const angle=(front?0:Math.PI)+i*Math.PI/7;
  const a=x+49*Math.cos(angle),ay=RIM_Y+13*Math.sin(angle);
  for(const offset of [-.28,.28])path(ctx,[[a,ay],[x+28*Math.cos(angle+offset)+wobble,RIM_Y+70+7*Math.sin(angle+offset)]],null,front?'#dddde2':'#7b8190',1.3);
 }
 ctx.beginPath();ctx.ellipse(x+wobble,RIM_Y+70,28,7,0,front?0:Math.PI,front?Math.PI:2*Math.PI);ctx.strokeStyle='#3270b6';ctx.lineWidth=2;ctx.stroke();
 ctx.beginPath();ctx.ellipse(x,RIM_Y,49,13,0,front?0:Math.PI,front?Math.PI:2*Math.PI);ctx.strokeStyle=front?'#f28338':'#ae4b21';ctx.lineWidth=6;ctx.stroke();ctx.restore();
}
function shoot(lane,dx,dy){const now=performance.now();if(now-cooldown[lane]<350)return;cooldown[lane]=now;balls.push(makeBall(lane,dx,dy,running?round:-1));}
function sync(now){
 const secs=running?remaining(deadline,now):0;
 if(running&&secs===0){running=false;phase.textContent='FULL TIME';message.textContent=`Time! P1: ${scores[0]} · P2: ${scores[1]}. Keep shooting, or start another round.`;start.innerHTML='Play again <span>↗</span>';}
 timer.value=running?String(Math.ceil(secs)).padStart(2,'0'):round?'00':'30';
 if(running){phase.textContent='ROUND LIVE';multiplier.textContent=`${pointsAt(secs)} ${pointsAt(secs)===1?'PT':'PTS'} / BASKET`;}
}
start.addEventListener('click',()=>{round++;scores=[0,0];scoreEls.forEach(el=>el.value='00');balls=[];flashes=[];drags.clear();keys.clear();deadline=performance.now()+30000;running=true;start.innerHTML='Restart round <span>↗</span>';message.textContent='Left hoop scores for P1. Right hoop scores for P2.';sync(performance.now());});
function coords(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*800/r.width,y:(e.clientY-r.top)*800/r.height};}
canvas.addEventListener('pointerdown',e=>{const p=coords(e);if(p.y<530)return;e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);drags.set(e.pointerId,{start:p,end:p,lane:p.x<400?0:1});});
canvas.addEventListener('pointermove',e=>{const d=drags.get(e.pointerId);if(d)d.end=coords(e);});
canvas.addEventListener('pointerup',e=>{const d=drags.get(e.pointerId);if(!d)return;const p=coords(e),dy=d.start.y-p.y;if(dy>15)shoot(d.lane,p.x-d.start.x,dy);drags.delete(e.pointerId);});
for(const type of ['pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>drags.delete(e.pointerId));
window.addEventListener('keydown',e=>{const key=e.key.toLowerCase();if(!['a','l'].includes(key)||e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA/.test(e.target.tagName))return;e.preventDefault();if(!keys.has(key))keys.set(key,performance.now());});
window.addEventListener('keyup',e=>{const key=e.key.toLowerCase(),pressed=keys.get(key);if(pressed===undefined)return;shoot(key==='a'?0:1,0,280+clamp((performance.now()-pressed)/1000,0,1)*90);keys.delete(key);});
window.addEventListener('blur',()=>{keys.clear();drags.clear();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();drags.clear();balls=[];}sync(performance.now());});
function drawBall(item){const p=project(item.x,item.h,item.z);ball(ctx,p.x,p.y,p.radius,item.age*2.8);}
function frame(now){
 const dt=Math.min((now-last)/1000,.05);last=now;sync(now);
 for(const item of balls){
  const lane=stepBall(item,dt);
  if(lane!==-1){let value=0;if(running&&item.round===round){value=pointsAt(remaining(deadline,now));scores[lane]+=value;scoreEls[lane].value=String(scores[lane]).padStart(2,'0');}flashes.push({lane,time:now,label:value?`+${value}`:'NICE!'});}
 }
 balls=balls.filter(item=>item.age<6&&item.x>-400&&item.x<1200);
 ctx.clearRect(0,0,800,800);ctx.drawImage(board,0,0);
 for(const item of balls){const p=project(item.x,0,item.z);ellipse(ctx,p.x,p.y,p.radius*(1+item.h/800),p.radius*.2,'#00000025');}
 for(const d of drags.values()){
  const dy=d.start.y-d.end.y;if(dy<=15)continue;const sample=makeBall(d.lane,d.end.x-d.start.x,dy,-1);
  for(let i=0;i<15;i++){stepBall(sample,.05);const p=project(sample.x,sample.h,sample.z);ellipse(ctx,p.x,p.y,3,3,'#ffffff99');}
 }
 const ordered=[...balls].sort((a,b)=>b.z-a.z);
 // Balls in front of the hoop must cover its rim/net on the way up. Balls
 // arriving at hoop depth sit between its back and front halves on the way down.
 ordered.filter(item=>item.z>1.08).forEach(drawBall);
 HOOPS.forEach(x=>net(x,now,false));
 ordered.filter(item=>item.z>=.92&&item.z<=1.08).forEach(drawBall);
 HOOPS.forEach(x=>net(x,now,true));
 ordered.filter(item=>item.z<.92).forEach(drawBall);
 flashes=flashes.filter(f=>now-f.time<800);for(const f of flashes){ctx.save();ctx.globalAlpha=1-(now-f.time)/800;ctx.font='900 25px Arial';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText(f.label,HOOPS[f.lane],RIM_Y-30-(now-f.time)/20);ctx.restore();}
 for(let lane=0;lane<2;lane++){ellipse(ctx,HOOPS[lane],730,44,10,'#00000060');ball(ctx,HOOPS[lane],684,40,-.4);const held=keys.get(lane?'l':'a');if(held!==undefined){ctx.fillStyle='#ff2582';ctx.fillRect(HOOPS[lane]-38,738,76*clamp((now-held)/1000,0,1),4);}}
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
