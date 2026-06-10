const form = document.getElementById('form');
const go = document.getElementById('go');
const statusEl = document.getElementById('status');

const previewSec = document.getElementById('preview');
const previewImg = document.getElementById('previewImg');
const previewCap = document.getElementById('previewCap');
const previewMeta = document.getElementById('previewMeta');
const approveBtn = document.getElementById('approve');
const retryBtn = document.getElementById('retry');

const progressSec = document.getElementById('progress');
const barFill = document.getElementById('barFill');
const progressLabel = document.getElementById('progressLabel');

const results = document.getElementById('results');
const grid = document.getElementById('grid');
const meta = document.getElementById('meta');
const pdfLink = document.getElementById('pdf');

let currentJob = null;
let currentCount = 0;

// Backend status badge
fetch('/api/status')
  .then((r) => r.json())
  .then((s) => {
    statusEl.textContent = `image: ${s.imageProvider} · prompts: ${s.claudePrompts ? 'Claude' : 'template'} — ${s.note}`;
  })
  .catch(() => { statusEl.textContent = ''; });

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

// ---- Step 1: preview a single draft page ----
async function runPreview() {
  go.disabled = true;
  go.textContent = 'Rendering draft…';
  hide(previewSec); hide(progressSec); hide(results);
  try {
    const data = new FormData(form);
    const res = await fetch('/api/preview', { method: 'POST', body: data });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Preview failed');

    currentJob = json.jobId;
    currentCount = json.count;
    previewImg.src = json.preview.image;
    previewCap.textContent = json.preview.prompt;
    previewMeta.textContent = `Draft 1 of ${json.count} · prompts via ${json.promptSource} · images via ${json.imageProvider}. Approve to generate the rest.`;
    show(previewSec);
    previewSec.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    alert(err.message);
  } finally {
    go.disabled = false;
    go.textContent = 'Preview style (1 page)';
  }
}

form.addEventListener('submit', (e) => { e.preventDefault(); runPreview(); });
retryBtn.addEventListener('click', () => runPreview());

// ---- Step 2: approve -> generate full book with progress ----
approveBtn.addEventListener('click', async () => {
  if (!currentJob) return;
  approveBtn.disabled = true;
  try {
    const res = await fetch(`/api/book/${currentJob}/approve`, { method: 'POST' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Could not start generation');

    hide(previewSec);
    show(progressSec);
    setProgress(1, currentCount);
    progressSec.scrollIntoView({ behavior: 'smooth' });
    pollStatus();
  } catch (err) {
    alert(err.message);
    approveBtn.disabled = false;
  }
});

function setProgress(done, total) {
  const pct = Math.round((done / total) * 100);
  barFill.style.width = `${pct}%`;
  progressLabel.textContent = `Page ${done} of ${total}`;
}

async function pollStatus() {
  try {
    const res = await fetch(`/api/book/${currentJob}/status`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Status check failed');

    if (json.status === 'generating') {
      setProgress(json.progress.done, json.progress.total);
      setTimeout(pollStatus, 1000);
      return;
    }
    if (json.status === 'error') throw new Error(json.error || 'Generation failed');
    if (json.status === 'done') {
      setProgress(json.progress.total, json.progress.total);
      renderResults(json);
    }
  } catch (err) {
    alert(err.message);
    approveBtn.disabled = false;
    hide(progressSec);
    show(previewSec);
  }
}

function renderResults(json) {
  grid.innerHTML = '';
  meta.textContent = `${json.pages.length} pages`;
  pdfLink.href = json.pdf;
  for (const page of json.pages) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    const img = document.createElement('img');
    img.src = page.image;
    img.alt = page.prompt;
    const cap = document.createElement('div');
    cap.className = 'cap';
    cap.textContent = page.prompt;
    tile.append(img, cap);
    grid.append(tile);
  }
  hide(progressSec);
  show(results);
  approveBtn.disabled = false;
  results.scrollIntoView({ behavior: 'smooth' });
}
