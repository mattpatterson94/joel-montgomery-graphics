// Run with a local server on :8765, Playwright in NODE_PATH and optional CHROMIUM_PATH.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox'],headless:true});
 try{
 const page=await browser.newPage();await page.goto('http://localhost:8765/tools/shape-mask/');
 const checks=await page.evaluate(async()=>{
  async function render(source,selected){
   const data=await ShapeMask.inspect(source), choices=new Set(selected);
   const blob=await ShapeMask.thumbnail(data,choices);
   const image=await createImageBitmap(blob);const c=document.createElement('canvas');c.width=c.height=240;
   const ctx=c.getContext('2d');ctx.drawImage(image,0,0);
   return {size:[image.width,image.height],pixel:(x,y)=>[...ctx.getImageData(x,y,1,1).data],output:ShapeMask.build(data,choices)};
  }
  const pattern=new Image();pattern.src='shapeMaskBackground.png';await pattern.decode();
  const c=document.createElement('canvas');c.width=c.height=240;const ctx=c.getContext('2d');ctx.drawImage(pattern,0,0,240,240);
  const pixel=(x,y)=>[...ctx.getImageData(x,y,1,1).data];
  const wide=await render('<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 20 240 120"><rect x="10" y="20" width="70" height="120"/><g transform="translate(100 20) scale(2)"><rect width="75" height="60"/></g><rect x="200" y="30" width="15" height="15" fill="red"/></svg>',[0,1]);
  const tall=await render('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 240"><rect width="120" height="240"/></svg>',[0]);
  const hole=await render('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><path fill-rule="evenodd" d="M0 0H240V240H0Z M80 80V160H160V80Z"/></svg>',[0]);
  return {size:wide.size,wideTop:wide.pixel(20,10),wideGap:wide.pixel(80,100),wideSamples:[[wide.pixel(20,90),pixel(20,90)],[wide.pixel(110,100),pixel(110,100)],[wide.pixel(220,150),pixel(220,150)]],solid:wide.pixel(195,75),tallSide:tall.pixel(10,100),tallSample:[tall.pixel(100,100),pixel(100,100)],hole:hole.pixel(120,120),svgClean:!wide.output.includes('data:image')&&wide.output.includes('xlink:href=""')};
 });
 assert.deepEqual(checks.size,[240,240]);assert.equal(checks.wideTop[3],0);assert.equal(checks.wideGap[3],0);assert.equal(checks.tallSide[3],0);assert.equal(checks.hole[3],0);assert.deepEqual(checks.solid,[255,0,0,255]);assert.ok(checks.svgClean);
 for(const [actual,expected] of [...checks.wideSamples,checks.tallSample])actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<=2,JSON.stringify({actual,expected})));
 const downloads=[];page.on('download',d=>downloads.push(d));
 const source='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 120"><rect width="80" height="120"/></svg>';
 await page.locator('#file-input').setInputFiles({name:'tile.svg',mimeType:'image/svg+xml',buffer:Buffer.from(source)});
 await page.waitForFunction(()=>document.getElementById('status').textContent.includes('downloads started'));
 assert.deepEqual(downloads.map(d=>d.suggestedFilename()).sort(),['tile-processed.svg','tile-thumbnail.png']);
 await page.locator('#mode-switcher').click();await page.locator('#file-input').setInputFiles({name:'advanced.svg',mimeType:'image/svg+xml',buffer:Buffer.from(source)});await page.locator('#editor').waitFor({state:'visible'});
 await page.locator('.shape-row').click();await page.locator('#download').click();await page.waitForFunction(()=>document.getElementById('status').textContent==='SVG and PNG downloads started.');
 assert.equal(downloads.length,4);assert.deepEqual(downloads.slice(2).map(d=>d.suggestedFilename()).sort(),['advanced-processed.svg','advanced-thumbnail.png']);
 const again=page.waitForEvent('download');await page.locator('#download-thumbnail').click();assert.equal((await again).suggestedFilename(),'advanced-thumbnail.png');
 console.log('PASS: shared pattern including transformed masks, wide/tall transparent padding, solid artwork, compound holes, clean SVG and paired downloads in both modes.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
