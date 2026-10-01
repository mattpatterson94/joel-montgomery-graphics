// Serve repository on :8765. NODE_PATH includes Playwright; CHROMIUM_PATH optional.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const physics=await import('../basketball/physics.mjs');
 const {pointsAt,remaining,makeBall,stepBall,project,RIM_Y,HOOPS,hoopWorldX,chargePower,rackX,COURT_HEIGHT,RACK_Y,GRAVITY,BALL_RADIUS}=physics;
 const {gestureBall,heldPosition,previewArc,releaseSpeed}=await import('../basketball/gestures.mjs');
 const {sensorAngle}=await import('../basketball/sensor.mjs');
 const {netShape}=await import('../basketball/net.mjs');
 const aimFor=(lane,x)=> (hoopWorldX(lane)-x)/1.65;
 function flight(ball,fps=120){const hits=[];for(let i=0;i<fps*5;i++){const hit=stepBall(ball,1/fps);if(hit!==-1)hits.push(hit);}return{ball,hits};}
 function gesture(lane,origin,dx=0,dy=240,duration=350,steps=14){return{lane,origin,start:{x:origin,y:RACK_Y},end:{x:origin+dx,y:RACK_Y-dy},samples:Array.from({length:steps+1},(_,i)=>({x:origin+dx*i/steps,y:RACK_Y-dy*i/steps,t:duration*i/steps}))};}
 assert.equal(pointsAt(30),1);assert.equal(pointsAt(20.001),1);assert.equal(pointsAt(20),2);assert.equal(pointsAt(10),3);assert.equal(pointsAt(0),0);assert.equal(remaining(30000,31000),0);
 // Each scored ball triggers one sensor hit and one quiet ramp return.
 {const ball=makeBall(0,aimFor(0,HOOPS[0]),280,1),events=[];
  for(let i=0;i<600;i++){
   const returning=ball.landed,previousZ=ball.z;
   stepBall(ball,1/120);events.push(...ball.events.map(event=>event.type));
   if(returning)assert.ok(ball.z<=previousZ+1e-8,'the net cannot recapture a returning ball');
  }
  assert.equal(events.filter(type=>type==='sensor').length,1);
  assert.equal(events.filter(type=>type==='return').length,1);
 }
 for(const lane of [0,1])for(const fps of [30,60,144])assert.deepEqual(flight(makeBall(lane,aimFor(lane,HOOPS[lane]),280,1),fps).hits,[lane]);
 for(const lane of [0,1]){
  for(const duration of [220,350,600]){
   const g=gesture(lane,HOOPS[lane],0,240,duration);
   assert.deepEqual(flight(gestureBall(g,duration)).hits,[lane],'natural slow and quick throws score');
  }
  const next=rackX(lane,1),dx=(HOOPS[lane]-next)/1.243;
  assert.deepEqual(flight(gestureBall(gesture(lane,next,dx),350)).hits,[lane],'re-aim from shifted position');
  assert.deepEqual(flight(gestureBall(gesture(lane,next),350)).hits,[],'same gesture from new position misses');
 }
 assert.equal(gestureBall(gesture(0,216,0,0),350),null,'click is not a throw');
 assert.equal(gestureBall(gesture(0,216,0,-100),350),null,'downward drag cancels');
 assert.deepEqual(flight(gestureBall(gesture(0,216,120),350)).hits,[],'mis-aimed throw misses');
 assert.deepEqual(flight(gestureBall(gesture(0,216,0,75),350)).hits,[],'short throw misses');
 const sparse=gesture(0,216,0,240,350,2),dense=gesture(0,216,0,240,350,50);
 assert.ok(Math.abs(releaseSpeed(sparse.samples,350)-releaseSpeed(dense.samples,350))<.01,'sample-rate-independent velocity');
 const g=gesture(0,216),shot=gestureBall(g,350),held=heldPosition(g);
 assert.equal(shot.x,held.x);assert.equal(shot.h,held.h,'release does not jump back to rack');
 assert.equal(project(216,76,0).y,RACK_Y);assert.equal(BALL_RADIUS,52);
 const timed=gestureBall(g,350);let scoredAt=0;for(let i=0;i<240;i++){if(stepBall(timed,1/240)>=0){scoredAt=timed.age;break;}}assert.ok(scoredAt>.75&&scoredAt<1,'shorter hang time');
 const preview=previewArc(shot),t=.035;
 assert.ok(Math.abs(preview[0].h-(shot.h+shot.vh*t-GRAVITY*t*t/2))<.001);
 assert.ok(preview.length<15,'guide stops before the landing');
 const arc=gestureBall(g,350);for(let i=0;i<75;i++)stepBall(arc,1/120);assert.ok(project(arc.x,arc.h,arc.z).y<RIM_Y-30);
 const spin=makeBall(0,-75,280,1),original=[...spin.spin];stepBall(spin,.1);assert.ok(spin.spin.filter((v,i)=>v!==original[i]).length>=2,'multi-axis spin');
 // A controlled bank can drop in; excess power rebounds out towards the player.
 for(const fps of [30,60,144]){
  const soft=flight(makeBall(0,aimFor(0,216),305,1),fps);
  assert.ok(soft.ball.bankHits>0);assert.deepEqual(soft.hits,[0]);
  const hard=flight(makeBall(0,aimFor(0,216),340,1),fps);
  assert.ok(hard.ball.bankHits>0);assert.deepEqual(hard.hits,[]);
 }
 assert.equal(sensorAngle(null,0),0);
 assert.ok(sensorAngle({time:0},75)>1,'paddle knocked down');
 assert.ok(sensorAngle({time:0},300)<0,'spring overshoot');
 assert.equal(sensorAngle({time:0},1300),0,'paddle settles');
 assert.equal(sensorAngle({time:0},300,true),0,'reduced motion skips oscillation');
 const bank=flight(makeBall(0,aimFor(0,216),350,1));assert.ok(bank.ball.bankHits>0);
 const rim=flight(makeBall(0,aimFor(0,216)+35,280,1));assert.ok(rim.ball.rimHits>0);assert.ok(rim.ball.grounded);
 const reaction={time:0,ball:{h:100,entry:{swish:true,x:0}}};assert.equal(netShape(reaction,180,0).stretch,0,'net anchors stay fixed');assert.ok(netShape(reaction,180,1).stretch>5);assert.equal(netShape(reaction,2000,1).stretch,0,'net settles');
 // Escaped balls drop below the ramp and rebound from the carpet on both sides.
 for(const lane of [0,1])for(const fps of [30,144]){
  const ball=makeBall(lane,lane?250:-250,300,1);let floorHits=0,belowRamp=false;
  for(let i=0;i<fps*5;i++){assert.equal(stepBall(ball,1/fps),-1);floorHits+=ball.events.filter(e=>e.type==='floor').length;belowRamp||=ball.h<0;}
  assert.equal(ball.escaped,true);assert.ok(belowRamp);assert.ok(floorHits>=2);assert.ok(ball.floorBounces>=2);
 }
 // Crossing the rim centre must not award points or snap the sphere's motion.
 {
  const ball=makeBall(0,0,280,1),x=hoopWorldX(0)+12;
  Object.assign(ball,{x,h:physics.RIM_HEIGHT+1,z:1,vx:45,vz:.02,vh:-200});
  assert.equal(stepBall(ball,1/120),-1);assert.ok(ball.entering);assert.equal(ball.scored,false);
  assert.ok(Math.abs(ball.x-(x+45/120))<1e-8,'no centring snap');
  assert.ok(Math.abs(ball.z-(1+.02/120))<1e-8,'depth is preserved');
  assert.equal(ball.vx,45);assert.equal(ball.vz,.02,'entry keeps lateral momentum');
  let awards=0;
  for(let i=0;i<240;i++)if(stepBall(ball,1/240)>=0){awards++;assert.ok(ball.h<physics.RIM_HEIGHT-BALL_RADIUS);}
  assert.equal(awards,1,'one award after the whole sphere clears');
 }
 // The steel lip rejects an off-centre throw consistently, while existing tests
 // above retain clean swishes and controlled banks at multiple frame rates.
 for(const fps of [30,60,144]){
  const miss=flight(makeBall(0,-40,280,1),fps);
  assert.deepEqual(miss.hits,[]);assert.ok(miss.ball.rimHits>0,'marginal throw rebounds');
 }
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const instant=new Date('2026-09-30T00:00:00Z');await page.clock.install({time:instant});await page.clock.pauseAt(instant);
 const icon=await page.request.get('http://localhost:8765/basketball/favicon-32.png');assert.equal(icon.status(),200);
 const response=page.waitForResponse(r=>r.url().endsWith('backboard-reference.png'));
 await page.goto('http://localhost:8765/basketball/');assert.equal((await response).status(),200);
 await page.clock.runFor(32);
 assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'true','sound starts enabled');
 // A ball wholly inside the display bounds must alter its composited pixels.
 // This catches the original HTML-overlay bug, not just a z-index declaration.
 const displayBefore=await page.locator('.scoreboard').screenshot();
 await page.evaluate(async()=>{const {drawBall}=await import('./ball-renderer.mjs?v=13');drawBall(document.querySelector('#court').getContext('2d'),400,400,22,[.45,.2,-.65],{});});
 const displayAfter=await page.locator('.scoreboard').screenshot();
 assert.equal(displayBefore.equals(displayAfter),false,'ball paints in front of scoreboard');
 await page.screenshot({path:'/tmp/hoops-scoreboard-layer.png',fullPage:true});
 await page.clock.runFor(32);
 const score=async id=>Number(await page.locator(id).textContent());
 const shots=[0,0];
 async function start(){await page.locator('#start').click();shots.fill(0);}
 async function mouseShot(lane,{dy=240,duration=350,correctAim=true,capture=false}={}){
  const box=await page.locator('#court').boundingBox(),origin=rackX(lane,shots[lane]);
  const point=(x,y)=>({x:box.x+x*box.width/800,y:box.y+y*box.height/COURT_HEIGHT});
  const dx=correctAim?(HOOPS[lane]-origin)/1.243:120,a=point(origin,RACK_Y);
  await page.mouse.move(a.x,a.y);await page.mouse.down();
  for(let i=1;i<=14;i++){await page.clock.runFor(duration/14);const p=point(origin+dx*i/14,RACK_Y-dy*i/14);await page.mouse.move(p.x,p.y);}
  if(capture)await page.screenshot({path:'/tmp/hoops-desktop-drag.png',fullPage:true});
  await page.mouse.up();if(dy>=28)shots[lane]++;
  await page.clock.runFor(1250);
  if(capture)await page.screenshot({path:'/tmp/hoops-net.png',fullPage:true});
  await page.clock.runFor(950);
 }
 await mouseShot(0);assert.equal(await score('#p1'),0);
 await start();await mouseShot(0,{dy:0});assert.equal(await score('#p1'),0);assert.match(await page.locator('#accuracy0').textContent(),/^0\/0/);
 await start();await mouseShot(0,{correctAim:false});assert.equal(await score('#p1'),0);
 await start();await mouseShot(0,{capture:true});assert.equal(await score('#p1'),1);assert.equal(await score('#p2'),0);
 await mouseShot(0,{duration:600});assert.equal(await score('#p1'),2);assert.match(await page.locator('#accuracy0').textContent(),/2\/2/);assert.equal(await score('#streak0'),2);
 await mouseShot(1,{duration:220});assert.equal(await score('#p2'),1);
 await page.clock.runFor(3000);await mouseShot(1);assert.equal(await score('#p2'),3);
 await page.clock.runFor(8500);await mouseShot(0);assert.equal(await score('#p1'),5);
 await page.clock.runFor(11000);assert.equal(await score('#timer'),0);assert.equal(await score('#best0'),5);
 await mouseShot(0);assert.equal(await score('#p1'),5);
 // Both keyboard players remain available as a fallback.
 await start();await page.keyboard.down('a');await page.keyboard.down('ArrowRight');await page.clock.runFor(680);await page.keyboard.up('a');await page.keyboard.up('ArrowRight');
 await page.keyboard.down('w');await page.keyboard.down('ArrowUp');await page.clock.runFor(450);await page.keyboard.up('w');await page.keyboard.up('ArrowUp');
 await page.clock.runFor(2200);assert.equal(await score('#p1'),1);assert.equal(await score('#p2'),1);
 await start();await page.keyboard.press('w');await page.clock.runFor(2200);assert.equal(await score('#p1'),0);
 const box=await page.locator('#court').boundingBox();await page.mouse.move(box.x+584*box.width/800,box.y+RACK_Y*box.height/COURT_HEIGHT);await page.mouse.down();await page.clock.runFor(450);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();assert.match(await page.locator('#accuracy1').textContent(),/^0\/0/);
 assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'true');await page.locator('#sound').click();assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'false');await page.locator('#sound').click();
 // A wide mouse throw remains visible beyond the court and has no click outline.
 await start();
 {const r=await page.locator('#court').boundingBox(),at=(x,y)=>({x:r.x+x*r.width/800,y:r.y+y*r.height/COURT_HEIGHT});
 const a=at(216,RACK_Y);await page.mouse.move(a.x,a.y);await page.mouse.down();
 for(let i=1;i<=14;i++){await page.clock.runFor(25);const p=at(216-240*i/14,RACK_Y-240*i/14);await page.mouse.move(p.x,p.y);}
 await page.mouse.up();await page.clock.runFor(1250);
 assert.equal(await page.locator('#court').evaluate(el=>getComputedStyle(el).outlineStyle),'none');
 const visibleOutside=await page.evaluate(()=>{
  const court=document.querySelector('#court').getBoundingClientRect(),c=document.querySelector('#loose-balls'),ctx=c.getContext('2d'),ratio=c.width/innerWidth;
  const data=ctx.getImageData(0,0,Math.max(1,Math.floor(court.left*ratio)),c.height).data;
  let pixels=0;for(let i=3;i<data.length;i+=4)if(data[i]>40)pixels++;return pixels;
 });assert.ok(visibleOutside>20,'escaped ball visible beyond the machine');
 await page.screenshot({path:'/tmp/hoops-escape.png',fullPage:true});}
 await page.reload();assert.equal(await score('#best0'),5);await page.clock.runFor(32);await page.screenshot({path:'/tmp/hoops-desktop.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 // Desktop controls live in the TV beside a larger court; furniture may crop.
 await page.locator('.office-seating').evaluate(el=>el.decode());
 const room=await page.locator('.office-seating').boundingBox(),machine=await page.locator('.machine').boundingBox(),panel=await page.locator('.panel').boundingBox();
 assert.ok(room.x>=machine.x+machine.width);
 assert.ok(panel.x>machine.x+machine.width,'TV controls sit beside the court');
 assert.ok(Math.abs(machine.width-521.6)<1,'desktop scene is 80% of its previous size');
 const tvScreen=await page.locator('.tv-screen').boundingBox();
 assert.ok(tvScreen.x+tvScreen.width<=1366,'TV controls remain on screen even when the television crops');
 assert.ok(panel.x>=machine.x+machine.width*1.05,'TV clears the entire projected side net');
 assert.ok(Math.abs((machine.x+machine.width/2)/1366-.43)<.01,'machine is anchored near the centre');
 assert.ok(machine.x>200,'leave the mural visible');
 assert.ok(Math.abs(panel.width/machine.width-.92)<.01,'TV scales with the machine');
 assert.equal(await page.locator('.panel').evaluate(el=>Boolean(el.closest('[aria-hidden="true"]'))),false,'TV controls are accessible');
 assert.equal(await page.locator('.tv-screen').evaluate(el=>el.scrollWidth>el.clientWidth||el.scrollHeight>el.clientHeight),false,'compact controls fit the screen');
 await page.locator('.instructions>summary').focus();await page.keyboard.press('Enter');
 assert.equal(await page.locator('.instructions').evaluate(el=>el.open),true,'instructions open from the keyboard');
 await page.keyboard.press('Enter');
 for(const [width,height]of [[1024,768],[1280,800],[1995,1248]]){
  await page.setViewportSize({width,height});await page.clock.runFor(32);
  const tv=await page.locator('.tv-screen').boundingBox();
  assert.ok(tv.x+tv.width<=width,'TV controls remain visible');
  assert.equal(await page.locator('.tv-screen').evaluate(el=>el.scrollWidth>el.clientWidth||el.scrollHeight>el.clientHeight),false);
  const court=await page.locator('#court').boundingBox();
  assert.ok(court.y+RACK_Y*court.width/800<height,'balls stay reachable without scrolling');
 }
 await page.setViewportSize({width:1366,height:900});await page.clock.runFor(32);
 const backdrop=await page.locator('.court-backdrop').boundingBox(),display=await page.locator('.scoreboard').boundingBox();
 assert.ok(display.width<backdrop.width*.12,'compact display');
 await page.setViewportSize({width:390,height:844});await page.clock.runFor(32);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/hoops-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 const mobileMachine=await page.locator('.machine').boundingBox(),mobilePanel=await page.locator('.panel').boundingBox();
 assert.ok(mobilePanel.y>=mobileMachine.y+mobileMachine.height,'mobile controls stay below the machine');
 // Actual touch gestures, using the same shot mapping and a high-DPI canvas.
 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
 await mobile.clock.install({time:instant});await mobile.clock.pauseAt(instant);
 await mobile.addInitScript(()=>{
  const NativeAudio=window.Audio;
  window.Audio=function(src){const element=new NativeAudio(src);window.testMediaAudio=element;return element;};
  const NativeContext=window.AudioContext;
  window.AudioContext=class extends NativeContext{constructor(...args){super(...args);window.testAudioContext=this;}};
 });
 await mobile.goto('http://localhost:8765/basketball/');
 // A native touch on the court must unlock free-play audio, without Start.
 await mobile.locator('#court').tap({position:{x:20,y:20}});
 await mobile.clock.runFor(32);
 assert.equal(await mobile.evaluate(()=>window.testAudioContext?.state),'running','touch activates audio in free play');
 const media=await mobile.evaluate(async()=>{
  const audio=window.testMediaAudio;
  if(audio.readyState<2)await new Promise(resolve=>audio.addEventListener('loadeddata',resolve,{once:true}));
  return{paused:audio.paused,loop:audio.loop,muted:audio.muted,duration:audio.duration};
 });
 assert.deepEqual(media,{paused:false,loop:true,muted:false,duration:1},'iPhone channel has a playing silent media track');
 await mobile.locator('#sound').tap();assert.equal(await mobile.evaluate(()=>window.testMediaAudio.paused),true,'mute stops media track');
 await mobile.locator('#test-sound').tap();
 await mobile.clock.runFor(100);
 assert.match(await mobile.locator('#message').textContent(),/^Playing a test bounce/);
 assert.equal(await mobile.evaluate(()=>window.testMediaAudio.paused),false,'sound check reactivates the media channel');
 await mobile.locator('#start').tap();
 const rect=await mobile.locator('#court').boundingBox(),session=await mobile.context().newCDPSession(mobile);
 const touch=(x,y)=>({x:rect.x+x*rect.width/800,y:rect.y+y*rect.height/COURT_HEIGHT});
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(584,RACK_Y)]});
 for(let i=1;i<=14;i++){await mobile.clock.runFor(25);await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(584,RACK_Y-240*i/14)]});}
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mobile.clock.runFor(2300);assert.equal(Number(await mobile.locator('#p2').textContent()),1);
 // Render sound events offline: distinct envelopes, non-silent, no clipping.
 const soundCheck=await page.evaluate(async()=>{
  const{CourtAudio}=await import('./sound.mjs?v=11'),summary={};
  for(const type of ['swish','net','rim','board','bounce','sensor','return']){
   const context=new OfflineAudioContext(2,44100*.6,44100),sound=new CourtAudio(context);sound.enabled=true;await sound.loadSamples();if(['rim','sensor','return','bounce'].includes(type)&&!sound.samples[type]?.length)throw new Error('Missing recording: '+type);sound.play(type,.8,.4);
   const buffer=await context.startRendering(),data=buffer.getChannelData(0);let energy=0,peak=0;for(const value of data){energy+=value*value;peak=Math.max(peak,Math.abs(value));}
   summary[type]={energy,peak};
  }return summary;
 });
 for(const [type,result]of Object.entries(soundCheck)){assert.ok(result.energy>.001,type+' audible');assert.ok(result.peak<1,type+' unclipped');}
 assert.deepEqual(errors,[]);
 assert.ok(soundCheck.return.energy<soundCheck.sensor.energy*.1,'fabric return stays quiet');
 console.log('Natural mouse/touch throws, shifted rack, physics/preview, nets, spin, audio, scores and keyboard fallback passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
