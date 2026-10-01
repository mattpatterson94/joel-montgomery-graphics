// Start the repository HTTP server at :8765. Requires Playwright and pngjs.
const {chromium} = require('playwright');
const {PNG} = require('pngjs');
const assert = require('node:assert/strict');
(async () => {
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:1100,height:1000}});
    await page.goto('http://localhost:8765/tools/stretch-repeat/');
    const result=await page.evaluate(async()=>{
      const source=colour=>`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 240 240"><defs>
        <linearGradient id="paint"><stop stop-color="${colour}"/><stop offset="1" stop-color="${colour}"/></linearGradient>
        <pattern id="PATTERN" patternUnits="userSpaceOnUse" width="80" height="240"><rect width="80" height="240" fill="url(#paint)"/></pattern>
        <clipPath id="cut"><rect width="240" height="240"/></clipPath>
        <mask id="mask"><rect width="240" height="240" fill="white"/></mask>
        <g id="detail"><circle cx="40" cy="40" r="10"/></g>
      </defs><g id="L"><rect width="90" height="240"/><use href="#detail"/><use xlink:href="#detail"/></g>
      <g id="C"><rect x="80" width="80" height="240" fill="url(#PATTERN)" clip-path="url(#cut)" mask="url(#mask)"/></g>
      <g id="R"><rect x="150" width="90" height="240"/></g></svg>`;
      const first=await StretchRepeat.inspect(source('#ff0000'));
      const second=await StretchRepeat.inspect(source('#0000ff'));
      const third=await StretchRepeat.inspect(source('#ff0000'));
      const parse=text=>new DOMParser().parseFromString(text,'image/svg+xml').documentElement;
      const outputA=StretchRepeat.build(first,first.defaults);
      const outputB=StretchRepeat.build(second,second.defaults);
      const ids=svg=>[...svg.querySelectorAll('[id]')].map(el=>el.id);
      const a=parse(outputA),b=parse(outputB);
      const shared=ids(a).filter(id=>ids(b).includes(id)).sort();
      const dangling=[];
      for (const svg of [a,b]) for (const el of svg.querySelectorAll('*')) for (const attr of el.attributes) {
        const refs=[...attr.value.matchAll(/url\(\s*["']?#([\w:.-]+)["']?\s*\)/g)].map(m=>m[1]);
        if(attr.localName==='href')refs.push(attr.value.slice(1));
        for(const id of refs)if(!svg.querySelector(`[id="${id}"]`))dangling.push(id);
      }
      // Reproduce the observed app expansion/renaming. This is not an import test.
      const host=document.createElement('div');host.id='collision-test';
      host.style.cssText='position:fixed;left:0;top:0;width:500px;height:480px;background:white;z-index:999999';
      const variants=[[first,320,first.defaults],[second,480,{...second.defaults,left:30,right:50}]];
      variants.forEach(([data,width,config],index)=>{
        const svg=parse(StretchRepeat.build(data,config,width,false,true));
        svg.querySelector('#L').remove();svg.querySelector('#R').remove();
        svg.querySelector('#PATTERN').id=`PATTERN-instance-${index}`;
        svg.querySelector('#REPEAT_X').id=`REPEAT_X-instance-${index}`;
        for(const use of svg.querySelectorAll('use')) if(use.getAttributeNS('http://www.w3.org/1999/xlink','href')==='#PATTERN') use.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href',`#PATTERN-instance-${index}`);
        svg.setAttribute('width',width);svg.setAttribute('height',240);svg.style.display='block';host.append(svg);
      });
      document.body.append(host);
      return {shared,dangling,unique:new Set(ids(a)).size===ids(a).length,
        distinct:first.resourcePrefix!==second.resourcePrefix && first.resourcePrefix!==third.resourcePrefix,
        stable:outputA===StretchRepeat.build(first,first.defaults),
        afterPreview:(StretchRepeat.build(first,first.defaults,600,true,true),outputA===StretchRepeat.build(first,first.defaults)),
        importedPattern:first.resourceIDs.get('PATTERN'),pattern:a.querySelector('defs').firstElementChild.id};
    });
    assert.deepEqual(result.shared,['L','PATTERN','R','REPEAT_X']);
    assert.deepEqual(result.dangling,[]);assert.equal(result.unique,true);assert.equal(result.distinct,true);
    assert.equal(result.stable,true);assert.equal(result.afterPreview,true);assert.equal(result.pattern,'PATTERN');assert.match(result.importedPattern,/^sr-[a-f0-9]{32}-art-/);
    const bounds=buffer=>{
      const image=PNG.sync.read(buffer);
      return [120,360].map(y=>{
        const visible=[];
        for(let x=0;x<image.width;x++) {const i=(y*image.width+x)*4;if(image.data[i+1]<100)visible.push(x);}
        return [Math.min(...visible),Math.max(...visible)];
      });
    };
    const good=bounds(await page.locator('#collision-test').screenshot());
    assert.deepEqual(good,[[80,239],[30,429]]);
    // Control: restoring the old shared filter ID must reproduce cross-element clipping.
    await page.evaluate(()=>{
      for(const svg of document.querySelectorAll('#collision-test > svg')) {
        const filter=svg.querySelector('filter');const previous=filter.id;filter.id='interior';
        svg.querySelector(`[filter="url(#${previous})"]`).setAttribute('filter','url(#interior)');
      }
    });
    const collision=bounds(await page.locator('#collision-test').screenshot());
    assert.notDeepEqual(collision,good);
    console.log('PASS: private resource IDs, local references, stable export IDs, app markers and inline collision regression.',{good,collision});
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
