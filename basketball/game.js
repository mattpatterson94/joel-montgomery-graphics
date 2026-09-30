import {HOOPS, RIM_Y, GRAVITY, clamp, remaining, pointsAt, makeBall, stepBall} from './physics.mjs';
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
function backboard(){
 // Draw the reference's pink split-panel backboard as scalable native artwork.
 b.fillStyle='#19191b';b.beginPath();b.roundRect(36,24,728,342,[58,58,0,0]);b.fill();
 b.font='italic 900 53px Arial';b.textAlign='center';b.fillStyle='#fff';b.fillText('HOOPS OF FUN',400,94);
 for(let y=77;y<97;y+=4){b.fillStyle='#19191b';b.fillRect(111,y,578,1.5);}
 path(b,[[47,157],[92,117],[708,117],[753,157],[753,356],[47,356]],'#f41c80','#030305',11);
 // Hourglass, pinstripes and white curved dividers.
 b.save();b.beginPath();b.moveTo(306,123);b.bezierCurveTo(374,217,368,271,307,350);b.lineTo(493,350);b.bezierCurveTo(432,271,426,217,494,123);b.closePath();b.clip();b.fillStyle='#0b090d';b.fillRect(300,120,200,240);
 for(let y=126;y<356;y+=8){b.fillStyle='#fb2386';b.fillRect(300,y,200,3);}b.restore();
 b.strokeStyle='#fff';b.lineWidth=5;for(const flip of [1,-1]){b.save();b.translate(400,0);b.scale(flip,1);b.beginPath();b.moveTo(-94,123);b.bezierCurveTo(-26,217,-32,271,-93,350);b.stroke();b.restore();}
 // Deterministic flecks reproduce the printed board texture without an image dependency.
 let seed=42;for(let i=0;i<2300;i++){seed=(seed*1664525+1013904223)>>>0;const x=60+seed%680;seed=(seed*1664525+1013904223)>>>0;const y=162+seed%185;b.fillStyle='#260b2b28';b.fillRect(x,y,1.4,1.4);}
 b.strokeStyle='#fff';b.lineWidth=7;for(const x of HOOPS)b.strokeRect(x-61,196,122,116);
 ball(b,400,210,52,0,true);b.font='italic 900 25px Arial';b.lineWidth=6;b.strokeStyle='#111';b.strokeText('COPIRITE',400,220);b.fillStyle='white';b.fillText('COPIRITE',400,220);
 // Sloped return ramp and cage.
 const ramp=b.createLinearGradient(0,355,0,770);ramp.addColorStop(0,'#15161a');ramp.addColorStop(1,'#303034');path(b,[[67,365],[733,365],[774,773],[26,773]],ramp);
 b.save();path(b,[[67,365],[733,365],[774,773],[26,773]],'#00000000');b.clip();
 for(const x of [220,580]){b.strokeStyle='#ffffff32';b.lineWidth=2;b.beginPath();b.moveTo(x-38,465);b.lineTo(x-72,591);b.quadraticCurveTo(x,655,x+72,591);b.lineTo(x+38,465);b.stroke();ellipse(b,x,580,34,11,null,'#ffffff28',2);}
 b.restore();
 for(const flip of [1,-1]){b.save();b.translate(flip===1?0:800,0);b.scale(flip,1);path(b,[[40,166],[67,365],[26,773],[7,744]],'#ffffff04');for(let t=0;t<=1;t+=.09){path(b,[[40+27*t,166+199*t],[7+19*t,744+29*t]],null,'#aaa3ae35');path(b,[[40-33*t,166+578*t],[67-41*t,365+408*t]],null,'#aaa3ae35');}path(b,[[40,166],[7,744],[26,773]],null,'#8e8d93',4);b.restore();}
 path(b,[[26,775],[774,775]],null,'#aaa7ad',7);
 b.font='700 12px Arial';b.fillStyle='#c1b5c1';b.fillText('P1',220,758);b.fillText('P2',580,758);
}
backboard();
function net(x,now){const wobble=flashes.some(f=>f.lane===HOOPS.indexOf(x)&&now-f.time<500)?Math.sin(now/40)*4:0;
 for(let i=0;i<7;i++){const a=x-47+i*94/6,z=x-28+i*56/6+wobble;path(ctx,[[a,RIM_Y],[z,RIM_Y+73]],null,i%2?'#dddde2':'#bbc2d6',1.5);}
 for(let i=0;i<6;i++){path(ctx,[[x-47+i*94/6,RIM_Y],[x-28+(i+1)*56/6+wobble,RIM_Y+73]],null,'#dddde2',1);}
 ellipse(ctx,x+wobble,RIM_Y+73,28,7,null,'#3270b6',2);ellipse(ctx,x,RIM_Y,49,11,null,'#9a3b15',7);
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
window.addEventListener('keyup',e=>{const key=e.key.toLowerCase(),pressed=keys.get(key);if(pressed===undefined)return;shoot(key==='a'?0:1,0,(940+clamp((performance.now()-pressed)/1000,0,1)*180)/3.4);keys.delete(key);});
window.addEventListener('blur',()=>{keys.clear();drags.clear();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();drags.clear();balls=[];}sync(performance.now());});
function frame(now){
 const dt=Math.min((now-last)/1000,.05);last=now;sync(now);ctx.clearRect(0,0,800,800);ctx.drawImage(board,0,0);HOOPS.forEach(x=>net(x,now));
 for(const d of drags.values()){
  const dy=d.start.y-d.end.y;if(dy<=15)continue;const sample=makeBall(d.lane,d.end.x-d.start.x,dy,-1);
  for(let t=.06;t<.7;t+=.06){const x=sample.x+sample.vx*t,y=sample.y+sample.vy*t+GRAVITY*t*t/2;ellipse(ctx,x,y,3,3,'#ffffff99');}
 }
 for(const item of balls){
  const lane=stepBall(item,dt);
  if(lane!==-1){let value=0;if(running&&item.round===round){value=pointsAt(remaining(deadline,now));scores[lane]+=value;scoreEls[lane].value=String(scores[lane]).padStart(2,'0');}flashes.push({lane,time:now,label:value?`+${value}`:'NICE!'});}
  const size=clamp(36-item.age*18,15,36);ball(ctx,item.x,item.y,size,item.age*2.8);
 }
 balls=balls.filter(item=>item.age<4&&item.y<850&&item.x>-100&&item.x<900);
 // Front of each hoop overlays the ball as it drops through.
 for(const x of HOOPS){ctx.beginPath();ctx.ellipse(x,RIM_Y,49,11,0,0,Math.PI);ctx.strokeStyle='#f28338';ctx.lineWidth=6;ctx.stroke();}
 flashes=flashes.filter(f=>now-f.time<800);for(const f of flashes){ctx.save();ctx.globalAlpha=1-(now-f.time)/800;ctx.font='900 25px Arial';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText(f.label,HOOPS[f.lane],RIM_Y-30-(now-f.time)/20);ctx.restore();}
 for(let lane=0;lane<2;lane++){ellipse(ctx,HOOPS[lane],723,44,10,'#00000060');ball(ctx,HOOPS[lane],684,37,-.4);const held=keys.get(lane?'l':'a');if(held!==undefined){ctx.fillStyle='#ff2582';ctx.fillRect(HOOPS[lane]-38,738,76*clamp((now-held)/1000,0,1),4);}}
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
