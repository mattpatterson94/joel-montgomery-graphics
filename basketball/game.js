import {HOOPS, RIM_Y, clamp, remaining, pointsAt, makeBall, stepBall, project, chargePower, rackX, BALL_RADIUS, COURT_HEIGHT, RACK_Y, carpetHeight} from './physics.mjs?v=13';
import {gestureBall,heldPosition,previewArc} from './gestures.mjs?v=13';
import {drawBall as drawSphere} from './ball-renderer.mjs?v=13';
import {drawSensorArm} from './sensor.mjs?v=13';
import {drawFabricReturn,fabricImpact,fabricMoving} from './fabric.mjs?v=16';
import {RETURN_FRONT_LEFT as frontLeft,RETURN_FRONT_RIGHT as frontRight} from './machine-geometry.mjs?v=16';
import {drawSideNet} from './side-net.mjs?v=16';
import {drawNet} from './net.mjs?v=13';
import {CourtAudio} from './sound.mjs?v=13';
const canvas = document.querySelector('#court'), ctx = canvas.getContext('2d');
// Anchor the room to the actual court bounds, including on ultrawide screens.
// The mural ends outside the machine instead of using a viewport percentage.
const office=document.querySelector('.office');
// Share room coordinates with the accessible TV controls in <main>.
const roomStyle=document.body.style;
function alignOffice(){
 const rect=canvas.getBoundingClientRect(),top=rect.top+window.scrollY;
 roomStyle.setProperty('--court-left',`${rect.left}px`);
 roomStyle.setProperty('--court-right',`${rect.right}px`);
 roomStyle.setProperty('--court-top',`${top}px`);
 roomStyle.setProperty('--court-width',`${rect.width}px`);
 const cornerX=Math.max(0,rect.left-12),cornerY=top+rect.width*1.28;
 const nearY=cornerY+cornerX*.36;
 roomStyle.setProperty('--corner-x',`${cornerX}px`);
 roomStyle.setProperty('--corner-y',`${cornerY}px`);
 roomStyle.setProperty('--near-floor-y',`${nearY}px`);
 office.querySelector('.floor-edge path').setAttribute('d',`M0 ${nearY}L${cornerX} ${cornerY}H${document.documentElement.clientWidth}`);
}
new ResizeObserver(alignOffice).observe(canvas);
window.addEventListener('resize',alignOffice);alignOffice();
// A transparent viewport canvas carries balls beyond the machine's bounds.
// Input stays on the original court; this layer never intercepts pointer events.
const looseCanvas=document.createElement('canvas');looseCanvas.id='loose-balls';looseCanvas.setAttribute('aria-hidden','true');document.body.append(looseCanvas);
const loose=looseCanvas.getContext('2d'),looseDpr=Math.min(devicePixelRatio||1,1.5);
let sceneRect=canvas.getBoundingClientRect();
function resizeLoose(){looseCanvas.width=Math.ceil(innerWidth*looseDpr);looseCanvas.height=Math.ceil(innerHeight*looseDpr);sceneRect=canvas.getBoundingClientRect();}
window.addEventListener('resize',resizeLoose);window.addEventListener('scroll',()=>{sceneRect=canvas.getBoundingClientRect();},{passive:true});
new ResizeObserver(()=>{sceneRect=canvas.getBoundingClientRect();}).observe(canvas);resizeLoose();
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
const audio=new CourtAudio();
const armReactions=[null,null];
const netReactions=[null,null],rackOwners=[{},{}];
let hover=null;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
soundButton.addEventListener('click',()=>{
 audio.enabled=!audio.enabled;audio.unlock();soundButton.textContent=audio.enabled?'Sound on':'Sound off';
 soundButton.setAttribute('aria-pressed',String(audio.enabled));
});
function stats(){statsEls.forEach((els,i)=>{els.accuracy.textContent=`${makes[i]}/${attempts[i]} · ${attempts[i]?Math.round(makes[i]/attempts[i]*100):0}%`;els.streak.textContent=String(streaks[i]);els.best.textContent=String(best[i]);});}
stats();
const board = document.createElement('canvas'); board.width = 800; board.height = COURT_HEIGHT;
board.className='court-backdrop';board.setAttribute('aria-hidden','true');
canvas.before(board);
const b = board.getContext('2d');
const resolution=Math.min(devicePixelRatio||1,2);
canvas.width=800*resolution;board.width=880*resolution;canvas.height=board.height=COURT_HEIGHT*resolution;
ctx.scale(resolution,resolution);b.scale(resolution,resolution);b.translate(40,0);
function path(c, coords, fill, stroke, width=1) {c.beginPath();coords.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));if(fill){c.closePath();c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function ellipse(c,x,y,rx,ry,fill,stroke,width=1){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
const artwork = new Image();
artwork.src = new URL('./backboard-reference.png', import.meta.url).href;
function backboard(now=performance.now()){
 b.clearRect(-40,0,880,COURT_HEIGHT);
 // Display the actual left-hand artwork from the supplied reference at its native
 // aspect ratio. Clip the white corners, without redrawing any of the print design.
 if(artwork.complete && artwork.naturalWidth){
  b.save();b.beginPath();b.roundRect(36,24,728,432,[65,65,0,0]);b.clip();
  const sourceScale=artwork.naturalWidth/1920;
  b.drawImage(artwork,155*sourceScale,213*sourceScale,746*sourceScale,443*sourceScale,36,24,728,432);b.restore();
  // Cover the pale antialiased crop edge around the black header.
  b.beginPath();b.roundRect(36,24,728,432,[65,65,0,0]);b.strokeStyle='#101213';b.lineWidth=2.5;b.stroke();
 }
 drawFabricReturn(b,now);
 for(const flip of [1,-1]){
  b.save();b.translate(flip===1?0:800,0);b.scale(flip,1);
  drawSideNet(b);b.restore();
 }
 // The front catcher is a deep fabric sling between two rails.
 b.beginPath();b.moveTo(frontLeft,876);b.quadraticCurveTo(400,938,frontRight,876);
 b.lineTo(frontRight,943);b.quadraticCurveTo(400,965,frontLeft,943);b.closePath();
 const pocket=b.createLinearGradient(0,875,0,960);pocket.addColorStop(0,'#373b39');pocket.addColorStop(.5,'#111615');pocket.addColorStop(1,'#070b0b');b.fillStyle=pocket;b.fill();
 for(const y of [881,945]){
  b.beginPath();b.moveTo(frontLeft,y+12);b.quadraticCurveTo(frontLeft-7,y,frontLeft+14,y);b.lineTo(frontRight-14,y);b.quadraticCurveTo(frontRight+7,y,frontRight,y+12);
  b.strokeStyle='#4b5352';b.lineWidth=10;b.stroke();b.strokeStyle='#aeb9b7';b.lineWidth=3;b.stroke();
 }
 for(const x of [frontLeft,frontRight]){path(b,[[x,891],[x,944]],null,'#87928e',7);}
 b.font='700 12px Arial';b.textAlign='center';b.fillStyle='#c1b5c1';b.fillText('P1',HOOPS[0],929);b.fillText('P2',HOOPS[1],929);
}
artwork.addEventListener('load',()=>backboard());
artwork.addEventListener('error',()=>{message.textContent='Backboard image could not load. Reload the page to try again.';});
backboard();
function shoot(item){
 if(!item)return;
 const lane=item.lane,now=performance.now();if(now-cooldown[lane]<550)return;
 cooldown[lane]=now;
 item.round=running?round:-1;
 if(running){attempts[lane]++;stats();}
 balls.push(item);rackShots[lane]++;audio.play('release',.35,lane?.5:-.5);
}
function sync(now){
 const secs=running?remaining(deadline,now):0;
 if(running&&secs===0){
  running=false;phase.textContent='FULL TIME';multiplier.textContent='FREE PLAY';audio.play('end',.7);
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
 scoreEls.forEach(el=>el.value='00');balls=[];flashes=[];netReactions.fill(null);armReactions.fill(null);drags.clear();keys.clear();accumulator=0;
 deadline=performance.now()+30000;running=true;start.innerHTML='Restart round <span>↗</span>';
 audio.unlock();message.textContent='Drag up towards a hoop and release. Adjust for each new ball position.';stats();sync(performance.now());
});
function coords(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*800/r.width,y:(e.clientY-r.top)*COURT_HEIGHT/r.height};}
function laneBusy(lane){return [...drags.values()].some(d=>d.lane===lane)||keys.has(lane?'arrowup':'w');}
canvas.addEventListener('pointerdown',e=>{
 if(e.button!==0)return;
 const p=coords(e),lane=p.x<400?0:1,origin=rackX(lane,rackShots[lane]);
 if(Math.hypot(p.x-origin,p.y-RACK_Y)>72||laneBusy(lane)||performance.now()-cooldown[lane]<550)return;
 e.preventDefault();audio.unlock();canvas.classList.add('pointer-focus');canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);
 const now=performance.now();drags.set(e.pointerId,{start:p,end:p,lane,origin,samples:[{...p,t:now}]});
});
function recordPointer(d,e){
 const now=performance.now(),events=e.getCoalescedEvents?.()||[];
 for(const event of [...events,e]){
  const p=coords(event),t=now-Math.max(0,e.timeStamp-event.timeStamp);
  // Ignore out-of-order samples and retain enough history for release velocity.
  if(t<(d.samples.at(-1)?.t??-Infinity))continue;
  if(t===d.samples.at(-1)?.t&&d.samples.length>1)d.samples.pop();
  d.samples.push({...p,t});d.end=p;
 }
 while(d.samples.length>3&&d.samples[1].t<now-200)d.samples.shift();
}
canvas.addEventListener('pointermove',e=>{hover=coords(e);const d=drags.get(e.pointerId);if(d)recordPointer(d,e);});
canvas.addEventListener('pointerleave',()=>{hover=null;});
canvas.addEventListener('pointerup',e=>{
 const d=drags.get(e.pointerId);if(!d)return;
 recordPointer(d,e);shoot(gestureBall(d,performance.now()));drags.delete(e.pointerId);
});
for(const type of ['pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>drags.delete(e.pointerId));
const controlKeys=['a','d','w','arrowleft','arrowright','arrowup'];
window.addEventListener('keydown',e=>{
 const key=e.key.toLowerCase();if(!controlKeys.includes(key)||e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
 e.preventDefault();canvas.classList.remove('pointer-focus');if(e.repeat||keys.has(key))return;
 if(['w','arrowup'].includes(key)){const lane=key==='w'?0:1;if(laneBusy(lane)||performance.now()-cooldown[lane]<550)return;}
 audio.unlock();keys.set(key,performance.now());
});
window.addEventListener('keyup',e=>{
 const key=e.key.toLowerCase(),pressed=keys.get(key);if(pressed===undefined)return;
 if(key==='w'||key==='arrowup'){const lane=key==='w'?0:1;shoot(makeBall(lane,aim[lane],chargePower(performance.now()-pressed),-1,rackX(lane,rackShots[lane])));}
 keys.delete(key);
});
window.addEventListener('keydown',e=>{if(e.key==='Tab')canvas.classList.remove('pointer-focus');});
window.addEventListener('blur',()=>{keys.clear();drags.clear();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();drags.clear();balls=[];}sync(performance.now());});
function drawPreview(sample){
 const points=previewArc(sample);
 ctx.save();
 points.forEach((point,i)=>{const p=project(point.x,point.h,point.z);ctx.globalAlpha=.65*(1-i/points.length);ellipse(ctx,p.x,p.y,2.4,2.4,'#fff');});
 ctx.restore();
}
function controls(now,dt){
 for(let lane=0;lane<2;lane++){
  const left=lane?'arrowleft':'a',right=lane?'arrowright':'d';
  aim[lane]=clamp(aim[lane]+((keys.has(right)?1:0)-(keys.has(left)?1:0))*110*dt,-250,250);
  const x=rackX(lane,rackShots[lane]);
  const held=keys.get(lane?'arrowup':'w'),drag=[...drags.values()].find(d=>d.lane===lane);
  const ready=clamp((now-cooldown[lane])/550,0,1);
  ellipse(ctx,x,890,56*ready,12*ready,'#00000050');
  if(drag){
   const sample=gestureBall(drag,now);drawPreview(sample);
   const pose=heldPosition(drag),p=project(pose.x,pose.h,0);
   const dx=drag.end.x-drag.start.x,dy=drag.start.y-drag.end.y;
   if(Math.hypot(drag.end.x-p.x,drag.end.y-p.y)>12)path(ctx,[[p.x,p.y],[drag.end.x,drag.end.y]],null,'#ffffff22',1);
   drawSphere(ctx,p.x,p.y,BALL_RADIUS,[.45-dy*.008,.2+dx*.01,-.65],drag);
  }else{
   if(held!==undefined)drawPreview(makeBall(lane,aim[lane],chargePower(now-held),-1,x));
   if(hover&&Math.hypot(hover.x-x,hover.y-RACK_Y)<72&&ready===1)ellipse(ctx,x,RACK_Y,BALL_RADIUS+6,BALL_RADIUS+6,null,'#ffffff38',1);
   drawSphere(ctx,x,RACK_Y,BALL_RADIUS*ready,[.45,.2+rackShots[lane]*.28,-.65],rackOwners[lane]);
   ctx.font='10px Arial';ctx.textAlign='center';ctx.fillStyle='#a69aa5';
   ctx.fillText(held!==undefined?'RELEASE TO THROW':matchMedia('(pointer: coarse)').matches?'SWIPE UP TO SHOOT':'DRAG UP & RELEASE',x,767);
  }
 }
}
function drawBall(item){if(item.escaped)return;const p=project(item.x,item.h,item.z);drawSphere(ctx,p.x,p.y,p.radius,item.spin,item);}
let clothWasMoving=false;
function frame(now){
 const dt=Math.min((now-last)/1000,.25);last=now;sync(now);
 accumulator+=dt;
 while(accumulator>=1/120){accumulator-=1/120;
 for(const item of balls){
  const lane=stepBall(item,1/120);
  for(const event of item.events){
   if(!reducedMotion&&(event.type==='return'||event.type==='bounce'))fabricImpact(now,event.strength);
   audio.play(event.type,event.strength,clamp((project(item.x,item.h,item.z).x-400)/420,-.8,.8));
   if(event.type==='sensor')armReactions[event.lane]={time:now};
   if(event.type==='rim'&&!reducedMotion&&(!netReactions[event.lane]||now-netReactions[event.lane].time>450))netReactions[event.lane]={time:now,rim:true};
  }
  if(lane!==-1){
   let value=0;
   if(running&&item.round===round){
    value=pointsAt(remaining(deadline,now));scores[lane]+=value;scoreEls[lane].value=String(scores[lane]).padStart(2,'0');
    // Accuracy belongs to the shooter; points always belong to the actual hoop.
    makes[item.lane]++;streaks[item.lane]++;stats();
   }
   item.judged=true;audio.play(item.entry.swish?'swish':'net',.8,lane?.5:-.5);
   if(!reducedMotion&&netReactions[lane]?.ball!==item)netReactions[lane]={time:now,ball:item};
   flashes.push({lane,time:now,label:value?`+${value}${item.rimHits||item.bankHits?'':' SWISH'}`:'NICE!',good:true});
  }
  if(!item.judged&&(item.landed||item.escaped||item.age>4.5)){
   item.judged=true;if(running&&item.round===round){streaks[item.lane]=0;stats();}
   flashes.push({lane:item.lane,time:now,label:item.rimHits?'RIM OUT':item.z<.85?'SHORT':'MISSED',good:false});
  }
 }
 }
 balls=balls.filter(item=>item.escaped?item.age<9:item.age<5&&!(item.grounded&&item.z===0));
 const clothMoving=fabricMoving(now);
 if(clothMoving||clothWasMoving)backboard(now);
 clothWasMoving=clothMoving;
 ctx.clearRect(0,0,800,COURT_HEIGHT);
 for(const item of balls.filter(item=>!item.escaped)){const p=project(item.x,0,item.z);ellipse(ctx,p.x,p.y,p.radius*(1+item.h/800),p.radius*.2,'#00000025');}
 const ordered=[...balls].sort((a,b)=>b.z-a.z);
 // Balls in front of the hoop must cover its rim/net on the way up. Balls
 // arriving at hoop depth sit between its back and front halves on the way down.
 ordered.filter(item=>item.z>1.08).forEach(drawBall);
 HOOPS.forEach((x,lane)=>drawNet(ctx,x,now,false,netReactions[lane]));
 HOOPS.forEach((x,lane)=>drawSensorArm(ctx,x,now,armReactions[lane],reducedMotion));
 ordered.filter(item=>item.z>=.92&&item.z<=1.08).forEach(drawBall);
 HOOPS.forEach((x,lane)=>drawNet(ctx,x,now,true,netReactions[lane]));
 ordered.filter(item=>item.z<.92).forEach(drawBall);
 flashes=flashes.filter(f=>now-f.time<800);for(const f of flashes){ctx.save();ctx.globalAlpha=1-(now-f.time)/800;ctx.font='700 19px Arial';ctx.textAlign='center';ctx.fillStyle=f.good?'#fff':'#bc9eac';ctx.fillText(f.label,HOOPS[f.lane],RIM_Y-32-(reducedMotion?0:(now-f.time)/42));ctx.restore();}
 controls(now,dt);
 loose.setTransform(1,0,0,1,0,0);loose.clearRect(0,0,looseCanvas.width,looseCanvas.height);
 const unit=sceneRect.width/800;
 loose.setTransform(looseDpr*unit,0,0,looseDpr*unit,sceneRect.left*looseDpr,sceneRect.top*looseDpr);
 for(const item of ordered){
  const p=project(item.x,item.h,item.z);
  if(!item.escaped&&p.x-p.radius>=0&&p.x+p.radius<=800&&p.y-p.radius>=0&&p.y+p.radius<=COURT_HEIGHT)continue;
  if(sceneRect.left+(p.x+p.radius)*unit<0||sceneRect.left+(p.x-p.radius)*unit>innerWidth||sceneRect.top+(p.y-p.radius)*unit>innerHeight)continue;
  loose.save();
  if(!item.escaped){
   // Continue the edge of an airborne ball outside the court without overdrawing
   // the scoreboard/net composition already rendered inside it.
   loose.beginPath();loose.rect(-10000,-10000,20000,20000);loose.rect(0,0,800,COURT_HEIGHT);loose.clip('evenodd');
  }else{
   const floor=carpetHeight(item.z,item.x),shadow=project(item.x,floor,item.z),height=Math.max(0,item.h-floor);
   loose.globalAlpha=.28/(1+height/400);ellipse(loose,shadow.x,shadow.y,shadow.radius*(1+height/1200),shadow.radius*.18,'#000');loose.globalAlpha=1;
  }
  drawSphere(loose,p.x,p.y,p.radius,item.spin,item);loose.restore();
 }
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
