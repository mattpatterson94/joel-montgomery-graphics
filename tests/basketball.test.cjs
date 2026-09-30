// Serve repository on :8765. NODE_PATH includes Playwright; CHROMIUM_PATH optional.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const physics=await import('../basketball/physics.mjs');
 const {pointsAt,remaining,makeBall,stepBall,project,RIM_Y,HOOPS,hoopWorldX,chargePower,rackX}=physics;
 const {gestureBall,heldPosition,previewArc,releaseSpeed}=await import('../basketball/gestures.mjs');
 const {netShape}=await import('../basketball/net.mjs');
 const aimFor=(lane,x)=> (hoopWorldX(lane)-x)/1.65;
 function flight(ball,fps=120){const hits=[];for(let i=0;i<fps*5;i++){const hit=stepBall(ball,1/fps);if(hit!==-1)hits.push(hit);}return{ball,hits};}
 function gesture(lane,origin,dx=0,dy=240,duration=350,steps=14){return{lane,origin,start:{x:origin,y:684},end:{x:origin+dx,y:684-dy},samples:Array.from({length:steps+1},(_,i)=>({x:origin+dx*i/steps,y:684-dy*i/steps,t:duration*i/steps}))};}
 assert.equal(pointsAt(30),1);assert.equal(pointsAt(20.001),1);assert.equal(pointsAt(20),2);assert.equal(pointsAt(10),3);assert.equal(pointsAt(0),0);assert.equal(remaining(30000,31000),0);
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
 const preview=previewArc(shot),t=.035;
 assert.ok(Math.abs(preview[0].h-(shot.h+shot.vh*t-900*t*t))<.001);
 assert.ok(preview.length<15,'guide stops before the landing');
 const arc=gestureBall(g,350);for(let i=0;i<75;i++)stepBall(arc,1/120);assert.ok(project(arc.x,arc.h,arc.z).y<RIM_Y-30);
 const spin=makeBall(0,-75,280,1),original=[...spin.spin];stepBall(spin,.1);assert.ok(spin.spin.filter((v,i)=>v!==original[i]).length>=2,'multi-axis spin');
 const bank=flight(makeBall(0,aimFor(0,216),350,1));assert.ok(bank.ball.bankHits>0);
 const rim=flight(makeBall(0,aimFor(0,216)+35,280,1));assert.ok(rim.ball.rimHits>0);assert.ok(rim.ball.grounded);
 const reaction={time:0,ball:{h:100,entry:{swish:true,x:0}}};assert.equal(netShape(reaction,180,0).stretch,0,'net anchors stay fixed');assert.ok(netShape(reaction,180,1).stretch>5);assert.equal(netShape(reaction,2000,1).stretch,0,'net settles');
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const instant=new Date('2026-09-30T00:00:00Z');await page.clock.install({time:instant});await page.clock.pauseAt(instant);
 const response=page.waitForResponse(r=>r.url().endsWith('backboard-reference.png'));
 await page.goto('http://localhost:8765/basketball/');assert.equal((await response).status(),200);
 const score=async id=>Number(await page.locator(id).textContent());
 const shots=[0,0];
 async function start(){await page.locator('#start').click();shots.fill(0);}
 async function mouseShot(lane,{dy=240,duration=350,correctAim=true,capture=false}={}){
  const box=await page.locator('#court').boundingBox(),origin=rackX(lane,shots[lane]);
  const point=(x,y)=>({x:box.x+x*box.width/800,y:box.y+y*box.height/800});
  const dx=correctAim?(HOOPS[lane]-origin)/1.243:120,a=point(origin,684);
  await page.mouse.move(a.x,a.y);await page.mouse.down();
  for(let i=1;i<=14;i++){await page.clock.runFor(duration/14);const p=point(origin+dx*i/14,684-dy*i/14);await page.mouse.move(p.x,p.y);}
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
 const box=await page.locator('#court').boundingBox();await page.mouse.move(box.x+584*box.width/800,box.y+684*box.height/800);await page.mouse.down();await page.clock.runFor(450);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();assert.match(await page.locator('#accuracy1').textContent(),/^0\/0/);
 await page.locator('#sound').click();assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'true');await page.locator('#sound').click();
 await page.reload();assert.equal(await score('#best0'),5);await page.clock.runFor(32);await page.screenshot({path:'/tmp/hoops-desktop.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.setViewportSize({width:390,height:844});await page.clock.runFor(32);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/hoops-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 // Actual touch gestures, using the same shot mapping and a high-DPI canvas.
 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true});
 await mobile.clock.install({time:instant});await mobile.clock.pauseAt(instant);
 await mobile.goto('http://localhost:8765/basketball/');await mobile.locator('#start').tap();
 const rect=await mobile.locator('#court').boundingBox(),session=await mobile.context().newCDPSession(mobile);
 const touch=(x,y)=>({x:rect.x+x*rect.width/800,y:rect.y+y*rect.height/800});
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(584,684)]});
 for(let i=1;i<=14;i++){await mobile.clock.runFor(25);await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(584,684-240*i/14)]});}
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mobile.clock.runFor(2300);assert.equal(Number(await mobile.locator('#p2').textContent()),1);
 // Render sound events offline: distinct envelopes, non-silent, no clipping.
 const soundCheck=await page.evaluate(async()=>{
  const{CourtAudio}=await import('./sound.mjs?v=4'),summary={};
  for(const type of ['swish','net','rim','board','bounce']){
   const context=new OfflineAudioContext(2,44100*.6,44100),sound=new CourtAudio(context);sound.enabled=true;sound.play(type,.8,.4);
   const buffer=await context.startRendering(),data=buffer.getChannelData(0);let energy=0,peak=0;for(const value of data){energy+=value*value;peak=Math.max(peak,Math.abs(value));}
   summary[type]={energy,peak};
  }return summary;
 });
 for(const [type,result]of Object.entries(soundCheck)){assert.ok(result.energy>.001,type+' audible');assert.ok(result.peak<1,type+' unclipped');}
 assert.deepEqual(errors,[]);
 console.log('Natural mouse/touch throws, shifted rack, physics/preview, nets, spin, audio, scores and keyboard fallback passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
