import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

import { buildPrompts } from './promptBuilder.js';
import { selectProvider } from './providers/index.js';
import { toLineArt } from './postprocess.js';
import { buildPdf } from './pdf.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'out');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(ROOT, 'public')));
app.use('/out', express.static(OUT_DIR));

// ---- In-memory job store (prototype). Jobs expire after 30 minutes. ----
const jobs = new Map();
function putJob(job) {
  jobs.set(job.id, job);
  setTimeout(() => jobs.delete(job.id), 30 * 60 * 1000).unref?.();
}

function pageSize(providerName) {
  return providerName === 'mock' ? 1024 : '1024x1024';
}

async function renderPage(provider, prompt, quality) {
  const raw = await provider.generate(prompt, { size: pageSize(provider.name), quality });
  return { buffer: await toLineArt(raw), prompt };
}

// ---- Status: which backends are live ----
app.get('/api/status', (req, res) => {
  const provider = selectProvider();
  res.json({
    imageProvider: provider.name,
    claudePrompts: Boolean(process.env.ANTHROPIC_API_KEY),
    note:
      provider.name === 'mock'
        ? 'Running in mock mode — add OPENAI_API_KEY to .env for real designs.'
        : 'Live image generation enabled.',
  });
});

// ---- Phase 1: build the full prompt set, render ONE draft page for approval ----
app.post('/api/preview', upload.array('references', 6), async (req, res) => {
  try {
    const theme = (req.body.theme || '').trim();
    const styleGuidelines = (req.body.style || '').trim();
    const count = Math.min(Math.max(parseInt(req.body.count, 10) || 4, 1), 40);
    const complexity = req.body.complexity || 'medium';
    const title = (req.body.title || 'My Colouring Book').trim();
    const quality = ['low', 'medium', 'high'].includes(req.body.quality) ? req.body.quality : 'low';

    if (!theme) return res.status(400).json({ error: 'Please provide a theme.' });

    const referenceImages = (req.files || []).map((f) => ({
      base64: f.buffer.toString('base64'),
      mediaType: f.mimetype,
    }));

    // One Claude call builds prompts for the WHOLE book. Approving later spends
    // only on images — no further token cost.
    const { prompts, source } = await buildPrompts({
      theme,
      styleGuidelines,
      count,
      referenceImages,
      complexity,
    });

    const provider = selectProvider();
    const firstPage = await renderPage(provider, prompts[0], quality);

    const job = {
      id: randomUUID(),
      createdAt: Date.now(),
      settings: { title, quality, providerName: provider.name },
      prompts,
      pages: new Array(prompts.length),
      status: 'preview',
      progress: { done: 1, total: prompts.length },
      pdfPath: null,
      error: null,
    };
    job.pages[0] = firstPage;
    putJob(job);

    res.json({
      jobId: job.id,
      count: prompts.length,
      promptSource: source,
      imageProvider: provider.name,
      preview: {
        prompt: firstPage.prompt,
        image: `data:image/png;base64,${firstPage.buffer.toString('base64')}`,
      },
    });
  } catch (err) {
    console.error('[preview] error:', err);
    res.status(500).json({ error: err.message || 'Preview failed' });
  }
});

// ---- Phase 2: approve -> generate the remaining pages in the background ----
app.post('/api/book/:id/approve', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found or expired. Please preview again.' });
  if (job.status === 'generating') return res.json({ started: true, total: job.progress.total });

  job.status = 'generating';
  res.json({ started: true, total: job.progress.total });

  // Run async after responding. Page 0 already exists (the approved draft).
  (async () => {
    try {
      const provider = selectProvider();
      const { quality } = job.settings;
      const concurrency = Math.min(provider.name === 'mock' ? 8 : 4, job.prompts.length - 1) || 1;

      let nextIndex = 1; // page 0 is the approved draft
      async function worker() {
        while (true) {
          const i = nextIndex++;
          if (i >= job.prompts.length) break;
          job.pages[i] = await renderPage(provider, job.prompts[i], quality);
          job.progress.done++;
        }
      }
      await Promise.all(Array.from({ length: concurrency }, worker));

      const pdf = await buildPdf(job.pages, { title: job.settings.title });
      await fs.mkdir(OUT_DIR, { recursive: true });
      const pdfName = `colouring-book-${Date.now()}.pdf`;
      await fs.writeFile(path.join(OUT_DIR, pdfName), pdf);
      job.pdfPath = `/out/${pdfName}`;
      job.status = 'done';
    } catch (err) {
      console.error('[approve] generation error:', err);
      job.status = 'error';
      job.error = err.message || 'Generation failed';
    }
  })();
});

// ---- Poll progress; returns full pages + PDF link once done ----
app.get('/api/book/:id/status', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found or expired.' });

  const body = { status: job.status, progress: job.progress, error: job.error };
  if (job.status === 'done') {
    body.pdf = job.pdfPath;
    body.pages = job.pages.map((p) => ({
      prompt: p.prompt,
      image: `data:image/png;base64,${p.buffer.toString('base64')}`,
    }));
  }
  res.json(body);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const provider = selectProvider();
  console.log(`\n  Colouring Book Generator running at http://localhost:${PORT}`);
  console.log(`  Image provider: ${provider.name}${provider.name === 'mock' ? ' (add OPENAI_API_KEY for real designs)' : ''}`);
  console.log(`  Claude prompts: ${process.env.ANTHROPIC_API_KEY ? 'on' : 'off (using template fallback)'}\n`);
});
