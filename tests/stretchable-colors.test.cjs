// Serve the repo on :8765; provide Playwright through NODE_PATH and optionally CHROMIUM_PATH.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox'],headless:true});
  try{
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://localhost:8765/tools/stretchable/');

    const result=await page.evaluate(async()=>{
      const source='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120"><style>.shape{fill:#5478ED}</style><rect class="shape" width="240" height="120"/></svg>';
      const data=await StretchableCreator.inspect(source);
      try{
        const output=StretchableCreator.build(data,StretchableCreator.cut(data,'horizontal'));
        const doc=new DOMParser().parseFromString(output,'image/svg+xml');
        return {
          fills:[...doc.querySelectorAll('path')].map(path=>path.getAttribute('fill')),
          containsRgb:/fill=["']rgba?\(/i.test(output)
        };
      }finally{data.scope.project.remove();}
    });

    assert.equal(result.containsRgb,false);
    assert.equal(result.fills.length,3);
    assert.deepEqual([...new Set(result.fills)],['#5478ED']);
    assert.deepEqual(errors,[]);
    console.log('PASS: Stretchable Shape Converter exports computed solid fills as uppercase #RRGGBB hex values.',result.fills);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
