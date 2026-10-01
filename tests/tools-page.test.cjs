// Serve the repository at :8765; use Playwright and optional CHROMIUM_PATH.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));await page.goto('http://localhost:8765/tools/');
  const cards=page.locator('nav > a');assert.equal(await cards.count(),4);
  const expected=['Shape Mask Converter','Stretch & Repeat Converter','Repeating Shape Converter','Stretchable Shape Converter'];
  for(let i=0;i<4;i++)assert.equal((await cards.nth(i).innerText()).replace(/\s+/g,' ').trim(),expected[i]);
  const a=await cards.nth(0).boundingBox(),b=await cards.nth(1).boundingBox(),c=await cards.nth(2).boundingBox();
  assert.equal(a.y,b.y);assert.ok(b.x>a.x);assert.equal(a.x,c.x);assert.ok(c.y>a.y);
  const before=(await page.locator('.card').boundingBox()).height;
  await page.clock.runFor(9999);assert.equal(await page.locator('a[href="../basketball/"]').count(),0);
  await page.screenshot({path:'/tmp/tools-before.png',fullPage:true});
  await page.clock.runFor(101);assert.equal(await page.locator('a[href="../basketball/"]').count(),1);
  const during=(await page.locator('.card').boundingBox()).height;
  await page.clock.runFor(1000);
  // Web Animations use the compositor clock; allow the real 600ms transition to finish.
  await new Promise(resolve=>setTimeout(resolve,750));
  const secret=page.locator('a[href="../basketball/"]'),box=await secret.boundingBox();
  const after=(await page.locator('.card').boundingBox()).height;
  assert.ok(Math.abs(after-before-box.height-16)<1);assert.ok(during>=before&&during<after);
  assert.equal(box.x,a.x);assert.ok(Math.abs(box.width-(b.x+b.width-a.x))<1);
  await page.locator('nav img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
  assert.equal(await page.locator('nav img').count(),5);
  assert.equal(await page.locator('nav img').evaluateAll(imgs=>imgs.every(img=>img.naturalWidth>0)),true);
  await page.screenshot({path:'/tmp/tools-after.png',fullPage:true});
  await cards.first().focus();assert.equal(await cards.first().evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
  for(const width of [375,620,700]){
   await page.setViewportSize({width,height:950});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(width===375){const first=await cards.nth(0).boundingBox(),second=await cards.nth(1).boundingBox();assert.equal(first.x,second.x);assert.ok(second.y>first.y);await page.screenshot({path:'/tmp/tools-mobile.png',fullPage:true});}
  }
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.clock.runFor(10001);
  assert.equal(await page.locator('a[href="../basketball/"]').count(),1);
  assert.equal(await page.locator('.secret-reveal').evaluate(el=>el.getAnimations({subtree:true}).length),0);
  assert.deepEqual(errors,[]);console.log('PASS: two columns, titles, icons, 10-second reveal, animated card expansion, full-width bonus, keyboard focus, mobile and reduced motion.',{before,during,after});
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
