const form = document.getElementById('form');
const go = document.getElementById('go');
const results = document.getElementById('results');
const grid = document.getElementById('grid');
const meta = document.getElementById('meta');
const pdfLink = document.getElementById('pdf');
const statusEl = document.getElementById('status');

// Show backend status on load.
fetch('/api/status')
  .then((r) => r.json())
  .then((s) => {
    statusEl.textContent = `image: ${s.imageProvider} · prompts: ${s.claudePrompts ? 'Claude' : 'template'} — ${s.note}`;
  })
  .catch(() => { statusEl.textContent = ''; });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  go.disabled = true;
  go.textContent = 'Generating… (this can take a moment)';
  results.classList.add('hidden');
  grid.innerHTML = '';

  try {
    const data = new FormData(form);
    const res = await fetch('/api/generate', { method: 'POST', body: data });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Generation failed');

    meta.textContent = `${json.pages.length} pages · prompts via ${json.promptSource} · images via ${json.imageProvider}`;
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
    results.classList.remove('hidden');
    results.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    alert(err.message);
  } finally {
    go.disabled = false;
    go.textContent = 'Generate book';
  }
});
