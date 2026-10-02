import { trimSvg } from './trim-svg.js';

const drop = document.getElementById('drop-area');
const input = document.getElementById('file-input');
const results = document.getElementById('results');
const status = document.getElementById('status');
const clear = document.getElementById('clear');
const urls = new Set();
const queue = [];
let running = false;
let completed = 0;
let failed = 0;

drop.addEventListener('click', () => input.click());
input.addEventListener('change', () => { enqueue(input.files); input.value = ''; });
let dragDepth = 0;
drop.addEventListener('dragenter', event => { event.preventDefault(); dragDepth++; drop.classList.add('dragging'); });
drop.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; });
drop.addEventListener('dragleave', () => { if (--dragDepth <= 0) drop.classList.remove('dragging'); });
drop.addEventListener('drop', event => {
  event.preventDefault(); dragDepth = 0; drop.classList.remove('dragging'); enqueue(event.dataTransfer.files);
});
// Dropping outside the button should not navigate away and lose a batch.
window.addEventListener('dragover', event => event.preventDefault());
window.addEventListener('drop', event => event.preventDefault());

function enqueue(files) {
  for (const file of files) {
    const row = document.createElement('li');
    const copy = document.createElement('span'); copy.className = 'file-copy';
    const name = document.createElement('span'); name.className = 'file-name'; name.textContent = file.name;
    const detail = document.createElement('span'); detail.className = 'file-detail'; detail.textContent = 'Queued';
    copy.append(name, detail); row.append(copy); results.append(row);
    queue.push({ file, row, detail });
  }
  if (results.children.length > 1) document.getElementById('download-note').hidden = false;
  clear.hidden = results.children.length === 0;
  processQueue();
}

const number = value => new Intl.NumberFormat('en', { maximumFractionDigits: 3 }).format(value);
async function processQueue() {
  if (running) return;
  running = true; clear.disabled = true;
  while (queue.length) {
    const { file, row, detail } = queue.shift();
    detail.textContent = 'Trimming…'; status.textContent = `Processing ${file.name}`;
    await new Promise(resolve => setTimeout(resolve, 0));
    try {
      if (!/\.svg$/i.test(file.name)) throw new Error('Choose an SVG file.');
      if (file.size > 20 * 1024 * 1024) throw new Error('This file is over the 20 MB limit.');
      const result = await trimSvg(await file.text());
      const url = URL.createObjectURL(new Blob([result.svg], { type: 'image/svg+xml' })); urls.add(url);
      const link = document.createElement('a'); link.href = url;
      link.download = file.name.replace(/\.svg$/i, '') + '-trimmed.svg';
      link.textContent = 'Download'; link.setAttribute('aria-label', `Download ${link.download}`);
      row.append(link);
      detail.textContent = result.changed
        ? `${number(result.width)} × ${number(result.height)} → ${number(result.croppedWidth)} × ${number(result.croppedHeight)} px`
        : 'Already trimmed — original size kept';
      link.click(); completed++;
      // Space out requests; browsers may still require multiple-download permission.
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      row.classList.add('error'); detail.textContent = error.message || 'Could not trim this file.'; failed++;
    }
  }
  running = false; clear.disabled = false;
  status.textContent = `${completed} ${completed === 1 ? 'file' : 'files'} ready${failed ? ` · ${failed} could not be trimmed` : ''}.`;
}

clear.addEventListener('click', () => {
  if (running) return;
  for (const url of urls) URL.revokeObjectURL(url);
  urls.clear(); results.replaceChildren(); status.textContent = '';
  completed = failed = 0; clear.hidden = true; document.getElementById('download-note').hidden = true;
});
window.addEventListener('pagehide', event => {
  if (!event.persisted) for (const url of urls) URL.revokeObjectURL(url);
});
