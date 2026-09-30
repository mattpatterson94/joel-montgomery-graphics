// Serve repository on :8765. NODE_PATH includes Playwright; CHROMIUM_PATH optional.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const physics=await import('../basketball/physics.mjs');
 const {pointsAt,remaining,makeBall,stepBall,project,RIM_Y,HOOPS,hoopWorldX,chargePower,rackX}=physics;
 const aimFor=(lane,x)=> (hoopWorldX(lane)-x)/1.65;
 function flight(lane,aim,power,origin=HOOPS[lane],fps=120){const ball=makeBall(lane,aim,power,1,origin),hits=[];for(let i=0;i<fps*5;i++){const hit=stepBall(ball,1/fps);if(hit!==-1)hits.push(hit);}return{ball,hits};}
 assert.equal(pointsAt(30),1);assert.equal(pointsAt(20.001),1);assert.equal(pointsAt(20),2);assert.equal(pointsAt(10),3);assert.equal(pointsAt(0),0);assert.equal(remaining(30000,31000),0);
 assert.equal(chargePower(0),210);assert.equal(chargePower(450),280);assert.equal(chargePower(900),350);assert.equal(chargePower(1800),210);
 for(const lane of [0,1]){
  const aim=aimFor(lane,HOOPS[lane]);
  for(const fps of [30,60,144])assert.deepEqual(flight(lane,aim,280,HOOPS[lane],fps).hits,[lane]);
  assert.deepEqual(flight(lane,0,280).hits,[],'correct power without aim misses');
  assert.deepEqual(flight(lane,aim,chargePower(0)).hits,[],'quick tap cannot auto-score');
  const next=rackX(lane,1);assert.notEqual(next,HOOPS[lane]);assert.deepEqual(flight(lane,aimFor(lane,next),280,next).hits,[lane]);
 }
 assert.ok(Math.abs(project(216,173,1).radius-24)<.001);
 const approach=makeBall(0,aimFor(0,HOOPS[0]),280,1);for(let i=0;i<90;i++)stepBall(approach,1/120);
 assert.ok(project(approach.x,approach.h,approach.z).y<RIM_Y-30);
 const bank=flight(0,aimFor(0,HOOPS[0]),350);assert.ok(bank.ball.bankHits>0);
 const rim=flight(0,aimFor(0,HOOPS[0])+35,280);assert.ok(rim.ball.rimHits>0);
 assert.ok(rim.ball.grounded,'floor rebounds settle');
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const instant=new Date('2026-09-30T00:00:00Z');await page.clock.install({time:instant});await page.clock.pauseAt(instant);
 const response=page.waitForResponse(r=>r.url().endsWith('backboard-reference.png'));
 await page.goto('http://localhost:8765/basketball/');assert.equal((await response).status(),200);
 const score=async id=>Number(await page.locator(id).textContent());
 const aim=[0,0],shots=[0,0];
 async function start(){await page.locator('#start').click();aim.fill(0);shots.fill(0);}
 async function mouseShot(lane,{hold=450,correctAim=true}={}){
  const box=await page.locator('#court').boundingBox(),origin=rackX(lane,shots[lane]);
  const point=(x,y)=>({x:box.x+x*box.width/800,y:box.y+y*box.height/800});
  const target=correctAim?aimFor(lane,origin):aim[lane];
  const a=point(origin,684),b=point(origin+target-aim[lane],684);
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y);
  await page.clock.runFor(hold);await page.mouse.up();aim[lane]=target;shots[lane]++;
  await page.clock.runFor(2200);
 }
 await mouseShot(0);assert.equal(await score('#p1'),0,'practice stays unscored');
 await start();await mouseShot(0,{hold:0,correctAim:false});assert.equal(await score('#p1'),0);
 await start();await mouseShot(0,{correctAim:false});assert.equal(await score('#p1'),0,'timing alone is insufficient');
 await start();await mouseShot(0);assert.equal(await score('#p1'),1);assert.equal(await score('#p2'),0);
 await mouseShot(0);assert.equal(await score('#p1'),2,'mouse re-aims from shifted rack');
 assert.match(await page.locator('#accuracy0').textContent(),/2\/2/);assert.equal(await score('#streak0'),2);
 await mouseShot(1);assert.equal(await score('#p2'),1);
 await page.clock.runFor(2500);await mouseShot(1);assert.equal(await score('#p2'),3,'double points');
 await page.clock.runFor(8500);await mouseShot(0);assert.equal(await score('#p1'),5,'triple points');
 await page.clock.runFor(11000);assert.equal(await score('#timer'),0);assert.equal(await score('#best0'),5);
 await mouseShot(0);assert.equal(await score('#p1'),5,'after buzzer score freezes');
 // Both keyboard players can aim and charge concurrently.
 await start();await page.keyboard.down('a');await page.keyboard.down('ArrowRight');await page.clock.runFor(680);await page.keyboard.up('a');await page.keyboard.up('ArrowRight');
 await page.keyboard.down('w');await page.keyboard.down('ArrowUp');await page.clock.runFor(450);await page.screenshot({path:'/tmp/hoops-desktop-charge.png',fullPage:true});await page.keyboard.up('w');await page.keyboard.up('ArrowUp');
 await page.clock.runFor(2200);assert.equal(await score('#p1'),1);assert.equal(await score('#p2'),1);
 // Quick keyboard release cannot reuse the old guaranteed shot.
 await start();await page.keyboard.press('w');await page.clock.runFor(2200);assert.equal(await score('#p1'),0);
 // Cancelled pointer gestures and blur don't fire shots.
 const box=await page.locator('#court').boundingBox();await page.mouse.move(box.x+rackX(1,0)*box.width/800,box.y+684*box.height/800);await page.mouse.down();await page.clock.runFor(450);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();assert.match(await page.locator('#accuracy1').textContent(),/^0\/0/);
 await page.locator('#sound').click();assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'true');await page.locator('#sound').click();
 await page.reload();assert.equal(await score('#best0'),5,'best persists across reload');
 await page.clock.runFor(30);await page.screenshot({path:'/tmp/hoops-desktop.png',fullPage:true});
 assert.ok(await page.locator('#start').isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.setViewportSize({width:390,height:844});await page.clock.runFor(30);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/hoops-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 await mobile.goto('http://localhost:8765/basketball/');await mobile.locator('#start').tap();
 const rect=await mobile.locator('#court').boundingBox(),session=await mobile.context().newCDPSession(mobile);
 const touch=(x,y)=>({x:rect.x+x*rect.width/800,y:rect.y+y*rect.height/800});
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(584,684)]});
 await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(584+aimFor(1,584),404)]});
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await mobile.waitForFunction(()=>Number(document.querySelector('#p2').value)===1);
 console.log('Physics, desktop aim/timing, two-player keyboard, touch, timer, stats and persistence passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
