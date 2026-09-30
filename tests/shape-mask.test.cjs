// Start a local HTTP server at :8765. NODE_PATH supplies Playwright.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox'],headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1200,height:950}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8765/tools/shape-mask/');
 const fixtures=Object.fromEntries(fs.readdirSync(path.join(__dirname,'fixtures/shape-mask')).map(name=>[name,fs.readFileSync(path.join(__dirname,'fixtures/shape-mask',name),'utf8')]));
 const result=await page.evaluate(async fixtures=>{
  const rows=[];
  for(const [name,text] of Object.entries(fixtures)){
   const root=new DOMParser().parseFromString(text,'image/svg+xml').documentElement;
   // Reconstruct ordinary designer artwork from the working output examples.
   const ids=[];
   for(const clip of [...root.querySelectorAll('clipPath')]){
    const shape=clip.firstElementChild.cloneNode(true);ids.push(shape.id);
    clip.parentElement.replaceWith(shape);
   }
   const model=await ShapeMask.inspect(new XMLSerializer().serializeToString(root));
   const choices=new Set(model.shapes.filter(s=>ids.includes(s.label)).map(s=>s.index));
   const output=ShapeMask.build(model,choices), parsed=new DOMParser().parseFromString(output,'image/svg+xml');
   const wrappers=[...parsed.querySelectorAll('image')].map(image=>({group:image.parentElement.id,clip:image.parentElement.getAttribute('clip-path'),siblings:[...image.parentElement.parentElement.children].map(el=>el.localName),box:['x','y','width','height'].map(a=>Number(image.getAttribute(a))),href:image.getAttributeNS('http://www.w3.org/1999/xlink','href')}));
   const originalSolid=[...root.querySelectorAll('[id^="change_"]')].map(el=>el.outerHTML);
   const solid=[...parsed.querySelectorAll('[id^="change_"]')].map(el=>el.outerHTML);
   rows.push({name,count:choices.size,wrappers,originalSolid,solid,ids:[...parsed.querySelectorAll('[id]')].map(el=>el.id),output});
  }
  return rows;
 },fixtures);
 for(const row of result){
  assert.equal(row.count,row.name==='multi-mask-element.svg'?5:1);assert.equal(row.wrappers.length,row.count);
  assert.deepEqual(row.solid,row.originalSolid);assert.equal(new Set(row.ids).size,row.ids.length);
  for(const w of row.wrappers){assert.match(w.group,/^clip_1/);assert.deepEqual(w.siblings,['clipPath','g']);assert.ok(w.box.every(Number.isFinite));assert.ok(w.box[2]>0&&w.box[3]>0);assert.equal(w.href,'');}
 }
 const monitor=result.find(r=>r.name==='multi-element-mask_3.svg');monitor.wrappers[0].box.forEach((value,i)=>assert.ok(Math.abs(value-[15,15,210,139.97][i])<.0001));
 const source='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120"><defs><style>.hole{fill:#ea4422;fill-rule:evenodd}</style></defs><rect id="background" width="200" height="120" fill="#fff"/><g id="change_1" transform="translate(20 10)" opacity=".8"><path id="compound" class="hole" d="M0 0H80V80H0Z M20 20V60H60V20Z"/><rect id="rotated" x="100" y="10" width="30" height="40" transform="rotate(15 115 30)" fill="blue"/></g></svg>';
 const geometry=await page.evaluate(async source=>{
  const model=await ShapeMask.inspect(source);const output=ShapeMask.build(model,new Set([1,2]));const doc=new DOMParser().parseFromString(output,'image/svg+xml');
  const images=[...doc.querySelectorAll('image')];
  // Fill output placeholders with a solid tile to inspect clipping holes.
  const tile='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="red"/></svg>');
  images.forEach(el=>el.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href',tile));
  const img=new Image();img.src='data:image/svg+xml;base64,'+btoa(new XMLSerializer().serializeToString(doc));await img.decode();
  const canvas=document.createElement('canvas');canvas.width=200;canvas.height=120;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,200,120);
  return {count:model.shapes.length,images:images.length,rule:doc.querySelector('#compound').getAttribute('clip-rule'),hole:[...ctx.getImageData(60,50,1,1).data],fill:[...ctx.getImageData(25,15,1,1).data],rotated:model.shapes[2].box,parent:doc.querySelector('image').parentElement.parentElement.parentElement.id};
 },source);
 assert.equal(geometry.count,3);assert.equal(geometry.images,2);assert.equal(geometry.rule,'evenodd');assert.deepEqual(geometry.hole,[255,255,255,255]);assert.ok(geometry.fill[0]>200&&geometry.fill[1]<100);assert.equal(geometry.parent,'change_1');assert.ok(geometry.rotated.width>30&&geometry.rotated.height>40);
 await page.locator('#mode-switcher').click();
 await page.locator('#file-input').setInputFiles({name:'art.svg',mimeType:'image/svg+xml',buffer:Buffer.from(source)});
 await page.locator('#editor').waitFor({state:'visible'});
 assert.equal(await page.locator('.shape-row').count(),3);
 await page.frameLocator('#preview').locator('#compound').click({position:{x:5,y:5}});
 assert.equal(await page.locator('#selection-count').textContent(),'1 mask selected');
 await page.getByRole('button',{name:'rotated',exact:true}).click();assert.equal(await page.locator('#selection-count').textContent(),'2 masks selected');
 const output=await page.locator('#output').inputValue();assert.equal((output.match(/<image /g)||[]).length,2);
 const downloadPromise=page.waitForEvent('download');await page.locator('#download').click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'art-processed.svg');
 await page.screenshot({path:'/tmp/shape-mask-desktop.png',fullPage:true});
 await page.locator('#clear').click();assert.equal(await page.locator('#download').isDisabled(),true);assert.equal(await page.locator('#output').inputValue(),'');
 await page.locator('.shape-row').nth(1).focus();await page.keyboard.press('Space');assert.equal(await page.locator('#selection-count').textContent(),'1 mask selected');
 await page.setViewportSize({width:375,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/shape-mask-mobile.png',fullPage:true});
 await page.locator('#mode-switcher').click();
 const simple='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>';
 const auto=page.waitForEvent('download');await page.locator('#file-input').setInputFiles({name:'simple.svg',mimeType:'',buffer:Buffer.from(simple)});assert.equal((await auto).suggestedFilename(),'simple-processed.svg');
 await page.locator('#file-input').setInputFiles({name:'many.svg',mimeType:'image/svg+xml',buffer:Buffer.from(source)});await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Use Advanced Mode'));
 const invalid=await page.evaluate(async()=>{
  const sources=['<svg>broken','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><script>alert(1)</script></svg>','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><use href="https://example.com/a.svg#x"/></svg>'];
  return Promise.all(sources.map(async text=>{try{await ShapeMask.inspect(text);return false;}catch{return true;}}));
 });assert.ok(invalid.every(Boolean));assert.deepEqual(errors,[]);
 console.log('PASS: five reference structures, solid artwork, independent masks, compound holes, transforms, preview/list/keyboard selection, downloads, simple mode, mobile and invalid input.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
