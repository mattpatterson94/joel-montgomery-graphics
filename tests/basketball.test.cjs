// Serve repository on :8765. NODE_PATH must include Playwright; CHROMIUM_PATH is optional.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const {pointsAt,remaining,makeBall,stepBall,project,RIM_Y}=await import('../basketball/physics.mjs');
 assert.equal(pointsAt(30),1);assert.equal(pointsAt(20.001),1);assert.equal(pointsAt(20),2);assert.equal(pointsAt(10),3);assert.equal(pointsAt(0),0);assert.equal(remaining(30000,31000),0);
 for(const lane of [0,1]){const ball=makeBall(lane,0,280,1);const hits=[];for(let i=0;i<240;i++){const hit=stepBall(ball,1/120);if(hit!==-1)hits.push(hit);}assert.deepEqual(hits,[lane]);}
 assert.ok(Math.abs(project(216,173,1).radius-24)<.001);
 const approach=makeBall(0,0,280,1);for(let i=0;i<90;i++)stepBall(approach,1/120);
 assert.ok(project(approach.x,approach.h,approach.z).y<RIM_Y-30,'arc rises above the hoop');
 assert.ok(project(approach.x,approach.h,approach.z).radius>26,'approaching ball keeps perspective size');
 // A shot can pass the hoop's screen position but miss in depth.
 const short=makeBall(0,0,180,1);for(let i=0;i<360;i++)assert.equal(stepBall(short,1/120),-1);
 const miss=makeBall(0,150,300,1);for(let i=0;i<240;i++)assert.equal(stepBall(miss,1/120),-1);
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1000,height:1050}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();
 const boardResponse=page.waitForResponse(r=>r.url().endsWith('backboard-reference.png'));
 await page.goto('http://localhost:8765/basketball/');assert.equal((await boardResponse).status(),200);
 const score=async id=>Number(await page.locator(id).textContent());
 async function shoot(key){await page.keyboard.press(key);await page.clock.runFor(1800);}
 await shoot('a');assert.equal(await score('#p1'),0,'practice stays unscored');
 await page.locator('#start').click();await shoot('a');assert.equal(await score('#p1'),1);assert.equal(await score('#p2'),0);
 await shoot('l');assert.equal(await score('#p2'),1);
 await page.clock.runFor(6500);assert.match(await page.locator('#multiplier').textContent(),/^2 /);
 await shoot('l');assert.equal(await score('#p2'),3);
 await page.clock.runFor(10000);await shoot('a');assert.equal(await score('#p1'),4);
 await page.clock.runFor(9000);assert.equal(await score('#timer'),0);
 await shoot('a');assert.equal(await score('#p1'),4,'after buzzer score is frozen');
 await page.locator('#start').click();assert.equal(await score('#p1'),0);assert.equal(await score('#p2'),0);
 // Actual mouse swipe from the left ball; canvas coordinates mapped to CSS size.
 const box=await page.locator('#court').boundingBox();const point=(x,y)=>({x:box.x+x*box.width/800,y:box.y+y*box.height/800});
 const a=point(220,684),b=point(220,404);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();await page.clock.runFor(800);await page.screenshot({path:'/tmp/hoops-arc.png'});await page.clock.runFor(300);await page.screenshot({path:'/tmp/hoops-rim.png'});await page.clock.runFor(700);assert.equal(await score('#p1'),1);
 await page.screenshot({path:'/tmp/hoops-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'/tmp/hoops-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 await mobile.goto('http://localhost:8765/basketball/');await mobile.locator('#start').tap();
 const rect=await mobile.locator('#court').boundingBox(),session=await mobile.context().newCDPSession(mobile);
 const touch=(y)=>({x:rect.x+580*rect.width/800,y:rect.y+y*rect.height/800});
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(684)]});
 await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(404)]});
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await mobile.waitForFunction(()=>Number(document.querySelector('#p2').value)===1);
 console.log('Basketball physics, scores, timer, mouse, touch and responsive checks passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
