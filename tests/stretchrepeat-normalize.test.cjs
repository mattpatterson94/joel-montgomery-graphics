// Start the repository HTTP server on :8765, then run with Playwright installed.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:8765/tools/stretch-repeat/');
    const fixture = fs.readFileSync(path.join(__dirname,'fixtures/large-stretchable.svg'),'utf8');
    const result = await page.evaluate(async source => {
      const data = await StretchRepeat.inspect(source);
      const text = StretchRepeat.build(data,data.defaults);
      const output = new DOMParser().parseFromString(text,'image/svg+xml');
      const attr = (selector,name) => output.querySelector(selector.replace(/#([\w-]+)/g,(_,id)=>'#'+(data.resourceIDs.get(id)||id))).getAttribute(name);
      // Reassemble the original artwork from the normalized model, before repeating.
      const original = new DOMParser().parseFromString(source,'image/svg+xml').documentElement;
      const normalized = document.createElementNS('http://www.w3.org/2000/svg','svg');
      normalized.setAttribute('viewBox',`0 0 ${data.width} ${data.height}`);
      for (const def of data.definitions) normalized.append(def.cloneNode(true));
      for (const id of ['L','C','R']) normalized.append(data.parts[id].cloneNode(true));
      async function pixels(svg) {
        svg.setAttribute('width',240);svg.setAttribute('height',180);
        const image = new Image();
        const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
        image.src=url;await image.decode();
        const canvas=document.createElement('canvas');canvas.width=240;canvas.height=180;
        const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);URL.revokeObjectURL(url);
        return ctx.getImageData(0,0,240,180).data;
      }
      const a=await pixels(original), b=await pixels(normalized);
      let sum=0,changed=0;
      for(let i=0;i<a.length;i++){const diff=Math.abs(a[i]-b[i]);sum+=diff;if(diff>20)changed++;}
      return {size:[data.width,data.height],defaults:data.defaults,
        gradient:attr('#paint','x2'),relative:attr('#relative','gradientUnits'),
        pattern:attr('#texture','width'),patternViewBox:attr('#boxed','viewBox'),
        clip:attr('#cut rect','width'),mask:attr('#fade','width'),maskCircle:attr('#fade circle','r'),
        blur:attr('#blur feGaussianBlur','stdDeviation'),relativeBlur:attr('#relativeBlur feGaussianBlur','stdDeviation'),
        offset:attr('#blur feOffset','dx'),tile:attr('#PATTERN','width'),
        meanPixelDifference:sum/a.length,changedFraction:changed/a.length};
    },fixture);
    assert.deepEqual(result.size,[240,180]);
    assert.equal(result.defaults.tile,79);assert.equal(result.defaults.left,80);assert.equal(result.defaults.right,80);
    assert.equal(result.gradient,'170');assert.equal(result.relative,null);
    assert.equal(result.pattern,'10');assert.equal(result.patternViewBox,'0 0 20 20');
    assert.equal(parseFloat(result.clip),.8);assert.equal(result.mask,'80');assert.equal(result.maskCircle,'10');
    assert.equal(result.blur,'1 2');assert.equal(result.relativeBlur,'0.01');assert.equal(result.offset,'2');assert.equal(result.tile,'79');
    assert.ok(result.meanPixelDifference<1.5,JSON.stringify(result));
    assert.ok(result.changedFraction<.015,JSON.stringify(result));

    const sizes=await page.evaluate(async()=>{
      const results=[];
      for(const [w,h] of [[120,180],[240,240],[800,600],[500,800],[720,540]]) {
        const source=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><g id="L"><rect width="${w/3+10}" height="${h}"/></g><g id="C"><polygon points="${w/3},0 ${2*w/3},0 ${2*w/3},${h} ${w/3},${h}"/></g><g id="R"><path d="M${2*w/3-10} 0H${w}V${h}H${2*w/3-10}Z"/></g></svg>`;
        const model=await StretchRepeat.inspect(source);
        const doc=new DOMParser().parseFromString(StretchRepeat.build(model,model.defaults),'image/svg+xml');
        const pattern=doc.querySelector('#PATTERN');
        results.push({w,h,width:model.width,height:model.height,scale:model.scale,tile:model.defaults.tile,
          maxX:Math.max(...[...pattern.querySelector('polygon').points].map(p=>p.x)),transforms:pattern.querySelectorAll('[transform]').length});
      }
      return results;
    });
    for(const r of sizes) {
      const scale=Math.min(1,240/Math.max(r.w,r.h));
      assert.equal(r.width,r.w*scale);assert.equal(r.height,r.h*scale);
      assert.ok(Math.abs(r.maxX-r.w*scale/3)<.00001);
      assert.ok(Math.abs(r.tile-(r.w*scale/3-1))<.00001);assert.equal(r.transforms,0);
    }
    // All visible measurements and manual entries stay in source units.
    await page.locator('#file-input').setInputFiles({name:'large.svg',mimeType:'image/svg+xml',buffer:Buffer.from(fixture)});
    await page.waitForSelector('#result:not([hidden])');
    assert.equal(await page.locator('#tile-width').inputValue(),'237');
    assert.equal(await page.locator('#tile-start').inputValue(),'240');
    assert.match(await page.locator('#measurements').innerText(),/720 × 540/);
    assert.match(await page.locator('#status').innerText(),/Scaled from 720 × 540 to 240 × 180/);
    await page.locator('#settings summary').click();
    for(const [id,value] of [['tile-width','225'],['tile-start','243'],['left-cutoff','210'],['right-cutoff','216']]) await page.locator(`#${id}`).fill(value);
    await page.locator('#apply-settings').click();
    const output=await page.locator('#output-code').inputValue();
    assert.match(output,/id="PATTERN"[^>]*width="75"/);assert.match(output,/dx="70"/);assert.match(output,/dx="-72"/);
    assert.equal(await page.locator('#tile-width').inputValue(),'225');
    assert.match(await page.locator('#measurements').innerText(),/225/);
    await page.locator('#reset-settings').click();assert.equal(await page.locator('#tile-width').inputValue(),'237');
    // Applying untouched defaults must round-trip without drift.
    const before=await page.locator('#output-code').inputValue();
    await page.locator('#apply-settings').click();assert.equal(await page.locator('#output-code').inputValue(),before);
    await page.screenshot({path:'/tmp/stretchrepeat-normalized.png',fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS: normalization, geometry/render parity, definitions, sizes, original-unit settings and reset.',result);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
