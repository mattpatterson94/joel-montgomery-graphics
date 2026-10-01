/* Client-only SVG conversion. No uploaded markup is inserted into the page. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const XLINK = 'http://www.w3.org/1999/xlink';
  const $ = id => document.getElementById(id);
  const number = value => String(Number(Number(value).toFixed(6)));
  const displayNumber = value => String(Number(Number(value).toFixed(3)));
  const serialise = node => new XMLSerializer().serializeToString(node);
  const allowed = new Set('svg g symbol marker defs style title desc metadata path polygon polyline rect circle ellipse line use linearGradient radialGradient stop clipPath mask pattern filter feFlood feOffset feComposite feColorMatrix feGaussianBlur feBlend feMerge feMergeNode feComponentTransfer feFuncR feFuncG feFuncB feFuncA feMorphology'.split(' '));
  let model = null, filename = 'element', generation = 0, advanced = false;
  const selected = new Set();
  let backgroundPromise = null, lastThumbnail = null, downloading = false;
  const shapeSelector = 'path,polygon,polyline,rect,circle,ellipse';
  const definitionSelector = 'defs,clipPath,mask,pattern,symbol,marker';

  function svgNode(tag, attributes = {}) {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    return node;
  }
  function parse(source) {
    if (source.length > 5 * 1024 * 1024) throw new Error('Please use an SVG smaller than 5 MB.');
    if (/<!ENTITY/i.test(source)) throw new Error('SVG entity declarations are not supported. Export a plain SVG from Illustrator.');
    const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
    const root = doc.documentElement;
    if (doc.querySelector('parsererror') || root.localName !== 'svg' || root.namespaceURI !== NS) throw new Error('This file is not valid SVG.');
    const elements = [root, ...root.querySelectorAll('*')];
    if (elements.length > 15000) throw new Error('This SVG is too complex. Simplify the artwork before converting.');
    const ids = new Set();
    for (const el of elements) {
      if (el.closest('metadata')) { if (el.localName === 'metadata') el.remove(); continue; }
      if (el.namespaceURI !== NS || !allowed.has(el.localName)) throw new Error(`Unsupported SVG element: ${el.localName}. Outline text, embed vector artwork and expand live effects before exporting.`);
      if (el.id) { if (ids.has(el.id)) throw new Error(`Duplicate SVG ID: ${el.id}. Export with unique IDs.`); ids.add(el.id); }
      for (const attr of [...el.attributes]) {
        const value = attr.value.trim();
        if (/^on/i.test(attr.localName) || attr.localName === 'base') el.removeAttributeNode(attr);
        if (attr.localName === 'href' && !/^#[\w:.-]+$/.test(value)) throw new Error('External references are not supported. Keep all artwork inside the SVG.');
        if (/url\s*\(/i.test(value) && !safeURLs(value)) throw new Error('External SVG resources are not supported.');
      }
      if (el.localName === 'style' && (/@|\\|<\/style/i.test(el.textContent) || !safeURLs(el.textContent))) throw new Error('Use local SVG styles without imports or external resources.');
      if (el.hasAttribute('style') && /@|\\/.test(el.getAttribute('style'))) throw new Error('Unsupported inline SVG style.');
    }
    // Remove XML processing instructions, including external stylesheet instructions.
    return root;
  }
  function safeURLs(value) {
    const urls = [...value.matchAll(/url\s*\(([^)]*)\)/gi)];
    return urls.every(match => /^['"]?#[\w:.-]+['"]?$/.test(match[1].trim()));
  }
  const frameHTML = '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}body>svg{display:block;width:100%;height:100%}</style><body></body>';
  async function loadFrame(frame) {
    const loaded = new Promise(resolve => frame.addEventListener('load', resolve, {once:true}));
    frame.srcdoc = frameHTML;
    await loaded;
  }
  async function inspect(source) {
    const root = parse(source);
    const vb = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (vb.length !== 4 || !vb.every(Number.isFinite) || vb[2] <= 0 || vb[3] <= 0) throw new Error('Export the SVG with a valid artboard (viewBox).');
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-same-origin');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:-100000px;width:1000px;height:1000px;visibility:hidden;pointer-events:none';
    document.body.append(frame);
    try {
      await loadFrame(frame);
      const live = frame.contentDocument.importNode(root, true);
      frame.contentDocument.body.append(live);
      // Resolve source CSS before adding wrappers, without freezing inherited
      // defaults on definitions (which would change <use> inheritance).
      const rules = [...live.querySelectorAll('style')].flatMap(el => [...(el.sheet?.cssRules || [])]);
      const snapshots = [live, ...live.querySelectorAll('*')].map(el => {
        const declared = new Set([...el.style]);
        for (const rule of rules) if (rule.selectorText && el.matches(rule.selectorText)) for (const prop of rule.style) declared.add(prop);
        const computed = frame.contentWindow.getComputedStyle(el);
        return [el, [...declared].map(prop => [prop, computed.getPropertyValue(prop)])];
      });
      for (const [el, values] of snapshots) {
        if (el.localName === 'style') continue;
        el.removeAttribute('style');
        for (const [prop, raw] of values) {
          const value = raw.replace(/url\(["']?[^)"']*#([\w:.-]+)["']?\)/g, 'url(#$1)');
          if (value) el.style.setProperty(prop, value);
        }
        el.removeAttribute('class');
        // Never trust selection markers supplied by uploaded files.
        el.removeAttribute('data-mask-shape');
      }
      live.querySelectorAll('style').forEach(el => el.remove());
      const sizing = fitSVGTo240(live);
      const shapes = [];
      for (const shape of live.querySelectorAll(shapeSelector)) {
        if (shape.closest(definitionSelector)) continue;
        const computed = frame.contentWindow.getComputedStyle(shape);
        const hidden = [shape, ...ancestors(shape, live)].some(el => {
          const style = frame.contentWindow.getComputedStyle(el);
          return style.display === 'none' || Number(style.opacity) === 0;
        });
        if (hidden || computed.visibility === 'hidden' || computed.visibility === 'collapse') continue;
        const index = shapes.length;
        let reason = '';
        if (computed.fill === 'none') reason = 'Outline strokes or add a fill to use this shape as a mask.';
        if (['clip-path','mask','filter'].some(prop => computed.getPropertyValue(prop) !== 'none')) reason = 'Expand this shape’s clipping or effects before using it as a mask.';
        if (shape.id && [...live.querySelectorAll('use')].some(el => (el.getAttribute('href') || el.getAttributeNS(XLINK,'href')) === '#'+shape.id)) reason = 'Expand linked copies before using their source shape as a mask.';
        // Measuring a temporary group includes the shape's own transform, while
        // remaining in the parent's coordinates. Ancestor transforms stay intact.
        const holder = svgNode('g');shape.replaceWith(holder);holder.append(shape);
        const bounds = holder.getBBox();holder.replaceWith(shape);
        const box = {x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height};
        if (!Object.values(box).every(Number.isFinite) || box.width <= 0 || box.height <= 0) reason = 'This shape has no filled area.';
        const clipRule = computed.getPropertyValue('clip-rule') === 'evenodd' || computed.fillRule === 'evenodd' ? 'evenodd' : 'nonzero';
        shape.setAttribute('data-mask-shape', index);
        const parentMatrix = live.getScreenCTM().inverse().multiply(shape.parentElement.getScreenCTM());
        const rootToParent = parentMatrix.inverse();
        shapes.push({rootToParent:[rootToParent.a,rootToParent.b,rootToParent.c,rootToParent.d,rootToParent.e,rootToParent.f], index, label:shape.id || `${shape.localName} ${index+1}`, box, clipRule, reason});
      }
      if (!shapes.length) throw new Error('No selectable vector shapes found. Outline text and expand symbols or linked copies before exporting.');
      const hasOtherArtwork = [...live.querySelectorAll('use,line')].some(el => !el.closest(definitionSelector));
      return {root:live.cloneNode(true), shapes, hasOtherArtwork, ...sizing};
    } finally {frame.remove();}
  }
  function ancestors(el, root) {
    const result=[];
    for(let parent=el.parentElement;parent;parent=parent.parentElement){result.push(parent);if(parent===root)break;}
    return result;
  }
  function build(data, choices, background = null) {
    const svg = data.root.cloneNode(true);
    svg.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', XLINK);
    const ids = new Set([svg.id,...[...svg.querySelectorAll('[id]')].map(el=>el.id)]);
    const unique = base => {let id=base,i=1;while(ids.has(id))id=`${base}_${i++}_`;ids.add(id);return id;};
    for (const item of data.shapes) {
      if (!choices.has(item.index)) continue;
      if (item.reason) throw new Error(item.reason);
      const shape = svg.querySelector(`[data-mask-shape="${item.index}"]`);
      const wrapper=svgNode('g'), clip=svgNode('clipPath',{id:unique('clippath'),clipPathUnits:'userSpaceOnUse'});
      const group=svgNode('g',{id:unique('clip_1'),'clip-path':`url(#${clip.id})`});
      const image=svgNode('image',{overflow:'visible',...Object.fromEntries(Object.entries(item.box).map(([k,v])=>[k,number(v)]))});
      image.setAttributeNS(XLINK,'xlink:href',background || '');
      if (background) {
        const [x,y,width,height] = svg.getAttribute('viewBox').trim().split(/[\s,]+/).map(Number);
        const side = Math.max(width,height);
        image.setAttribute('x',number(x+(width-side)/2));
        image.setAttribute('y',number(y+(height-side)/2));
        image.setAttribute('width',number(side));image.setAttribute('height',number(side));
        image.setAttribute('transform',`matrix(${item.rootToParent.map(number).join(' ')})`);
        image.setAttribute('preserveAspectRatio','xMidYMid meet');
      }
      shape.replaceWith(wrapper);
      // Preserve shape opacity on the image wrapper, but strip its original paint.
      for(const prop of ['opacity','display','visibility']) {
        if(shape.hasAttribute(prop)){wrapper.setAttribute(prop,shape.getAttribute(prop));shape.removeAttribute(prop);}
        if(shape.style.getPropertyValue(prop)){wrapper.style.setProperty(prop,shape.style.getPropertyValue(prop));shape.style.removeProperty(prop);}
      }
      for(const prop of ['fill','fill-opacity','stroke','stroke-width','stroke-opacity','paint-order','marker-start','marker-mid','marker-end']) {
        shape.removeAttribute(prop);shape.style.removeProperty(prop);
      }
      shape.setAttribute('clip-rule',item.clipRule);shape.style.setProperty('clip-rule',item.clipRule);
      clip.append(shape);group.append(image);wrapper.append(clip,group);
    }
    svg.querySelectorAll('[data-mask-shape]').forEach(el=>el.removeAttribute('data-mask-shape'));
    if (background) {
      const [, , w, h] = svg.getAttribute('viewBox').trim().split(/[\s,]+/).map(Number);
      const scale = 240/Math.max(w,h);
      svg.setAttribute('width',number(w*scale));svg.setAttribute('height',number(h*scale));
      svg.style.setProperty('width',`${number(w*scale)}px`);svg.style.setProperty('height',`${number(h*scale)}px`);
      svg.style.setProperty('overflow','hidden');
      svg.setAttribute('preserveAspectRatio','xMidYMid meet');
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n'+serialise(svg);
  }
  async function backgroundImage() {
    if (!backgroundPromise) {
      backgroundPromise = (async () => {
        const response = await fetch('shapeMaskBackground.png');
        if (!response.ok) throw new Error('Could not load the thumbnail pattern. Please try again.');
        const blob = await response.blob();
        return new Promise((resolve,reject) => {
          const reader = new FileReader();reader.onload=()=>resolve(reader.result);
          reader.onerror=()=>reject(new Error('Could not read the thumbnail pattern.'));
          reader.readAsDataURL(blob);
        });
      })().catch(error=>{backgroundPromise=null;throw error;});
    }
    return backgroundPromise;
  }
  async function thumbnail(data, choices) {
    const source = build(data, choices, await backgroundImage());
    const url = URL.createObjectURL(new Blob([source],{type:'image/svg+xml'}));
    try {
      const image = new Image();image.src=url;await image.decode();
      const canvas = document.createElement('canvas');canvas.width=canvas.height=240;
      const [, , w, h] = data.root.getAttribute('viewBox').trim().split(/[\s,]+/).map(Number);
      const scale=240/Math.max(w,h), width=w*scale, height=h*scale;
      canvas.getContext('2d').drawImage(image,(240-width)/2,(240-height)/2,width,height);
      return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not generate the PNG thumbnail.')),'image/png'));
    } finally {URL.revokeObjectURL(url);}
  }
  async function downloadPair(data, choices, name, token) {
    const svg = build(data, choices);
    const png = await thumbnail(data, choices);
    if (token!==generation) return;
    save(svg,`${name}-processed.svg`);
    save(png,`${name}-thumbnail.png`);
    lastThumbnail={blob:png,name:`${name}-thumbnail.png`};
    $('download-thumbnail').hidden=false;
  }
  function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
  function save(text,name){
    const url=URL.createObjectURL(text instanceof Blob ? text : new Blob([text],{type:'image/svg+xml'}));
    const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function refresh() {
    const indexes=model.shapes.filter(item=>selected.has(item.index)).map(item=>item.index);
    for(const item of model.shapes) {
      const active=selected.has(item.index), button=$('shape-list').children[item.index];
      button.setAttribute('aria-pressed',String(active));
      button.querySelector('.badge').textContent=active?`Mask ${indexes.indexOf(item.index)+1}`:'';
      const shape=$('preview').contentDocument.querySelector(`[data-mask-shape="${item.index}"]`);
      const original=model.root.querySelector(`[data-mask-shape="${item.index}"]`);
      shape.setAttribute('style',original.getAttribute('style') || '');
      shape.style.cursor=item.reason?'not-allowed':'pointer';
      if(active){shape.style.setProperty('fill','#3184fc','important');shape.style.setProperty('fill-opacity','.6','important');shape.style.setProperty('stroke','#083f81','important');shape.style.setProperty('stroke-width','2px','important');shape.style.setProperty('vector-effect','non-scaling-stroke','important');}
    }
    $('selection-count').textContent=`${selected.size} ${selected.size===1?'mask':'masks'} selected`;
    $('download').disabled=selected.size===0 || downloading;$('copy').disabled=selected.size===0;
    $('output').value=selected.size?build(model,selected):'';
  }
  function toggle(index){const item=model.shapes[index];if(item.reason){status(item.reason,true);return;}if(selected.has(index))selected.delete(index);else selected.add(index);refresh();}
  async function showEditor(data, name, token) {
    await loadFrame($('preview'));if(token!==generation)return;
    model=data;filename=name.replace(/\.svg$/i,'');selected.clear();
    const live=$('preview').contentDocument.importNode(model.root,true);
    // The preview fits the artboard; these presentation changes never enter output.
    live.style.width='100%';live.style.height='100%';
    $('preview').contentDocument.body.append(live);
    $('shape-list').replaceChildren();
    for(const item of model.shapes){
      const button=document.createElement('button');button.type='button';button.className='shape-row';button.disabled=!!item.reason;
      button.title=item.reason || item.label;
      const label=document.createElement('span');label.className='label';label.textContent=item.label+(item.reason?' (unavailable)':'');
      const badge=document.createElement('span');badge.className='badge';button.append(label,badge);
      button.addEventListener('click',()=>toggle(item.index));$('shape-list').append(button);
    }
    live.addEventListener('click',event=>{const shape=event.target.closest('[data-mask-shape]');if(shape)toggle(Number(shape.getAttribute('data-mask-shape')));});
    $('editor').hidden=false;refresh();status(`${name} · Choose shapes in the preview or list.${model.scale < 1 ? ` Output: ${displayNumber(model.width)} × ${displayNumber(model.height)}.` : ""}`);
  }
  function setMode(value){
    advanced=value;++generation;model=null;selected.clear();lastThumbnail=null;$('download-thumbnail').hidden=true;
    $('advanced').hidden=!advanced;$('editor').hidden=true;$('output').value='';
    $('mode-switcher').textContent=advanced?'Simple Mode':'Advanced Mode';
    $('mode-switcher').setAttribute('aria-pressed',String(advanced));
    $('file-input').multiple=!advanced;
    $('instructions').textContent=advanced?'Upload one SVG, then select each shape that should become an image mask. Unselected artwork stays in place.':'Upload a single-shape SVG to download its SVG and PNG thumbnail automatically. Use Advanced Mode to choose masks and keep other artwork.';
    status('');
  }
  async function upload(files){
    if(!files.length)return;
    if(advanced && files.length!==1){status('Upload one SVG at a time in Advanced Mode.',true);return;}
    const token=++generation, mode=advanced;lastThumbnail=null;$('download-thumbnail').hidden=true;model=null;$('editor').hidden=true;selected.clear();$('output').value='';
    const messages=[];let failed=false;
    for(const file of files){
      if(token!==generation)return;
      try{
        if(!/\.svg$/i.test(file.name))throw new Error('Only SVG files are supported.');
        if(file.size>5*1024*1024)throw new Error('Please use an SVG smaller than 5 MB.');
        status(`Reading ${file.name}…`);
        const text=await file.text();if(token!==generation)return;
        const data=await inspect(text);if(token!==generation)return;
        if(mode){await showEditor(data,file.name,token);return;}
        if(data.shapes.length!==1 || data.hasOtherArtwork)throw new Error('Use Advanced Mode to choose which shapes become masks.');
        await downloadPair(data,new Set([data.shapes[0].index]),file.name.replace(/\.svg$/i,''),token);
        messages.push(`${file.name} · SVG and PNG downloads started${data.scale < 1 ? ` · Output: ${displayNumber(data.width)} × ${displayNumber(data.height)}` : ""}`);
      }catch(error){failed=true;messages.push(`${file.name} · ${error.message}`);}
    }
    if(token===generation)status(messages.join('\n'),failed);
  }
  $('mode-switcher').addEventListener('click',()=>setMode(!advanced));
  $('drop-area').addEventListener('click',()=>$('file-input').click());
  $('file-input').addEventListener('change',event=>{upload([...event.target.files]);event.target.value='';});
  for(const event of ['dragenter','dragover','dragleave','drop'])document.addEventListener(event,e=>e.preventDefault());
  for(const event of ['dragenter','dragover'])$('drop-area').addEventListener(event,()=>$('drop-area').classList.add('highlight'));
  for(const event of ['dragleave','drop'])$('drop-area').addEventListener(event,()=>$('drop-area').classList.remove('highlight'));
  $('drop-area').addEventListener('drop',event=>upload([...event.dataTransfer.files]));
  $('clear').addEventListener('click',()=>{selected.clear();refresh();});
  $('download').addEventListener('click',async()=>{
    if(!model || !selected.size || downloading)return;
    const token=generation;downloading=true;$('download').disabled=true;
    try {await downloadPair(model,new Set(selected),filename,token);if(token===generation)status('SVG and PNG downloads started.');}
    catch(error){if(token===generation)status(error.message,true);}
    finally {downloading=false;if(model && token===generation)refresh();}
  });
  $('download-thumbnail').addEventListener('click',()=>{if(lastThumbnail)save(lastThumbnail.blob,lastThumbnail.name);});
  $('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('output').value);status('SVG code copied.');}catch{$('output').closest('details').open=true;$('output').select();status('Select and copy the output code below.');}});
  window.ShapeMask={inspect,build,thumbnail};
})();

