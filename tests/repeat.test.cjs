// Start an HTTP server at :8765. NODE_PATH supplies Playwright; CHROMIUM_PATH is optional.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox'],headless:true});
 try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(process.env.JQUERY_PATH)await page.route('https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js',route=>route.fulfill({path:process.env.JQUERY_PATH,contentType:'application/javascript'}));
 await page.goto('http://localhost:8765/tools/repeat/');
 const source=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 20 80 60"><style>.paint{fill:url(#PATTERN)} .shift{transform:translate(3px,2px)}</style><defs><linearGradient id="PATTERN"><stop stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient><clipPath id="cut"><circle cx="45" cy="48" r="24"/></clipPath><mask id="mask"><rect x="10" y="20" width="80" height="60" fill="white"/></mask><path id="REPEAT_X" d="M15 25h25v20H15z"/><pattern id="dots" patternUnits="userSpaceOnUse" width="8" height="8"><circle cx="4" cy="4" r="2" fill="green"/></pattern></defs><g opacity=".7" mask="url(#mask)"><g clip-path="url(#cut)"><rect x="10" y="20" width="80" height="60" class="paint"/><g class="shift"><use href="#REPEAT_X" fill="yellow"/></g></g><rect x="62" y="25" width="20" height="40" fill="url(#dots)"/></g></svg>`;
 const result=await page.evaluate(async source=>{
  const model=await RepeatMaker.inspect(source);
  async function pixels(text,width){
   const image=new Image();image.src='data:image/svg+xml;base64,'+btoa(text);await image.decode();
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=60;
   const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,width,60);return ctx.getImageData(0,0,width,60).data;
  }
  const original=await pixels(source,80);
  const output=RepeatMaker.build(model,280);const simulated=RepeatMaker.build(model,280,true);
  const diffs=[];
  for(const text of [output,simulated]){
   const actual=await pixels(text,280);let max=0,total=0;
   for(let y=0;y<60;y++)for(let x=0;x<280;x++)for(let c=0;c<4;c++){
    const d=Math.abs(actual[(y*280+x)*4+c]-original[(y*80+x%80)*4+c]);max=Math.max(max,d);total+=d;
   }
   diffs.push({max,total});
  }
  const doc=new DOMParser().parseFromString(output,'image/svg+xml');
  return {diffs,width:model.width,height:model.height,defs:doc.documentElement.querySelectorAll(':scope > defs').length,first:doc.querySelector('defs').firstElementChild.id,patterns:doc.querySelectorAll('[id="PATTERN"]').length,repeats:doc.querySelectorAll('[id="REPEAT_X"]').length};
 },source);
 assert.equal(result.width,80);assert.equal(result.height,60);assert.equal(result.defs,1);assert.equal(result.first,'PATTERN');assert.equal(result.patterns,1);assert.equal(result.repeats,1);
 // Native pattern rasterisation can differ slightly at antialiased edges.
 assert.ok(result.diffs[0].total / (280*60*4) < .25, JSON.stringify(result));
 assert.ok(result.diffs[1].total < 2000, JSON.stringify(result));
 await page.locator('#paste-panel').evaluate(e=>e.open=true);await page.locator('#input-code').fill(source);await page.locator('#convert-code').click();await page.locator('#result').waitFor({state:'visible'});
 const output=await page.locator('#output-code').inputValue();
 await page.locator('#preview-width').fill('5.5');await page.locator('#preview-width').dispatchEvent('input');assert.equal(await page.locator('#output-code').inputValue(),output);
 const download=page.waitForEvent('download');await page.locator('#download').click();assert.equal((await download).suggestedFilename(),'element-repeat.svg');
 await page.locator('#file-input').setInputFiles({name:'tile.svg',mimeType:'image/svg+xml',buffer:Buffer.from(source)});
 await page.waitForFunction(()=>document.getElementById('status').textContent.includes('tile.svg · Converted successfully'));
 await page.screenshot({path:'/tmp/repeat-maker.png',fullPage:true});
 const rejected=await page.evaluate(async()=>{
  const bad=['<script/>','<image href="https://example.com/a.png"/>','<foreignObject/>'];
  return Promise.all(bad.map(async content=>{try{await RepeatMaker.inspect(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 60">${content}</svg>`);return false;}catch{return true;}}));
 });assert.ok(rejected.every(Boolean));
 await page.setViewportSize({width:375,height:800});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 for(const name of ['repeat','shape-mask','stretch-repeat']){
  await page.goto(`http://localhost:8765/tools/${name}/`);
  assert.equal(await page.locator('nav a').count(),1);assert.equal(await page.locator('nav a').getAttribute('href'),'../');
 }
 await page.goto('http://localhost:8765/tools/');assert.equal(await page.locator('nav a').count(),3);
 assert.deepEqual(errors,[]);console.log('PASS: complex artwork pixels, app-style repeats, reserved IDs, download, unsafe input, mobile and navigation',result.diffs);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
