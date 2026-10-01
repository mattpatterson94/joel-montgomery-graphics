/* Change SVG user units, baking the scale into geometry rather than an outer transform. */
(() => {
  'use strict';
  const format = value => String(Number(value.toFixed(9)));
  const lengths = {
    svg: 'x y width height', rect: 'x y width height rx ry',
    circle: 'cx cy r', ellipse: 'cx cy rx ry', line: 'x1 y1 x2 y2',
    use: 'x y width height', linearGradient: 'x1 y1 x2 y2', radialGradient: 'cx cy r fx fy fr',
    pattern: 'x y width height', mask: 'x y width height', filter: 'x y width height'
  };
  const strokeLengths = ['stroke-width', 'stroke-dasharray', 'stroke-dashoffset'];
  const NS = 'http://www.w3.org/2000/svg';

  window.normaliseSVGUnits = (root, scale) => {
    if (scale === 1) return;
    const nodes = [root, ...root.querySelectorAll('*')];
    const byID = new Map(nodes.filter(el => el.id).map(el => [el.id, el]));
    const href = el => el.getAttribute('href') || el.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
    // Paint servers can inherit their units and viewBox from another definition.
    function inherited(el, name, fallback, seen = new Set()) {
      if (el.hasAttribute(name)) return el.getAttribute(name);
      if (seen.has(el)) throw new Error('Circular SVG definition references are not supported.');
      seen.add(el);
      const target = byID.get(href(el)?.slice(1));
      return target ? inherited(target, name, fallback, seen) : fallback;
    }
    const contexts = new Map();
    function contextsFor(el, parentScale) {
      let geometry = parentScale, content = parentScale;
      const units = (name, fallback) => inherited(el, name, fallback) === 'objectBoundingBox' ? 1 : scale;
      if (el.localName.endsWith('Gradient')) geometry = content = units('gradientUnits', 'objectBoundingBox');
      if (el.localName === 'clipPath') geometry = content = units('clipPathUnits', 'userSpaceOnUse');
      if (el.localName === 'pattern') {
        geometry = units('patternUnits', 'objectBoundingBox');
        content = inherited(el, 'viewBox', '') ? scale : units('patternContentUnits', 'userSpaceOnUse');
      }
      if (el.localName === 'mask') {
        geometry = units('maskUnits', 'objectBoundingBox');
        content = units('maskContentUnits', 'userSpaceOnUse');
      }
      if (el.localName === 'filter') {
        geometry = units('filterUnits', 'objectBoundingBox');
        content = units('primitiveUnits', 'userSpaceOnUse');
      }
      // A nested viewport with a viewBox has its own explicit user coordinates.
      if (el.localName === 'svg' && el.hasAttribute('viewBox')) content = scale;
      contexts.set(el, {geometry, content});
      for (const child of el.children) contextsFor(child, content);
    }
    contextsFor(root, scale);
    // Resolve length units before changing any viewport. Percentages and bounding-box
    // fractions remain relative; absolute lengths are converted to user units.
    const snapshots = nodes.map(el => {
      const attrs = {};
      for (const attr of el.attributes) attrs[attr.name] = attr.value;
      const resolved = {};
      for (const name of (lengths[el.localName] || '').split(' ')) {
        const value = el[name]?.baseVal;
        if (value && typeof value.value === 'number') resolved[name] = value.value;
      }
      return {el, attrs, resolved};
    });
    function list(value, factor) {
      return value.replace(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?(?:%|[a-z]+)?/gi, token => {
        if (token.endsWith('%')) return token;
        const match = token.match(/^([-+\d.e]+)([a-z]*)$/i);
        const unit = match[2].toLowerCase();
        const units = {'':1, px:1, in:96, cm:96/2.54, mm:96/25.4, q:96/101.6, pt:96/72, pc:16};
        if (!(unit in units)) throw new Error(`Unsupported SVG length unit: ${unit}. Export lengths in pixels before converting.`);
        return format(Number(match[1]) * units[unit] * factor);
      });
    }
    function transform(el, name, value, factor) {
      if (!value || value === 'none') return;
      const probe = root.ownerDocument.createElementNS(NS, 'g');
      probe.setAttribute('transform', value);
      const m = probe.transform.baseVal.consolidate()?.matrix;
      if (!m) throw new Error('Could not scale an SVG transform. Expand transforms before exporting.');
      el.setAttribute(name, `matrix(${[m.a,m.b,m.c,m.d,m.e*factor,m.f*factor].map(format).join(' ')})`);
    }
    for (const {el, attrs, resolved} of snapshots) {
      const {geometry, content} = contexts.get(el);
      const tag = el.localName;
      const names = (lengths[tag] || (tag.startsWith('fe') ? 'x y width height' : '')).split(' ');
      for (const name of names) {
        if (!(name in attrs) || geometry === 1) continue;
        const value = attrs[name];
        el.setAttribute(name, value.includes('%') ? value : list(value, geometry));
      }
      if (attrs.viewBox) el.setAttribute('viewBox', list(attrs.viewBox, content));
      if (tag === 'path' && attrs.d && content !== 1) el.setAttribute('d', SvgPath(attrs.d).scale(content).round(9).toString());
      if ((tag === 'polygon' || tag === 'polyline') && attrs.points && content !== 1) el.setAttribute('points', list(attrs.points, content));
      // pathLength is a calibration value, not a coordinate: keep it unchanged.
      for (const name of strokeLengths) {
        const value = el.style.getPropertyValue(name) || attrs[name];
        if (!value || content === 1 || (attrs.pathLength && name !== 'stroke-width')) continue;
        const converted = list(value, content);
        if (el.style.getPropertyValue(name)) el.style.setProperty(name, converted);
        if (name in attrs) el.setAttribute(name, converted);
      }
      for (const name of ['transform', 'gradientTransform', 'patternTransform']) transform(el, name, attrs[name], geometry);
      if (el.style.transform && el.style.transform !== 'none') {
        const matrix = new DOMMatrix(el.style.transform);
        if (!matrix.is2D) throw new Error('Expand 3D transforms before exporting SVG.');
        matrix.e *= geometry; matrix.f *= geometry;
        el.style.transform = matrix.toString();
        if (el.style.transformOrigin) el.style.transformOrigin = list(el.style.transformOrigin, geometry).split(' ').map(v => v.endsWith('%') ? v : `${v}px`).join(' ');
      }
      const effectLengths = tag === 'feOffset' ? ['dx','dy'] : tag === 'feGaussianBlur' ? ['stdDeviation'] : tag === 'feMorphology' ? ['radius'] : [];
      for (const name of effectLengths) if (name in attrs) el.setAttribute(name, list(attrs[name], content));
      // A shared <use> target may live in a different coordinate system (e.g.
      // a user-space path referenced by an objectBoundingBox clip).
      if (tag === 'use') {
        const target = byID.get(href(el)?.slice(1));
        const targetScale = contexts.get(target)?.geometry;
        if (targetScale && targetScale !== content) {
          if (target.localName === 'svg') throw new Error('Expand nested SVG references inside bounding-box effects before converting.');
          const ratio = content / targetScale;
          // x/y belong outside the instance scale.
          for (const name of ['x','y']) if (el.hasAttribute(name)) {
            if (attrs[name].includes('%')) throw new Error('Expand percentage-positioned references inside bounding-box effects before converting.');
            el.setAttribute(name, format(resolved[name]*content/ratio));
          }
          if (el.style.transform) el.style.transform += ` scale(${ratio})`;
          else el.setAttribute('transform', `${el.getAttribute('transform') || ''} scale(${ratio})`.trim());
        }
      }
    }
  };
})();
