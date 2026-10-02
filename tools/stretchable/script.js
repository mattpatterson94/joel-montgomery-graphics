/* Filled-vector SVG slicing. Paper.js performs real curve intersections. */
(() => {
  'use strict';
  const NS='http://www.w3.org/2000/svg', $=id=>document.getElementById(id);
  const number=value=>String(Number(Number(value).toFixed(7)));
  const serialise=node=>new XMLSerializer().serializeToString(node);
  const geometry=new Set(['path','polygon','polyline','rect','circle','ellipse']);
  const allowed=new Set(['svg','g','defs','style','title','desc','metadata',...geometry]);
  let model=null, sliced=null, generation=0, previewURL=null, filename='element';
  const node=(tag,attrs={})=>{const el=document.createElementNS(NS,tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);return el;};
  const mode=()=>document.querySelector('input[name=direction]:checked').value;
  function normaliseFill(value){
    const match=value.match(/^rgba?\(\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*(?:,\s*|\s+)([+-]?(?:\d+\.?\d*|\.\d+))\s*(?:,\s*|\s+)([+-]?(?:\d+\.?\d*|\.\d+))(?:\s*(?:,\s*|\/\s*)([+-]?(?:\d+\.?\d*|\.\d+)%?))?\s*\)$/i);
    if(!match)return {fill:value,alpha:1};
    const byte=channel=>Math.max(0,Math.min(255,Math.round(Number(channel)))).toString(16).padStart(2,'0').toUpperCase();
    const alpha=match[4]?(match[4].endsWith('%')?Number(match[4].slice(0,-1))/100:Number(match[4])):1;
    return {fill:`#${byte(match[1])}${byte(match[2])}${byte(match[3])}`,alpha:Math.max(0,Math.min(1,alpha))};
  }
  function parse(source){
    if(source.length>5*1024*1024)throw new Error('Please use an SVG smaller than 5 MB.');
    if(/<!ENTITY/i.test(source))throw new Error('SVG entity declarations are not supported.');
    const doc=new DOMParser().parseFromString(source,'image/svg+xml'),root=doc.documentElement;
    if(doc.querySelector('parsererror')||root.localName!=='svg'||root.namespaceURI!==NS)throw new Error('This file is not valid SVG.');
    if(root.querySelectorAll('*').length>5000)throw new Error('Simplify this artwork before converting.');
    for(const el of [root,...root.querySelectorAll('*')]){
      if(el.closest('metadata')){if(el.localName==='metadata')el.remove();continue;}
      if(el.namespaceURI!==NS||!allowed.has(el.localName))throw new Error(`Unsupported element: ${el.localName}. Use filled vector shapes; outline text and strokes, and flatten gradients, clipping and effects.`);
      if(el!==root&&el.localName==='svg')throw new Error('Expand nested SVG viewports before exporting.');
      for(const attr of [...el.attributes]){
        if(/^on/i.test(attr.localName)||attr.localName==='base')el.removeAttributeNode(attr);
        if(attr.localName==='href'||/url\s*\(|@|\\/i.test(attr.value))throw new Error('Use solid fills without linked resources, gradients or effects.');
      }
      if(el.localName==='style'&&/url\s*\(|@|\\|<\/style/i.test(el.textContent))throw new Error('Use local solid-fill styles without imports, gradients or effects.');
    }
    const vb=(root.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number);
    if(vb.length!==4||!vb.every(Number.isFinite)||vb[2]<=0||vb[3]<=0)throw new Error('Export with a valid SVG artboard (viewBox).');
    return {root,vb};
  }
  async function inspect(source){
    const {root,vb}=parse(source);
    root.setAttribute('width',vb[2]);root.setAttribute('height',vb[3]);
    const frame=document.createElement('iframe');frame.setAttribute('sandbox','allow-same-origin');frame.setAttribute('aria-hidden','true');
    frame.style.cssText='position:fixed;left:-100000px;visibility:hidden;pointer-events:none';
    const loaded=new Promise(resolve=>frame.addEventListener('load',resolve,{once:true}));
    frame.srcdoc='<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><body></body>';
    document.body.append(frame);
    const scale=Math.min(1,240/Math.max(vb[2],vb[3]));
    const scope=new paper.PaperScope();scope.setup(new scope.Size(vb[2]*scale,vb[3]*scale));
    try{
      await loaded;const live=frame.contentDocument.importNode(root,true);frame.contentDocument.body.append(live);
      const toRoot=live.getScreenCTM().inverse();let count=0,segments=0;
      function read(el){
        if(['defs','style','title','desc'].includes(el.localName))return null;
        const style=frame.contentWindow.getComputedStyle(el);
        if(style.display==='none'||Number(style.opacity)===0)return null;
        if(['clip-path','mask','filter'].some(prop=>style.getPropertyValue(prop)!=='none')||style.mixBlendMode!=='normal')throw new Error('Flatten clipping, masks, blend modes and effects before converting.');
        if(el.localName==='svg'||el.localName==='g'){
          const children=[...el.children].map(read).filter(Boolean);
          return children.length?{children,opacity:Number(style.opacity)}:null;
        }
        if(style.visibility!=='visible')return null;
        if(style.stroke!=='none'&&parseFloat(style.strokeWidth)>0&&Number(style.strokeOpacity)>0)throw new Error('Outline strokes before exporting so they can be cut into filled sections.');
        if(style.fill==='none'||Number(style.fillOpacity)===0)return null;
        if(/url\(/i.test(style.fill))throw new Error('Use solid fills; flatten gradients and patterns before converting.');
        const colour=normaliseFill(style.fill),clean=node(el.localName);
        // Resolve SVG lengths in the source viewport, retaining native path curves.
        const attrs={path:['d'],polygon:['points'],polyline:['points'],rect:['x','y','width','height','rx','ry'],circle:['cx','cy','r'],ellipse:['cx','cy','rx','ry']}[el.localName];
        for(const attr of attrs){
          if(attr==='d'||attr==='points')clean.setAttribute(attr,el.getAttribute(attr)||'');
          else if(el.hasAttribute(attr))clean.setAttribute(attr,el[attr].baseVal.value);
        }
        // SVG copies a lone corner radius to the other axis; Paper's importer needs both.
        if(el.localName==='rect'){
          if(clean.hasAttribute('rx')&&!clean.hasAttribute('ry'))clean.setAttribute('ry',clean.getAttribute('rx'));
          if(clean.hasAttribute('ry')&&!clean.hasAttribute('rx'))clean.setAttribute('rx',clean.getAttribute('ry'));
        }
        clean.setAttribute('fill',colour.fill);clean.setAttribute('fill-rule',style.fillRule);
        let path=scope.project.importSVG(clean,{insert:false,expandShapes:true,applyMatrix:true});
        if(path instanceof scope.Shape)path=path.toPath(false);
        if(!(path instanceof scope.PathItem))throw new Error('Could not convert a shape into a vector path.');
        const matrix=toRoot.multiply(el.getScreenCTM());
        path.transform(new scope.Matrix(matrix.a*scale,matrix.b*scale,matrix.c*scale,matrix.d*scale,(matrix.e-vb[0])*scale,(matrix.f-vb[1])*scale));
        path.fillRule=style.fillRule;
        // SVG fills implicitly close open subpaths. Close them before intersections.
        const parts=path.children||[path];for(const part of parts)part.closed=true;
        count++;segments+=parts.reduce((sum,part)=>sum+part.segments.length,0);
        if(count>500||segments>20000)throw new Error('Simplify this artwork: use at most 500 shapes and 20,000 path points.');
        return {path,fill:colour.fill,fillOpacity:Number(style.fillOpacity)*colour.alpha,opacity:Number(style.opacity)};
      }
      const artwork=read(live);
      if(!artwork||!count)throw new Error('No visible filled vector shapes found.');
      return {scope,artwork,width:vb[2]*scale,height:vb[3]*scale,scale,originalSize:{width:vb[2],height:vb[3]},cache:new Map()};
    }catch(error){scope.project.remove();throw error;}finally{frame.remove();}
  }
  function sections(data,direction){
    const nx=direction==='vertical'?1:3,ny=direction==='horizontal'?1:3;
    const names=direction==='horizontal'?['L','C','R']:direction==='vertical'?['T','C','B']:['TL','T','TR','L','C','R','BL','B','BR'];
    return names.map((id,i)=>({id,col:i%nx,row:Math.floor(i/nx),x:i%nx*data.width/nx,y:Math.floor(i/nx)*data.height/ny,width:data.width/nx,height:data.height/ny,nx,ny}));
  }
  function cut(data,direction){
    if(data.cache.has(direction))return data.cache.get(direction);
    data.scope.activate();
    const result=sections(data,direction).map(section=>{
      const rectangle=new data.scope.Path.Rectangle({rectangle:new data.scope.Rectangle(section.x,section.y,section.width,section.height),insert:false});
      function intersect(item){
        if(item.children){
          const children=item.children.map(intersect).filter(Boolean);
          if(!children.length)return null;
          const g=node('g',item.opacity!==1?{opacity:number(item.opacity)}:{});g.append(...children);return g;
        }
        const path=item.path.intersect(rectangle,{insert:false});
        try{
          if(path.isEmpty()||!path.pathData)return null;
          const bounds=path.bounds;
          if(bounds.width<1e-8||bounds.height<1e-8)return null;
          const el=node('path',{d:path.pathData,fill:item.fill,'fill-rule':path.fillRule});
          if(item.fillOpacity!==1)el.setAttribute('fill-opacity',number(item.fillOpacity));
          if(item.opacity!==1)el.setAttribute('opacity',number(item.opacity));
          return el;
        }finally{path.remove();}
      }
      try{return {...section,artwork:intersect(data.artwork)};}finally{rectangle.remove();}
    });
    if(result.every(section=>!section.artwork))throw new Error('No artwork falls inside the artboard. Fit the artboard to your shape before exporting.');
    data.cache.set(direction,result);return result;
  }
  function build(data,parts,width=data.width,height=data.height,guides=false){
    const svg=node('svg',{version:'1.1',viewBox:`0 0 ${number(width)} ${number(height)}`});
    const transform=(position,count,original,current)=>{
      if(count===1)return [1,0];
      if(position===0)return [1,0];
      if(position===2)return [1,current-original];
      const size=original/3,scale=(current-2*size)/size;return [scale,size*(1-scale)];
    };
    for(const part of parts){
      const g=node('g',{id:part.id});if(part.artwork)g.append(part.artwork.cloneNode(true));
      if(width!==data.width||height!==data.height){const [sx,tx]=transform(part.col,part.nx,data.width,width),[sy,ty]=transform(part.row,part.ny,data.height,height);g.setAttribute('transform',`matrix(${number(sx)} 0 0 ${number(sy)} ${number(tx)} ${number(ty)})`);}
      svg.append(g);
    }
    if(guides){
      const g=node('g',{fill:'none',stroke:'#135bbb','stroke-width':1,'stroke-dasharray':'4 3'});
      if(parts[0].nx===3)for(const x of [data.width/3,width-data.width/3])g.append(node('path',{d:`M${number(x)} 0V${number(height)}`,'vector-effect':'non-scaling-stroke'}));
      if(parts[0].ny===3)for(const y of [data.height/3,height-data.height/3])g.append(node('path',{d:`M0 ${number(y)}H${number(width)}`,'vector-effect':'non-scaling-stroke'}));
      svg.append(g);
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n'+serialise(svg);
  }
  function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
  function refresh(){
    if(!model||!sliced)return;
    const width=model.width*Number($('preview-width').value),height=model.height*Number($('preview-height').value);
    const url=URL.createObjectURL(new Blob([build(model,sliced,width,height,$('guides').checked)],{type:'image/svg+xml'}));
    $('preview').src=url;if(previewURL)URL.revokeObjectURL(previewURL);previewURL=url;
    $('width-label').textContent=number(width/model.scale);$('height-label').textContent=number(height/model.scale);
    $('output').value=build(model,sliced);$('sections').textContent=`Sections: ${sliced.map(part=>part.id).join(' / ')}`;
  }
  function convertDirection(){
    if(!model)return;
    $('result').hidden=true;sliced=null;
    const direction=mode();$('preview-width').value=$('preview-height').value=1;
    $('preview-width').disabled=direction==='vertical';$('preview-height').disabled=direction==='horizontal';
    try{sliced=cut(model,direction);refresh();$('result').hidden=false;status(model.scale < 1 ? `Converted. Output: ${number(model.width)} × ${number(model.height)}. Preview dimensions use original SVG units.` : 'Converted. Resize the preview to check the result.');}
    catch(error){status(error.message,true);}
  }
  async function upload(files){
    if(files.length!==1){status('Please upload one SVG at a time.',true);return;}
    const token=++generation;$('result').hidden=true;sliced=null;
    if(model){model.scope.project.remove();model=null;}
    try{
      const file=files[0];if(!/\.svg$/i.test(file.name))throw new Error('Only SVG files are supported.');
      if(file.size>5*1024*1024)throw new Error('Please use an SVG smaller than 5 MB.');
      status('Reading and cutting artwork…');
      const source=await file.text();if(token!==generation)return;
      const next=await inspect(source);if(token!==generation){next.scope.project.remove();return;}
      model=next;filename=file.name.replace(/\.svg$/i,'');convertDirection();
    }catch(error){if(token===generation)status(error.message,true);}
  }
  $('drop-area').addEventListener('click',()=>$('file-input').click());
  $('file-input').addEventListener('change',event=>{if(event.target.files.length)upload([...event.target.files]);event.target.value='';});
  for(const event of ['dragenter','dragover','dragleave','drop'])document.addEventListener(event,e=>e.preventDefault());
  for(const event of ['dragenter','dragover'])$('drop-area').addEventListener(event,()=>$('drop-area').classList.add('highlight'));
  for(const event of ['dragleave','drop'])$('drop-area').addEventListener(event,()=>$('drop-area').classList.remove('highlight'));
  $('drop-area').addEventListener('drop',event=>upload([...event.dataTransfer.files]));
  document.querySelectorAll('input[name=direction]').forEach(input=>input.addEventListener('change',convertDirection));
  for(const id of ['preview-width','preview-height','guides'])$(id).addEventListener('input',refresh);
  $('reset-preview').addEventListener('click',()=>{$('preview-width').value=$('preview-height').value=1;refresh();});
  $('download').addEventListener('click',()=>{
    if(!model||!sliced)return;const url=URL.createObjectURL(new Blob([build(model,sliced)],{type:'image/svg+xml'}));
    const a=document.createElement('a');a.href=url;a.download=`${filename}-stretchable-${mode()}.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('output').value);status('SVG code copied.');}catch{$('output').closest('details').open=true;$('output').select();status('Select and copy the output code below.');}});
  window.StretchableCreator={inspect,cut,build};
})();
