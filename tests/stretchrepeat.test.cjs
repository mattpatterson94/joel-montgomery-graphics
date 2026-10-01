// Run with: NODE_PATH=/path/to/node_modules node tests/stretchrepeat.test.cjs
// Start a local HTTP server at :8765 first. CHROMIUM_PATH can select a browser.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  let executablePath = process.env.CHROMIUM_PATH;
  let args = ['--no-sandbox'];
  if (process.env.SPARTICUZ_PATH) {
    const bundled = (await import(process.env.SPARTICUZ_PATH + '/build/index.js')).default;
    executablePath = await bundled.executablePath(); args = bundled.args;
  }
  const browser = await chromium.launch({ executablePath, args, headless:true });
  const page = await browser.newPage({viewport:{width:1100,height:1050}});
  // Optional local copy of the same CDN dependency for offline test runners.
  if(process.env.JQUERY_PATH) await page.route('https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js',route=>route.fulfill({path:process.env.JQUERY_PATH,contentType:'application/javascript'}));
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.goto('http://localhost:8765/tools/stretch-repeat/');
  const fixture=fs.readFileSync(require('node:path').join(__dirname,'fixtures/stretchable.svg'),'utf8');
  const result=await page.evaluate(async source=>{
    const data=await StretchRepeat.inspect(source);
    const detectedDefaults={...data.defaults};
    // Keep the original 80-unit fixture checks separate from the new default.
    data.defaults.tile=80;
    const widths=[240,319,320,321,510.771448,560,561];
    const rows=[];
    for(const width of widths){
      const text=StretchRepeat.build(data,data.defaults,width,true,true);
      const doc=new DOMParser().parseFromString(text,'image/svg+xml');
      doc.querySelector('[id="L"]').remove();doc.querySelector('[id="R"]').remove();
      const root=doc.documentElement;root.setAttribute('width',width);root.setAttribute('height',240);
      const img=new Image();img.src='data:image/svg+xml;base64,'+btoa(new XMLSerializer().serializeToString(root));await img.decode();
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(width);canvas.height=240;
      const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,120,canvas.width,1).data;
      const visible=[];for(let x=0;x<canvas.width;x++)if(pixels[x*4+3]>128)visible.push(x);
      rows.push({width,min:Math.min(...visible),max:Math.max(...visible),green:pixels[100*4+1]});
    }
    return {defaults:detectedDefaults,rows,output:StretchRepeat.build(data,data.defaults)};
  },fixture);
  assert.equal(result.defaults.tile,79);assert.equal(result.defaults.left,80);assert.equal(result.defaults.right,80);
  for(const row of result.rows){assert.equal(row.min,80);assert.ok(Math.abs(row.max-(row.width-81))<1,JSON.stringify(row));assert.equal(row.green,174);}
  assert.ok(result.output.includes('#e05555'));
  // Structural regression: the app must discover the tile in the first defs.
  const structure = await page.evaluate(text=>{
    const svg=new DOMParser().parseFromString(text,'image/svg+xml').documentElement;
    const pattern=svg.querySelector('defs > pattern');
    return {defs:svg.querySelectorAll(':scope > defs').length,id:pattern.id,
      first:svg.querySelector('defs').firstElementChild.localName,
      transforms:pattern.querySelectorAll('[transform]').length,
      shape:pattern.firstElementChild.localName,
      minX:Math.min(...[...pattern.querySelector('polygon').points].map(p=>p.x)),
      maxX:Math.max(...[...pattern.querySelector('polygon').points].map(p=>p.x)),
      cap:svg.querySelector('[id="R"]').firstElementChild.localName};
  },result.output);
  assert.deepEqual(structure,{defs:1,id:'PATTERN',first:'pattern',transforms:0,shape:'polygon',minX:0,maxX:80,cap:'polygon'});
  fs.writeFileSync('/tmp/demo2-repeat-fixed.svg',result.output);
  const working=fs.readFileSync(require('node:path').join(__dirname,'fixtures/working-repeat.svg'),'utf8');
  const parity=await page.evaluate(({working,output})=>{
    const parse=s=>new DOMParser().parseFromString(s,'image/svg+xml').documentElement;
    const a=parse(working),b=parse(output);
    const tags=root=>[...root.querySelectorAll('*')].map(el=>el.localName).join(',');
    const pa=[...a.querySelectorAll('polygon')],pb=[...b.querySelectorAll('polygon')];
    const geometry=pa.every((poly,i)=>[...poly.points].every((p,j)=>Math.abs(p.x-pb[i].points[j].x)<0.00001&&Math.abs(p.y-pb[i].points[j].y)<0.00001));
    const filter=root=>{const copy=root.querySelector('filter').cloneNode(true);copy.setAttribute('id','interior');return new XMLSerializer().serializeToString(copy);};
    return {tags:tags(a)===tags(b),geometry,filter:filter(a)===filter(b)};
  },{working,output:result.output});
  assert.deepEqual(parity,{tags:true,geometry:true,filter:true});

  // Upload UI, invalid settings, diagnostic-only colours, mobile layout and errors.
  await page.locator('#file-input').setInputFiles({name:'demo.svg',mimeType:'image/svg+xml',buffer:Buffer.from(fixture)});
  await page.waitForSelector('#result:not([hidden])');
  const output=await page.locator('#output-code').inputValue();
  assert.match(output, /id="PATTERN"[^>]*width="79"/);
  assert.match(output, /dx="80"/);
  assert.match(output, /dx="-80"/);
  await page.locator('#diagnostic').check();assert.equal(await page.locator('#output-code').inputValue(),output);
  await page.locator('#settings summary').click();await page.locator('#tile-width').fill('0');await page.locator('#apply-settings').click();assert.match(await page.locator('#settings-error').innerText(),/positive/);
  await page.locator('#reset-settings').click();assert.equal(await page.locator('#tile-width').inputValue(),'79');
  await page.screenshot({path:'/tmp/stretchrepeat-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'/tmp/stretchrepeat-mobile.png',fullPage:true});
  const cases=await page.evaluate(async()=>{
    const root=content=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 20 280 100">${content}</svg>`;
    const source=root('<defs><style>.art{fill:#123456}</style></defs><g id="L"><rect class="art" x="10" y="20" width="90" height="100"/></g><g id="C"><path class="art" d="M90 20h120v100H90Z"/></g><g id="R"><rect class="art" x="200" y="20" width="90" height="100"/></g>');
    const data=await StretchRepeat.inspect(source);
    const rejected=[];
    for(const bad of [root('<g id="L"/>'),source.replace('<defs>','<script>alert(1)</script><defs>'),source.replace('fill:#123456','fill:url(https://example.com/a)'),source.replace('id="C"','id="L"'),'<svg broken']){
      try{await StretchRepeat.inspect(bad);rejected.push(false);}catch{rejected.push(true);}
    }
    return {defaults:data.defaults,rejected,output:StretchRepeat.build(data,data.defaults)};
  });
  for (const [key,value] of Object.entries({tile:120*240/280-1,start:80*240/280,left:80*240/280,right:80*240/280})) assert.ok(Math.abs(cases.defaults[key]-value)<.00001);assert.ok(cases.rejected.every(Boolean));assert.ok(cases.output.includes('#123456'));
  const downloadPromise=page.waitForEvent('download');await page.locator('#download').click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'demo-repeat.svg');
  await page.goto('http://localhost:8765/stretchrepeat.html');
  await page.waitForURL('**/tools/stretch-repeat/');
  await page.getByRole('link',{name:'All utilities',exact:true}).click();
  await page.waitForURL('**/tools/');
  await page.screenshot({path:'/tmp/utilities-hub-mobile.png',fullPage:true});
  await page.setViewportSize({width:1100,height:900});
  await page.screenshot({path:'/tmp/utilities-hub-desktop.png',fullPage:true});
  await page.getByRole('link',{name:'Shape Mask Converter',exact:true}).click();
  await page.waitForURL('**/tools/shape-mask/');
  await page.goto('http://localhost:8765/shapemask.html');
  await page.waitForURL('**/tools/shape-mask/');
  assert.deepEqual(errors,[]);console.log('PASS: geometry, tile boundaries, colours, upload, validation, download and mobile layout.');
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});

