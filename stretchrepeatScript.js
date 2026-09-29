/* Client-only SVG conversion. No uploaded markup is inserted into the page. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const XLINK = 'http://www.w3.org/1999/xlink';
  const $ = id => document.getElementById(id);
  const number = value => String(Number(Number(value).toFixed(6)));
  const displayNumber = value => String(Number(Number(value).toFixed(3)));
  const serialise = node => new XMLSerializer().serializeToString(node);
  const allowed = new Set('svg g defs style title desc metadata path polygon polyline rect circle ellipse line use linearGradient radialGradient stop clipPath mask pattern filter feFlood feOffset feComposite feColorMatrix feGaussianBlur feBlend feMerge feMergeNode feComponentTransfer feFuncR feFuncG feFuncB feFuncA feMorphology'.split(' '));
  const properties = 'fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset opacity clip-rule clip-path mask filter color display visibility stop-color stop-opacity vector-effect paint-order color-interpolation color-interpolation-filters'.split(' ');
  let model = null, settings = null, filename = 'element', previewURL = null, generation = 0;

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
  async function inspect(source) {
    const root = parse(source);
    const vb = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (vb.length !== 4 || !vb.every(Number.isFinite) || vb[2] <= 0 || vb[3] <= 0) throw new Error('The SVG needs a valid viewBox. Export it with an artboard from Illustrator.');
    const groups = Object.fromEntries(['L','C','R'].map(id => [id, root.querySelector(`[id="${id}"]`)]));
    if (Object.values(groups).some(g => !g || g.localName !== 'g')) throw new Error('Name the three artwork groups L, C and R in Illustrator, then export again.');
    if (Object.values(groups).some(g => g.parentElement !== root)) throw new Error('Place L, C and R directly under the SVG root. Ungroup any outer artwork wrapper before exporting.');
    if ([...root.children].some(el => !['defs','style','title','desc'].includes(el.localName) && !Object.values(groups).includes(el))) throw new Error('Keep all visible artwork inside L, C or R. Remove extra artwork outside these groups.');
    root.setAttribute('width', vb[2]); root.setAttribute('height', vb[3]);
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-same-origin');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:-100000px;top:0;width:1000px;height:1000px;visibility:hidden;pointer-events:none';
    const loaded = new Promise(resolve => frame.addEventListener('load', resolve, {once:true}));
    frame.srcdoc = '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><body></body>';
    document.body.append(frame);
    try {
      await loaded;
      const live = frame.contentDocument.importNode(root, true);
      frame.contentDocument.body.append(live);
      const parts = {}, bounds = {};
      for (const id of ['L','C','R']) {
        const group = live.querySelector(`[id="${id}"]`);
        const matrix = live.getScreenCTM().inverse().multiply(group.getScreenCTM());
        if (Math.abs(matrix.b) > 1e-7 || Math.abs(matrix.c) > 1e-7) throw new Error('Expand rotated or skewed section transforms before exporting so the tile bounds are unambiguous.');
        const box = group.getBBox();
        const xs = [box.x, box.x + box.width].map(x => matrix.a*x + matrix.e - vb[0]);
        bounds[id] = {x:Math.min(...xs), width:Math.abs(xs[1]-xs[0])};
        if (!box.width || !box.height) throw new Error(`${id} must contain visible artwork with a width and height.`);
        parts[id] = {group, matrix};
      }
      // Freeze Illustrator classes and inherited presentation before rearranging groups.
      for (const el of [live, ...live.querySelectorAll('*')]) {
        if (['style','defs','title','desc'].includes(el.localName)) continue;
        const computed = frame.contentWindow.getComputedStyle(el);
        if (computed.transform !== 'none' && !el.hasAttribute('transform')) {
          el.style.transform = computed.transform; el.style.transformOrigin = computed.transformOrigin;
        }
        for (const prop of properties) {
          let value = computed.getPropertyValue(prop);
          // Browsers may absolutise fragment URLs in computed styles.
          value = value.replace(/url\(["']?[^)"']*#([\w:.-]+)["']?\)/g, 'url(#$1)');
          if (value) el.style.setProperty(prop, value);
        }
      }
      for (const style of live.querySelectorAll('style')) style.remove();
      const definitions = [...live.children].filter(el => el.localName === 'defs').map(el => el.cloneNode(true));
      const cloned = {};
      for (const id of ['L','C','R']) {
        const {group,matrix} = parts[id];
        const copy = group.cloneNode(true);
        copy.removeAttribute('transform'); copy.style.removeProperty('transform');
        const wrapper = svgNode('g', {transform:`matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e-vb[0]} ${matrix.f-vb[1]})`});
        copy.removeAttribute('id'); wrapper.append(copy); cloned[id] = wrapper;
      }
      const left = bounds.C.x, right = vb[2] - bounds.C.x - bounds.C.width;
      if (left < -0.01 || right < -0.01) throw new Error('The centre must fit horizontally within the SVG artboard.');
      return {width:vb[2], height:vb[3], definitions, parts:cloned, bounds,
        defaults:{tile:bounds.C.width, start:bounds.C.x, left:Math.max(0,left), right:Math.max(0,right)}};
    } finally { frame.remove(); }
  }
  function build(data, config, width = data.width, diagnostic = false, simulate = false) {
    const svg = svgNode('svg', {version:'1.1', viewBox:`0 0 ${number(width)} ${number(data.height)}`});
    for (const defs of data.definitions) svg.append(defs.cloneNode(true));
    const ids = new Set([...svg.querySelectorAll('[id]')].map(el => el.id));
    for (const part of Object.values(data.parts)) for (const el of part.querySelectorAll('[id]')) ids.add(el.id);
    const unique = base => {let id=base; while(ids.has(id)) id+='x'; ids.add(id); return id;};
    const patternID=unique('sr-pattern'), filterID=unique('sr-interior');
    const defs = svgNode('defs'); svg.append(defs);
    const pattern = svgNode(simulate ? 'g' : 'pattern', {id:patternID, patternUnits:'userSpaceOnUse',x:0,y:0,width:number(config.tile),height:number(data.height)});
    const centre = data.parts.C.cloneNode(true);
    const tile = svgNode('g',{transform:`translate(${number(-config.start)} 0)`}); tile.append(centre); pattern.append(tile); defs.append(pattern);
    const filter = svgNode('filter',{id:filterID,filterUnits:'userSpaceOnUse',primitiveUnits:'userSpaceOnUse',x:0,y:0,width:'100%',height:number(data.height),'color-interpolation-filters':'sRGB'});
    filter.append(svgNode('feFlood',{'flood-color':'white',result:'bounds'}),svgNode('feOffset',{in:'bounds',dx:number(config.left),dy:0,result:'left'}),svgNode('feOffset',{in:'bounds',dx:number(-config.right),dy:0,result:'right'}),svgNode('feComposite',{in:'left',in2:'right',operator:'in',result:'interiorAlpha'}),svgNode('feComposite',{in:'SourceGraphic',in2:'interiorAlpha',operator:'in'})); defs.append(filter);
    const outer=svgNode('g',{filter:`url(#${filterID})`}), repeat=svgNode('g',{id:'REPEAT_X'}); outer.append(repeat);svg.append(outer);
    if (simulate) {
      const count=Math.ceil(width/config.tile);
      if(count>2000) throw new Error('The preview would contain too many tiles. Increase the tile width.');
      for(let i=0;i<count;i++){const use=svgNode('use',{transform:`translate(${number(i*config.tile)} 0)`});use.setAttributeNS(XLINK,'xlink:href',`#${patternID}`);repeat.append(use);}
    } else repeat.append(svgNode('rect',{x:0,y:0,width:number(data.width),height:number(data.height),fill:`url(#${patternID})`}));
    for(const id of ['R','L']) {
      const cap=svgNode('g',{id});cap.append(data.parts[id].cloneNode(true));
      if(id==='R' && simulate) cap.setAttribute('transform',`translate(${number(width-data.width)} 0)`);
      svg.append(cap);
      if(diagnostic) recolour(cap,id==='L'?'#2f80ed':'#eb5757');
    }
    if(diagnostic) recolour(centre,'#27ae60');
    return '<?xml version="1.0" encoding="UTF-8"?>\n'+serialise(svg);
  }
  function recolour(group, colour) {
    for(const el of [group,...group.querySelectorAll('*')]) {
      if(el.closest('mask,clipPath,filter,linearGradient,radialGradient')) continue;
      if(el.style.fill !== 'none') el.style.setProperty('fill',colour,'important');
      if(el.style.stroke && el.style.stroke !== 'none') el.style.setProperty('stroke',colour,'important');
    }
  }
  function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
  function fillSettings(){for(const [id,key] of [['tile-width','tile'],['tile-start','start'],['left-cutoff','left'],['right-cutoff','right']]) $(id).value=number(settings[key]);}
  function refresh() {
    const output=build(model,settings);
    $('output-code').value=output;
    const width=Number($('preview-width').value);
    const preview=build(model,settings,width,$('diagnostic').checked,true);
    const nextURL=URL.createObjectURL(new Blob([preview],{type:'image/svg+xml'}));
    $('preview').src=nextURL;if(previewURL) URL.revokeObjectURL(previewURL);previewURL=nextURL;
    $('width-label').textContent=`${number(width)} × ${number(model.height)}`;
    const overlapL=model.bounds.L.x+model.bounds.L.width-settings.left;
    const overlapR=model.width-settings.right-model.bounds.R.x;
    $('measurements').replaceChildren();
    for(const [label,value] of [['Original size',`${number(model.width)} × ${number(model.height)}`],['Repeat width',number(settings.tile)],['Left overlap',displayNumber(overlapL)],['Right overlap',displayNumber(overlapR)]]) {const item=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;item.append(dt,dd);$('measurements').append(item);}
    if(overlapL<0 || overlapR<0) status('Converted. A negative overlap indicates a gap: adjust the cutoffs or extend the cap artwork.',true);
  }
  async function convert(source,name='element') {
    const token=++generation;model=null;$('result').hidden=true;status('Reading SVG…');
    try {
      const next=await inspect(source);if(token!==generation)return;
      model=next;settings={...next.defaults};filename=name.replace(/\.svg$/i,'');
      fillSettings();$('settings-error').textContent='';$('diagnostic').checked=false;
      $('preview-width').min=number(Math.max(settings.left+settings.right+1,model.width*.75));
      $('preview-width').max=number(model.width*4);$('preview-width').value=number(model.width*2);
      status(`${name.replace(/\.svg$/i,'')}.svg · Converted successfully`);refresh();$('result').hidden=false;
    } catch(error){if(token===generation){model=null;status(error.message,true);}}
  }
  async function upload(files) {
    if(files.length!==1){status('Please upload one SVG at a time.',true);return;}
    const file=files[0];
    if(!/\.svg$/i.test(file.name)){status('Only SVG files are supported.',true);return;}
    if(file.size>5*1024*1024){status('Please use an SVG smaller than 5 MB.',true);return;}
    try { await convert(await file.text(),file.name); } catch(error){status('Could not read this file. Please try again.',true);}
  }
  $('drop-area').addEventListener('click',()=>$('file-input').click());
  $('file-input').addEventListener('change',event=>{if(event.target.files.length) upload([...event.target.files]);event.target.value='';});
  for(const event of ['dragenter','dragover']) $('drop-area').addEventListener(event,e=>{e.preventDefault();$('drop-area').classList.add('dragging');});
  for(const event of ['dragleave','drop']) $('drop-area').addEventListener(event,e=>{e.preventDefault();$('drop-area').classList.remove('dragging');});
  $('drop-area').addEventListener('drop',e=>upload([...e.dataTransfer.files]));
  $('convert-code').addEventListener('click',()=>convert($('input-code').value));
  $('preview-width').addEventListener('input',()=>{if(model) refresh();});
  $('diagnostic').addEventListener('change',()=>{if(model) refresh();});
  $('apply-settings').addEventListener('click',()=>{
    const next={tile:Number($('tile-width').value),start:Number($('tile-start').value),left:Number($('left-cutoff').value),right:Number($('right-cutoff').value)};
    if([...document.querySelectorAll('.fields input')].some(input=>input.value.trim()==='') || !Object.values(next).every(Number.isFinite) || next.tile<=0 || next.left<0 || next.right<0 || next.left+next.right>=model.width || model.width*4/next.tile>2000) {$('settings-error').textContent='Enter a positive tile width and non-negative cutoffs. Cutoffs must leave a visible centre; the preview supports up to 2,000 tiles.';return;}
    settings=next;$('settings-error').textContent='';$('preview-width').min=number(Math.max(next.left+next.right+1,model.width*.75));status('Settings updated.');refresh();
  });
  $('reset-settings').addEventListener('click',()=>{settings={...model.defaults};fillSettings();$('settings-error').textContent='';$('preview-width').min=number(Math.max(settings.left+settings.right+1,model.width*.75));status('Detected settings restored.');refresh();});
  $('download').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([$('output-code').value],{type:'image/svg+xml'}));const a=document.createElement('a');a.href=url;a.download=`${filename}-repeat.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  $('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('output-code').value);$('copy').textContent='Copied!';setTimeout(()=>$('copy').textContent='Copy SVG code',1500);}catch{$('output-code').closest('details').open=true;$('output-code').select();status('Select and copy the output code below.');}});
  // Expose the same engine to browser regression tests without a separate implementation.
  window.StretchRepeat={inspect,build};
})();
