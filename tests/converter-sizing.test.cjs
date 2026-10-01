// Serve the repository on :8765. Requires Playwright; CHROMIUM_PATH is optional.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const tool of ['shape-mask','repeat','stretchable']){
  await page.goto(`http://localhost:8765/tools/${tool}/`);
  const rows=await page.evaluate(async tool=>{
   const rows=[];
   const parse=s=>new DOMParser().parseFromString(s,'image/svg+xml').documentElement;
   async function pixels(text,w,h){const img=new Image();const url=URL.createObjectURL(new Blob([text],{type:'image/svg+xml'}));img.src=url;await img.decode();const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);URL.revokeObjectURL(url);return c.getContext('2d').getImageData(0,0,w,h).data;}
   for(const [w,h] of [[720,540],[400,800],[180,120]]){
    const source=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="30 60 ${w} ${h}"><rect x="30" y="60" width="${w}" height="${h}" fill="#d84646"/><g transform="translate(30 60)"><path fill="#1455bb" fill-rule="evenodd" d="M${w*.2} ${h*.2}H${w*.8}V${h*.8}H${w*.2}Z M${w*.4} ${h*.4}V${h*.6}H${w*.6}V${h*.4}Z"/><circle cx="${w*.5}" cy="${h*.5}" r="${Math.min(w,h)*.05}" fill="#f0c020"/></g></svg>`;
    const scale=Math.min(1,240/Math.max(w,h)),width=w*scale,height=h*scale;
    const engine=tool==='shape-mask'?ShapeMask:tool==='repeat'?RepeatMaker:StretchableCreator;
    const data=await engine.inspect(source);
    const plain=tool==='shape-mask'?engine.build(data,new Set()):tool==='repeat'?engine.build(data):engine.build(data,engine.cut(data,'both'));
    const root=parse(plain),vb=root.getAttribute('viewBox').split(/\s+/).map(Number);
    const before=await pixels(source,width,height),after=await pixels(plain,width,height);
    let diff=0,count=0;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
     if(tool==='stretchable'&&([width/3,width*2/3].some(v=>Math.abs(x-v)<2)||[height/3,height*2/3].some(v=>Math.abs(y-v)<2)))continue;
     for(let c=0;c<4;c++){diff+=Math.abs(before[(y*width+x)*4+c]-after[(y*width+x)*4+c]);count++;}
    }
    const row={input:[w,h],size:vb.slice(2),meanDifference:diff/count};
    if(tool==='shape-mask'){
     const mask=parse(engine.build(data,new Set([0,1])));
     row.images=[...mask.querySelectorAll('image')].map(el=>['x','y','width','height'].map(a=>Number(el.getAttribute(a))));
     row.expected=[30*scale,60*scale,width,height];row.shapes=data.shapes.length;
     const thumb=await createImageBitmap(await engine.thumbnail(data,new Set([0,1])));
     const c=document.createElement('canvas');c.width=c.height=240;c.getContext('2d').drawImage(thumb,0,0);
     const fittedH=h*240/Math.max(w,h);row.bottomAlpha=c.getContext('2d').getImageData(120,Math.floor((240+fittedH)/2)-2,1,1).data[3];
     row.thumbnail=[thumb.width,thumb.height];
    }else if(tool==='repeat'){
     row.tile=[Number(root.querySelector('pattern').getAttribute('width')),Number(root.querySelector('pattern').getAttribute('height'))];
     row.rectWidth=Number(root.querySelector('pattern rect').getAttribute('width'));
    }else{
     row.modes=['horizontal','vertical','both'].map(mode=>{
      const parts=engine.cut(data,mode);return {count:parts.length,valid:parts.every(p=>p.x+p.width<=width+.00001&&p.y+p.height<=height+.00001)};
     });row.transforms=root.querySelectorAll('[transform]').length;data.scope.project.remove();
    }
    rows.push(row);
   }
   return rows;
  },tool);
  for(const row of rows){const [w,h]=row.input,s=Math.min(1,240/Math.max(w,h));assert.deepEqual(row.size,[w*s,h*s]);assert.ok(row.meanDifference<1.5,JSON.stringify(row));
   if(tool==='shape-mask'){assert.equal(row.shapes,3);assert.deepEqual(row.images[0],row.expected);assert.deepEqual(row.thumbnail,[240,240]);assert.equal(row.bottomAlpha,255);}
   if(tool==='repeat'){assert.deepEqual(row.tile,row.size);assert.equal(row.rectWidth,w*s);}
   if(tool==='stretchable'){assert.deepEqual(row.modes.map(m=>m.count),[3,3,9]);assert.ok(row.modes.every(m=>m.valid));assert.equal(row.transforms,0);}
  }
  console.log(`PASS ${tool}: large wide/tall geometry, small inputs and rendering`,rows);
 }
 assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
