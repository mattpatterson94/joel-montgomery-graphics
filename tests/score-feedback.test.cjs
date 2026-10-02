// Serve repository on :8765. Browser harness injects a ball just above a hoop.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/game.js?*',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync('score-update/basketball/game.js','utf8')+`
   window.feedbackTest={audio,scoreboard,score(){const b=makeBall(0,0,280,running?round:-1);Object.assign(b,{x:400+(HOOPS[0]-400)/.6,z:1,h:241,vh:-180,vx:0,vz:0});balls.push(b);},end(){deadline=performance.now();sync(performance.now());},off(){scoreboard.update(scoreboard.finishedAt+8000);}};
  `}));
  await page.goto('http://localhost:8765/basketball/');await page.waitForFunction(()=>window.feedbackTest);
  const visibility=()=>page.locator('#p1').evaluate(el=>getComputedStyle(el).visibility);
  assert.equal(await visibility(),'hidden');
  await page.evaluate(()=>{const a=feedbackTest.audio;window.scoreBeeps=0;const play=a.play.bind(a);a.play=(type,...args)=>{if(type==='score')scoreBeeps++;play(type,...args);};feedbackTest.score();});
  await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>scoreBeeps),0);
  await page.locator('#start').click();assert.equal(await visibility(),'visible');
  await page.evaluate(()=>feedbackTest.score());await page.waitForFunction(()=>scoreBeeps===1);
  assert.equal(await page.locator('#p1').innerText(),'01');
  await page.evaluate(()=>feedbackTest.end());assert.equal(await page.locator('.scoreboard').getAttribute('data-state'),'final');
  await page.waitForTimeout(550);assert.equal(await visibility(),'hidden');
  await page.waitForTimeout(500);assert.equal(await visibility(),'visible');
  await page.evaluate(()=>feedbackTest.score());await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>scoreBeeps),1);
  await page.evaluate(()=>feedbackTest.off());assert.equal(await visibility(),'hidden');
  await page.locator('#start').click();assert.equal(await visibility(),'visible');
  await page.screenshot({path:'/tmp/score-live.png',fullPage:true});
  const audio=await page.evaluate(async()=>{
   const {CourtAudio}=await import('/basketball/sound.mjs?v=23');const result={};
   for(const type of ['score','floor']){
    const ctx=new OfflineAudioContext(1,22050,22050),a=new CourtAudio(ctx);await a.loadSamples();a.play(type,1);
    const status=a.lastPlayback,b=await ctx.startRendering(),samples=b.getChannelData(0);let energy=0;for(const n of samples)energy+=n*n;
    result[type]={status,rms:Math.sqrt(energy/samples.length)};
   }return result;
  });
  assert.equal(audio.score.status,'recording scheduled');assert.equal(audio.floor.status,'generated sound scheduled');
  assert.ok(audio.score.rms>0.001);assert.ok(audio.floor.rms>0&&audio.floor.rms<audio.score.rms);
  assert.deepEqual(errors,[]);console.log('PASS: live-round-only score beep, scoreboard states, restart, decoded beep and quiet carpet thud.',audio);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
