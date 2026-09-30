import {HOOPS, RIM_Y, clamp, remaining, pointsAt, makeBall, stepBall, project, chargePower, rackX} from './physics.mjs?v=3';
const canvas = document.querySelector('#court'), ctx = canvas.getContext('2d');
const timer = document.querySelector('#timer'), scoreEls = [document.querySelector('#p1'),document.querySelector('#p2')];
const phase = document.querySelector('#phase'), multiplier = document.querySelector('#multiplier');
const start = document.querySelector('#start'), message = document.querySelector('#message');
const soundButton=document.querySelector('#sound');
const statsEls=[0,1].map(lane=>({accuracy:document.querySelector(`#accuracy${lane}`),streak:document.querySelector(`#streak${lane}`),best:document.querySelector(`#best${lane}`)}));
let balls=[], flashes=[], scores=[0,0], deadline=0, running=false, round=0, last=performance.now(), accumulator=0;
const drags=new Map(), keys=new Map(), cooldown=[-Infinity,-Infinity];
const aim=[0,0], rackShots=[0,0], attempts=[0,0], makes=[0,0], streaks=[0,0];
let best=[0,0];
try {const saved=JSON.parse(localStorage.getItem('hoops-best')||'[0,0]');if(Array.isArray(saved))best=[0,1].map(i=>Number.isFinite(saved[i])?Math.max(0,saved[i]):0);}catch{}
let soundOn=false,audio=null;
function sound(type){
 if(!soundOn)return;
 try {
  audio??=new (window.AudioContext||window.webkitAudioContext)();
  if(audio.state==='suspended')audio.resume();
  const oscillator=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;
  const settings={shot:[160,75,.07],rim:[430,130,.1],basket:[620,1040,.18],buzzer:[140,70,.45]};
  const [from,to,length]=settings[type];oscillator.type=type==='rim'?'triangle':'sine';
  oscillator.frequency.setValueAtTime(from,now);oscillator.frequency.exponentialRampToValueAtTime(to,now+length);
  gain.gain.setValueAtTime(.06,now);gain.gain.exponentialRampToValueAtTime(.001,now+length);
  oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(now+length);
  oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
 }catch{}
}
soundButton.addEventListener('click',()=>{soundOn=!soundOn;soundButton.textContent=soundOn?'Sound on':'Sound off';soundButton.setAttribute('aria-pressed',String(soundOn));if(soundOn)sound('shot');});
function stats(){statsEls.forEach((els,i)=>{els.accuracy.textContent=`${makes[i]}/${attempts[i]} · ${attempts[i]?Math.round(makes[i]/attempts[i]*100):0}%`;els.streak.textContent=String(streaks[i]);els.best.textContent=String(best[i]);});}
stats();
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
function shoot(lane,shotAim,power){
 const now=performance.now();if(now-cooldown[lane]<550)return;
 cooldown[lane]=now;
 const item=makeBall(lane,shotAim,power,running?round:-1,rackX(lane,rackShots[lane]));
 if(running){attempts[lane]++;stats();}
 balls.push(item);rackShots[lane]++;sound('shot');
}
function sync(now){
 const secs=running?remaining(deadline,now):0;
 if(running&&secs===0){
  running=false;phase.textContent='FULL TIME';multiplier.textContent='FREE PLAY';sound('buzzer');
  const newBest=scores.some((score,i)=>score>best[i]);best=best.map((score,i)=>Math.max(score,scores[i]));
  try{localStorage.setItem('hoops-best',JSON.stringify(best));}catch{}
  stats();message.textContent=`P1: ${scores[0]} · P2: ${scores[1]}.${newBest?' New best!':''} Play again to beat your score.`;
  start.innerHTML='Play again <span>↗</span>';
 }
 timer.value=running?String(Math.ceil(secs)).padStart(2,'0'):round?'00':'30';
 timer.classList.toggle('urgent',running&&secs<=10);
 if(running){phase.textContent='ROUND LIVE';multiplier.textContent=`${pointsAt(secs)} ${pointsAt(secs)===1?'PT':'PTS'} / BASKET`;}
}
start.addEventListener('click',()=>{
 round++;scores=[0,0];[attempts,makes,streaks,rackShots,aim].forEach(list=>list.fill(0));cooldown.fill(-Infinity);
 scoreEls.forEach(el=>el.value='00');balls=[];flashes=[];drags.clear();keys.clear();accumulator=0;
 deadline=performance.now()+30000;running=true;start.innerHTML='Restart round <span>↗</span>';
 message.textContent='Aim, charge, release. Each new ball returns to a different spot.';stats();sync(performance.now());
});
function coords(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*800/r.width,y:(e.clientY-r.top)*800/r.height};}
function laneBusy(lane){return [...drags.values()].some(d=>d.lane===lane)||keys.has(lane?'arrowup':'w');}
canvas.addEventListener('pointerdown',e=>{
 if(e.button!==0)return;
 const p=coords(e),lane=p.x<400?0:1,origin=rackX(lane,rackShots[lane]);
 if(Math.hypot(p.x-origin,p.y-684)>72||laneBusy(lane)||performance.now()-cooldown[lane]<550)return;
 e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);
 drags.set(e.pointerId,{start:p,end:p,lane,origin,time:performance.now(),touch:e.pointerType==='touch',baseAim:e.pointerType==='touch'?0:aim[lane]});
});
canvas.addEventListener('pointermove',e=>{const d=drags.get(e.pointerId);if(d){d.end=coords(e);aim[d.lane]=clamp(d.baseAim+d.end.x-d.start.x,-250,250);}});
canvas.addEventListener('pointerup',e=>{
 const d=drags.get(e.pointerId);if(!d)return;
 const p=coords(e),dy=d.start.y-p.y;
 aim[d.lane]=clamp(d.baseAim+p.x-d.start.x,-250,250);
 if(!d.touch||dy>15)shoot(d.lane,aim[d.lane],d.touch?dy:chargePower(performance.now()-d.time));
 drags.delete(e.pointerId);
});
for(const type of ['pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>drags.delete(e.pointerId));
const controlKeys=['a','d','w','arrowleft','arrowright','arrowup'];
window.addEventListener('keydown',e=>{
 const key=e.key.toLowerCase();if(!controlKeys.includes(key)||e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
 e.preventDefault();if(e.repeat||keys.has(key))return;
 if(['w','arrowup'].includes(key)){const lane=key==='w'?0:1;if(laneBusy(lane)||performance.now()-cooldown[lane]<550)return;}
 keys.set(key,performance.now());
});
window.addEventListener('keyup',e=>{
 const key=e.key.toLowerCase(),pressed=keys.get(key);if(pressed===undefined)return;
 if(key==='w'||key==='arrowup'){const lane=key==='w'?0:1;shoot(lane,aim[lane],chargePower(performance.now()-pressed));}
 keys.delete(key);
});
window.addEventListener('blur',()=>{keys.clear();drags.clear();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();drags.clear();balls=[];}sync(performance.now());});
function controls(now,dt){
 for(let lane=0;lane<2;lane++){
  const left=lane?'arrowleft':'a',right=lane?'arrowright':'d';
  aim[lane]=clamp(aim[lane]+((keys.has(right)?1:0)-(keys.has(left)?1:0))*110*dt,-250,250);
  const x=rackX(lane,rackShots[lane]);
  const held=keys.get(lane?'arrowup':'w'),drag=[...drags.values()].find(d=>d.lane===lane);
  const active=held!==undefined||drag;
  const power=drag?.touch?clamp(drag.start.y-drag.end.y,210,350):chargePower(now-(drag?.time??held??now));
  // The sight shows direction, not a guaranteed landing point. Power is separate.
  const sight=project(x+aim[lane]*1.5*1.1,0,1).x;
  ctx.save();ctx.globalAlpha=active?.9:.35;ctx.strokeStyle=lane?'#87c9ff':'#ffc0da';ctx.lineWidth=1.5;
  ellipse(ctx,sight,RIM_Y-43,9,9,null,ctx.strokeStyle,1.5);
  path(ctx,[[sight-15,RIM_Y-43],[sight+15,RIM_Y-43]],null,ctx.strokeStyle,1);
  path(ctx,[[sight,RIM_Y-58],[sight,RIM_Y-28]],null,ctx.strokeStyle,1);ctx.restore();
  const ready=clamp((now-cooldown[lane])/550,0,1);
  ellipse(ctx,x,730,44*ready,10*ready,'#00000060');ball(ctx,x,684,40*ready,-.4);
  if(active){
   ctx.fillStyle='#101014';ctx.fillRect(x-60,613,120,12);
   ctx.fillStyle='#75d8ab';ctx.fillRect(x-60+(273-210)/140*120,613,14,12);
   ctx.fillStyle='#fff';ctx.fillRect(x-60+(power-210)/140*120-2,609,4,20);
   ctx.font='700 11px Arial';ctx.textAlign='center';ctx.fillStyle='#ddd';ctx.fillText(drag?.touch?'SWIPE POWER':'RELEASE IN GREEN',x,601);
  }else{ctx.font='10px Arial';ctx.textAlign='center';ctx.fillStyle='#a69aa5';ctx.fillText(matchMedia('(pointer: coarse)').matches?'SWIPE TO SHOOT':lane?'← → AIM / ↑ SHOOT':'A D AIM / W SHOOT',x,627);}
 }
}
function drawBall(item){const p=project(item.x,item.h,item.z);ball(ctx,p.x,p.y,p.radius,item.age*2.8);}
function frame(now){
 const dt=Math.min((now-last)/1000,.25);last=now;sync(now);
 accumulator+=dt;
 while(accumulator>=1/120){accumulator-=1/120;
 for(const item of balls){
  const hits=item.rimHits+item.bankHits;
  const lane=stepBall(item,1/120);
  if(item.rimHits+item.bankHits>hits)sound('rim');
  if(lane!==-1){
   let value=0;
   if(running&&item.round===round){
    value=pointsAt(remaining(deadline,now));scores[lane]+=value;scoreEls[lane].value=String(scores[lane]).padStart(2,'0');
    // Accuracy belongs to the shooter; points always belong to the actual hoop.
    makes[item.lane]++;streaks[item.lane]++;stats();
   }
   item.judged=true;sound('basket');
   flashes.push({lane,time:now,label:value?`+${value}${item.rimHits||item.bankHits?'':' SWISH'}`:'NICE!',good:true});
  }
  if(!item.judged&&(item.landed||item.age>2.5)){
   item.judged=true;if(running&&item.round===round){streaks[item.lane]=0;stats();}
   flashes.push({lane:item.lane,time:now,label:item.rimHits?'RIM OUT':item.z<.85?'SHORT':'MISSED',good:false});
  }
 }
 }
 balls=balls.filter(item=>item.age<6&&item.x>-400&&item.x<1200);
 ctx.clearRect(0,0,800,800);ctx.drawImage(board,0,0);
 for(const item of balls){const p=project(item.x,0,item.z);ellipse(ctx,p.x,p.y,p.radius*(1+item.h/800),p.radius*.2,'#00000025');}
 const ordered=[...balls].sort((a,b)=>b.z-a.z);
 // Balls in front of the hoop must cover its rim/net on the way up. Balls
 // arriving at hoop depth sit between its back and front halves on the way down.
 ordered.filter(item=>item.z>1.08).forEach(drawBall);
 HOOPS.forEach(x=>net(x,now,false));
 ordered.filter(item=>item.z>=.92&&item.z<=1.08).forEach(drawBall);
 HOOPS.forEach(x=>net(x,now,true));
 ordered.filter(item=>item.z<.92).forEach(drawBall);
 flashes=flashes.filter(f=>now-f.time<800);for(const f of flashes){ctx.save();ctx.globalAlpha=1-(now-f.time)/800;ctx.font='900 25px Arial';ctx.textAlign='center';ctx.fillStyle=f.good?'#fff':'#bc9eac';ctx.fillText(f.label,HOOPS[f.lane],RIM_Y-30-(now-f.time)/20);ctx.restore();}
 controls(now,dt);
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
