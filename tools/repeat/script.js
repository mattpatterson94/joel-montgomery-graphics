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
  let model = null, filename = 'element', previewURL = null, generation = 0;

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
    if (vb.length !== 4 || !vb.every(Number.isFinite) || vb[2] <= 0 || vb[3] <= 0) throw new Error('Export the SVG with a valid artboard (viewBox).');
    root.setAttribute('width', vb[2]); root.setAttribute('height', vb[3]);
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-same-origin');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:-100000px;visibility:hidden;pointer-events:none';
    const loaded = new Promise(resolve => frame.addEventListener('load', resolve, {once:true}));
    frame.srcdoc = '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><body></body>';
    document.body.append(frame);
    try {
      await loaded;
      const live = frame.contentDocument.importNode(root, true);
      frame.contentDocument.body.append(live);
      // Resolve stylesheet declarations without materialising inherited defaults:
      // defaults on a definition would override the paint supplied by <use>.
      const rules = [...frame.contentDocument.styleSheets].flatMap(sheet => [...sheet.cssRules]);
      const snapshots = [live, ...live.querySelectorAll('*')].map(el => {
        const declared = new Set([...el.style]);
        for (const rule of rules) {
          if (rule.selectorText && el.matches(rule.selectorText)) {
            for (const prop of rule.style) declared.add(prop);
          }
        }
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
      }
      live.querySelectorAll('style').forEach(el => el.remove());
      const sizing = fitSVGTo240(live);
      // Prefix every source ID so PATTERN and REPEAT_X remain exact app markers.
      const ids = new Map([...live.querySelectorAll('[id]'), ...(live.id ? [live] : [])].map((el,i) => [el.id, `art-${i}`]));
      for (const el of [live, ...live.querySelectorAll('*')]) {
        for (const attr of [...el.attributes]) {
          if (attr.localName === 'id') attr.value = ids.get(attr.value);
          else if (attr.localName === 'href' && attr.value.startsWith('#')) attr.value = '#' + (ids.get(attr.value.slice(1)) || attr.value.slice(1));
          else attr.value = attr.value.replace(/url\(\s*["']?#([\w:.-]+)["']?\s*\)/g, (_, id) => `url(#${ids.get(id) || id})`);
        }
      }
      const artwork = live.cloneNode(true);
      // A nested viewport retains percentages and non-zero viewBox origins even
      // when the app replaces the outer pattern with a group of repeated uses.
      artwork.setAttribute('x', '0'); artwork.setAttribute('y', '0');
      artwork.style.setProperty('x', '0px'); artwork.style.setProperty('y', '0px');
      artwork.style.setProperty('width', `${sizing.width}px`); artwork.style.setProperty('height', `${sizing.height}px`);
      artwork.style.setProperty('overflow', 'hidden');
      return {...sizing, artwork};
    } finally {frame.remove();}
  }
  function build(data, width = data.width, simulate = false) {
    const svg = svgNode('svg', {version:'1.1', viewBox:`0 0 ${number(width)} ${number(data.height)}`});
    const defs = svgNode('defs');
    const pattern = svgNode(simulate ? 'g' : 'pattern', {id:'PATTERN', patternUnits:'userSpaceOnUse', x:0, y:0, width:number(data.width), height:number(data.height)});
    pattern.append(data.artwork.cloneNode(true));
    defs.append(pattern);
    const repeat = svgNode('g', {id:'REPEAT_X'});
    if (simulate) {
      for (let i=0; i<Math.ceil(width/data.width); i++) {
        const use = svgNode('use', {transform:`translate(${number(i*data.width)} 0)`});
        use.setAttributeNS(XLINK, 'xlink:href', '#PATTERN'); repeat.append(use);
      }
    } else repeat.append(svgNode('rect', {x:0,y:0,width:number(width),height:number(data.height),fill:'url(#PATTERN)'}));
    svg.append(defs, repeat);
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + serialise(svg);
  }
  function status(message,error=false) {$('status').textContent=message;$('status').classList.toggle('error',error);}
  function refresh() {
    const width = model.width * Number($('preview-width').value);
    $('output-code').value = build(model);
    const next = URL.createObjectURL(new Blob([build(model,width,true)],{type:'image/svg+xml'}));
    $('preview').src=next;if(previewURL) URL.revokeObjectURL(previewURL);previewURL=next;
    $('width-label').textContent=`${displayNumber(width/model.scale)} × ${displayNumber(model.originalSize.height)}`;
    $('tile-size').textContent=`Tile size: ${displayNumber(model.originalSize.width)} × ${displayNumber(model.originalSize.height)} original SVG units`;
  }
  async function convert(source,name='element.svg') {
    const token=++generation;model=null;$('result').hidden=true;status('Reading SVG…');
    try {
      const next=await inspect(source);if(token!==generation)return;
      model=next;filename=name.replace(/\.svg$/i,'');$('preview-width').value=3;
      refresh();$('result').hidden=false;status(`${name} · Converted successfully${model.scale < 1 ? ` · Output: ${displayNumber(model.width)} × ${displayNumber(model.height)}` : ""}`);
    } catch(error) {if(token===generation) status(error.message,true);}
  }
  async function upload(files) {
    if(files.length!==1){status('Please upload one SVG at a time.',true);return;}
    const file=files[0];
    if(!/\.svg$/i.test(file.name)){status('Only SVG files are supported.',true);return;}
    if(file.size>5*1024*1024){status('Please use an SVG smaller than 5 MB.',true);return;}
    try {await convert(await file.text(),file.name);} catch {status('Could not read this file. Please try again.',true);}
  }
  $('drop-area').addEventListener('click',()=>$('file-input').click());
  $('file-input').addEventListener('change',event=>{if(event.target.files.length)upload([...event.target.files]);event.target.value='';});
  for(const event of ['dragenter','dragover']) $('drop-area').addEventListener(event,e=>{e.preventDefault();$('drop-area').classList.add('dragging');});
  for(const event of ['dragleave','drop']) $('drop-area').addEventListener(event,e=>{e.preventDefault();$('drop-area').classList.remove('dragging');});
  $('drop-area').addEventListener('drop',e=>upload([...e.dataTransfer.files]));
  $('convert-code').addEventListener('click',()=>convert($('input-code').value));
  $('preview-width').addEventListener('input',()=>{if(model)refresh();});
  $('download').addEventListener('click',()=>{
    const url=URL.createObjectURL(new Blob([$('output-code').value],{type:'image/svg+xml'}));
    const a=document.createElement('a');a.href=url;a.download=`${filename}-repeat.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $('copy').addEventListener('click',async()=>{
    try {await navigator.clipboard.writeText($('output-code').value);$('copy').textContent='Copied!';setTimeout(()=>$('copy').textContent='Copy SVG code',1500);}
    catch {$('output-code').closest('details').open=true;$('output-code').select();status('Select and copy the output code below.');}
  });
  window.RepeatMaker={inspect,build};
})();

