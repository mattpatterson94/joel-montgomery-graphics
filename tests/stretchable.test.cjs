// Serve the repo on :8765; provide Playwright through NODE_PATH and optionally CHROMIUM_PATH.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox'],headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1100,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8765/tools/stretchable/');
 const original=fs.readFileSync(path.join(__dirname,'fixtures/stretchable.svg'),'utf8');
 const source='<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 20 240 180"><style>.base{fill:#d84646}</style><rect class="base" x="10" y="20" width="240" height="180" rx="20"/><g opacity=".7" transform="translate(10 20)"><path fill="#1455bb" fill-rule="evenodd" d="M30 20H210V160H30Z M70 50V130H170V50Z"/><circle fill="yellow" cx="120" cy="90" r="15"/></g></svg>';
 const result=await page.evaluate(async({source,original})=>{
  const engine=StretchableCreator,rows=[];
  async function pixels(text,w,h){const img=new Image();img.src='data:image/svg+xml;base64,'+btoa(text);await img.decode();const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);return ctx.getImageData(0,0,w,h).data;}
  for(const input of [source,original]){
   const data=await engine.inspect(input), w=data.width,h=data.height,ref=await pixels(input,w,h);
   for(const mode of ['horizontal','vertical','both']){
    const parts=engine.cut(data,mode),output=engine.build(data,parts),actual=await pixels(output,w,h);
    let total=0,count=0;
    // Exact split edges can have normal antialiasing differences; compare interiors.
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
     if([w/3,w*2/3].some(v=>Math.abs(x-v)<2)||[h/3,h*2/3].some(v=>Math.abs(y-v)<2))continue;
     for(let c=0;c<4;c++){total+=Math.abs(actual[(y*w+x)*4+c]-ref[(y*w+x)*4+c]);count++;}
    }
    const doc=new DOMParser().parseFromString(output,'image/svg+xml');
    const bounds=parts.map(part=>{
     const g=data.scope.project.importSVG(part.artwork,{insert:false,expandShapes:true});const b=g.bounds;const result={id:part.id,x:b.x,y:b.y,right:b.right,bottom:b.bottom,section:[part.x,part.y,part.width,part.height]};g.remove();return result;
    });
    rows.push({mode,ids:[...doc.documentElement.children].map(el=>el.id),average:total/count,bounds,clipping:doc.querySelectorAll('clipPath,mask,image').length,transforms:doc.querySelectorAll('[transform]').length});
   }
   data.scope.project.remove();
  }
  // One compound path, with a hole crossing several split boundaries.
  const donut=await engine.inspect('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><path fill-rule="evenodd" d="M0 0H240V240H0Z M60 60V180H180V60Z"/></svg>');
  const donutPixels=await pixels(engine.build(donut,engine.cut(donut,'both')),240,240);
  const holeAlpha=donutPixels[(120*240+120)*4+3];donut.scope.project.remove();
  return {rows,holeAlpha};
 },{source,original});
 for(const row of result.rows){
  assert.ok(row.average<1,JSON.stringify(row));assert.equal(row.clipping,0);assert.equal(row.transforms,0);
  assert.deepEqual(row.ids,row.mode==='horizontal'?['L','C','R']:row.mode==='vertical'?['T','C','B']:['TL','T','TR','L','C','R','BL','B','BR']);
  for(const b of row.bounds){const [x,y,w,h]=b.section;assert.ok(b.x>=x-.001&&b.y>=y-.001&&b.right<=x+w+.001&&b.bottom<=y+h+.001,JSON.stringify(b));}
 }
 assert.equal(result.holeAlpha,0);
 await page.locator('#file-input').setInputFiles({name:'shape.svg',mimeType:'image/svg+xml',buffer:Buffer.from(source)});await page.locator('#result').waitFor({state:'visible'});
 assert.equal(await page.locator('#preview-height').isDisabled(),true);
 const output=await page.locator('#output').inputValue();await page.locator('#preview-width').fill('2');await page.locator('#preview-width').dispatchEvent('input');assert.equal(await page.locator('#output').inputValue(),output);
 await page.locator('.direction-options label').nth(2).click();assert.equal(await page.locator('#preview-height').isDisabled(),false);assert.match(await page.locator('#sections').textContent(),/TL \/ T \/ TR/);
 await page.locator('#preview-width').fill('1.5');await page.locator('#preview-width').dispatchEvent('input');await page.locator('#preview-height').fill('1.3');await page.locator('#preview-height').dispatchEvent('input');
 const preview=await page.locator('#preview').getAttribute('src');await page.evaluate(()=>document.getElementById('preview').decode());
 await page.screenshot({path:'/tmp/stretchable-desktop.png',fullPage:true});
 const downloadPromise=page.waitForEvent('download');await page.locator('#download').click();assert.equal((await downloadPromise).suggestedFilename(),'shape-stretchable-both.svg');
 await page.locator('.direction-options label').nth(1).click();assert.equal(await page.locator('#preview-width').isDisabled(),true);assert.equal(await page.locator('#preview-width').inputValue(),'1');
 await page.setViewportSize({width:375,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/stretchable-mobile.png',fullPage:true});
 const rejected=await page.evaluate(async()=>{
  const cases=['<path d="M0 0H240V240H0Z" stroke="black"/>','<text>text</text>','<image href="https://example.com/x.png"/>','<script/>'];
  return Promise.all(cases.map(async inner=>{try{const data=await StretchableCreator.inspect(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">${inner}</svg>`);data.scope.project.remove();return false;}catch{return true;}}));
 });assert.ok(rejected.every(Boolean));
 await page.goto('http://localhost:8765/tools/');await page.getByRole('link',{name:'Stretchable Shape Creator'}).click();assert.ok(page.url().endsWith('/tools/stretchable/'));
 assert.deepEqual(errors,[]);console.log('PASS: 3 modes, actual cut bounds, original rendering, compound holes, transforms/group opacity, resizing/download separation, direction controls, mobile and input rejection.',result.rows.map(row=>row.average));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
