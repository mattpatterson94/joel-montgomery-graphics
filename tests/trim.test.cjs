// Serve the repository at :8765; use Playwright and optional CHROMIUM_PATH.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const wrap = (body, attrs = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200" ${attrs}>${body}</svg>`;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, acceptDownloads: true });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://localhost:8765/tools/trim/');
    const trim = source => page.evaluate(async source => (await import('/tools/trim/trim-svg.js')).trimSvg(source), source);
    const sample = fs.readFileSync(path.join(__dirname, 'fixtures/trim/illustrator-clipped.svg'), 'utf8');
    const result = await trim(sample);
    assert.ok(result.croppedWidth >= 311 && result.croppedWidth <= 311.6);
    assert.equal(result.croppedHeight, 297.4);
    assert.ok(result.svg.includes('<path') && result.svg.includes('<clipPath'));
    assert.ok(result.svg.includes('fill="#fcd230"'));
    console.log('PASS: Illustrator sample trims to 297.4px high, retaining vector artwork.', result.bounds);

    const fixtures = [
      ['stroke', wrap('<circle cx="100" cy="100" r="40" fill="none" stroke="black" stroke-width="10"/>'), 90, 90],
      ['percentages', wrap('<rect x="25%" y="30%" width="50%" height="40%" fill="red"/>'), 100, 80],
      ['mask', wrap('<defs><mask id="m"><rect x="50" y="70" width="80" height="60" fill="white"/></mask></defs><rect width="200" height="200" fill="red" mask="url(#m)"/>'), 80, 60],
      ['nested clip + use', wrap('<defs><path id="p" d="M0 0H100V100H0Z"/><clipPath id="c"><circle cx="40" cy="40" r="20"/></clipPath></defs><g transform="translate(30 50)"><g clip-path="url(#c)"><use href="#p" fill="blue"/></g></g>'), 40, 40],
      ['objectBoundingBox clip', wrap('<defs><clipPath id="c" clipPathUnits="objectBoundingBox"><rect x=".25" y=".25" width=".5" height=".5"/></clipPath></defs><rect width="200" height="200" clip-path="url(#c)"/>'), 100, 100],
      ['soft filter', wrap('<defs><filter id="blur"><feGaussianBlur stdDeviation="3"/></filter></defs><rect x="70" y="70" width="60" height="60" filter="url(#blur)" fill="#abc"/>'), null, null],
      ['CSS and gradient', wrap('<defs><style>.paint {fill:url(#g)}</style><linearGradient id="g"><stop stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient></defs><path class="paint" d="M30 40h100v80H30Z"/>'), 100, 80],
      ['nonzero viewBox', '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="100 200 400 400"><rect x="200" y="300" width="200" height="200"/></svg>', 100, 100],
      ['no viewBox', '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect x="40" y="50" width="80" height="90"/></svg>', 80, 90],
      ['letterboxed viewBox', '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 200 200"><rect x="50" y="50" width="100" height="100"/></svg>', 100, 100],
    ];
    for (const [name, source, w, h] of fixtures) {
      const output = await trim(source);
      if (w) assert.ok(Math.abs(output.croppedWidth - w) < .6, `${name}: width ${output.croppedWidth}`);
      if (h) assert.ok(Math.abs(output.croppedHeight - h) < .6, `${name}: height ${output.croppedHeight}`);
      // Compare the rendered export with an equivalent crop of the source.
      const difference = await page.evaluate(async ({ source, output }) => {
        async function draw(svg, original) {
          const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
          try {
            const img = new Image(); img.src = url; await img.decode();
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(output.croppedWidth * 4); canvas.height = Math.ceil(output.croppedHeight * 4);
            const ctx = canvas.getContext('2d'); ctx.scale(4, 4);
            if (original) { ctx.translate(-output.bounds.left, -output.bounds.top); ctx.drawImage(img, 0, 0, output.width, output.height); }
            else ctx.drawImage(img, 0, 0, output.croppedWidth, output.croppedHeight);
            return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          } finally { URL.revokeObjectURL(url); }
        }
        const a = await draw(source, true), b = await draw(output.svg, false);
        let sum = 0;
        for (let i = 0; i < a.length; i += 4) {
          sum += Math.abs(a[i + 3] - b[i + 3]);
          for (let c = 0; c < 3; c++) sum += Math.abs(a[i + c] * a[i + 3] / 255 - b[i + c] * b[i + 3] / 255);
        }
        return sum / a.length;
      }, { source, output });
      assert.ok(difference < 1, `${name}: output appearance changed (${difference})`);
      console.log(`PASS: ${name}, render difference ${difference.toFixed(4)}`);
    }
    const full = wrap('<rect width="200" height="200" fill="white"/>');
    assert.equal((await trim(full)).svg, full);
    for (const source of [wrap(''), '<svg bad', wrap('<image href="https://example.com/image.png"/>'), wrap('<script>alert(1)</script>')]) {
      await assert.rejects(() => trim(source));
    }
    const downloads = []; page.on('download', d => downloads.push(d));
    await page.locator('#file-input').setInputFiles([
      { name: 'clipped.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(sample) },
      { name: 'invalid.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg bad') },
      { name: 'percent.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(fixtures[1][1]) },
    ]);
    await page.waitForFunction(() => document.querySelector('#status').textContent === '2 files ready · 1 could not be trimmed.');
    assert.equal(downloads.length, 2);
    assert.equal(downloads[0].suggestedFilename(), 'clipped-trimmed.svg');
    assert.equal(downloads[1].suggestedFilename(), 'percent-trimmed.svg');
    assert.equal(await page.locator('#results .error').count(), 1);
    assert.equal(await page.locator('#download-note').isVisible(), true);
    await page.screenshot({ path: '/tmp/svg-trim-desktop.png', fullPage: true });
    // Retry links work independently of automatic download permission.
    const retry = page.waitForEvent('download'); await page.locator('#results a').first().click(); await retry;
    // Exercise the actual drop handler, not just the file chooser.
    await page.evaluate(source => {
      const transfer = new DataTransfer(); transfer.items.add(new File([source], 'dropped.svg', { type: 'image/svg+xml' }));
      document.querySelector('#drop-area').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    }, full);
    await page.waitForFunction(() => document.querySelector('#status').textContent === '3 files ready · 1 could not be trimmed.');
    await page.setViewportSize({ width: 375, height: 850 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: '/tmp/svg-trim-mobile.png', fullPage: true });
    await page.locator('#clear').click(); assert.equal(await page.locator('#results li').count(), 0);
    await page.keyboard.press('Tab'); await page.locator('#drop-area').focus(); assert.equal(await page.locator('#drop-area').evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
    assert.deepEqual(errors, []);
    console.log('PASS: batch auto-downloads, failure isolation, retry, drop, clear, mobile and keyboard focus.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
