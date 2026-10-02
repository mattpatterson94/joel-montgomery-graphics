// Serve repository on :8765; Playwright plus optional CHROMIUM_PATH.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();await page.goto('http://localhost:8765/');await page.locator('body').click();
  const result=await page.evaluate(async()=>{
   const {CourtAudio}=await import('/basketball/sound.mjs');
   const results=[];
   for(const type of ['start','three','countdown','end','board']){
    const context=new OfflineAudioContext(2,22050*3,22050),audio=new CourtAudio(context);
    await audio.loadSamples();audio.play(type,1);
    const status=audio.lastPlayback,duration=audio.samples[type]?.[0]?.duration;
    const rendered=await context.startRendering(),data=rendered.getChannelData(0);
    let sum=0,peak=0;for(const sample of data){sum+=sample*sample;peak=Math.max(peak,Math.abs(sample));}
    results.push({type,status,duration,rms:Math.sqrt(sum/data.length),peak,voices:audio.voices,active:audio.roundSources.size});
   }
   // Exercise stopping a real decoded cue, rather than only mocking the timer.
   const ctx=new AudioContext(),audio=new CourtAudio(ctx);await ctx.resume();await audio.loadSamples();
   audio.play('start',1);const active=audio.roundSources.size;audio.setEnabled(false);
   await new Promise(resolve=>setTimeout(resolve,100));
   const stopped=audio.roundSources.size===0&&audio.voices===0;await ctx.close();
   return{results,active,stopped};
  });
  for(const r of result.results){assert.equal(r.status,'recording scheduled');assert.ok(r.duration>.3);assert.ok(r.rms>.001);assert.ok(r.peak<1);assert.equal(r.voices,0);assert.equal(r.active,0);}
  assert.equal(result.active,1);assert.equal(result.stopped,true);
  console.log('PASS: all five recordings decode, render non-silent audio, release their nodes, and stop on mute.',result.results);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
