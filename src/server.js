import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'node:path';
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

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(ROOT, 'public')));
app.use('/out', express.static(OUT_DIR));

// Report which backends are active so the UI can show status.
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

// Main generation endpoint. Accepts theme/style + optional reference images,
// returns the cleaned page images (as data URLs) and a downloadable PDF path.
app.post('/api/generate', upload.array('references', 6), async (req, res) => {
  try {
    const theme = (req.body.theme || '').trim();
    const styleGuidelines = (req.body.style || '').trim();
    const count = Math.min(Math.max(parseInt(req.body.count, 10) || 4, 1), 12);
    const complexity = req.body.complexity || 'medium';
    const title = (req.body.title || 'My Colouring Book').trim();

    if (!theme) return res.status(400).json({ error: 'Please provide a theme.' });

    const referenceImages = (req.files || []).map((f) => ({
      base64: f.buffer.toString('base64'),
      mediaType: f.mimetype,
    }));

    // 1. Prompts (Claude or template fallback)
    const { prompts, source } = await buildPrompts({
      theme,
      styleGuidelines,
      count,
      referenceImages,
      complexity,
    });

    // 2. Generate + 3. clean each page
    const provider = selectProvider();
    const pages = [];
    for (const prompt of prompts) {
      const raw = await provider.generate(prompt, { size: provider.name === 'mock' ? 1024 : '1024x1024' });
      const clean = await toLineArt(raw);
      pages.push({ buffer: clean, prompt });
    }

    // 4. Assemble PDF
    const pdf = await buildPdf(pages, { title });
    await fs.mkdir(OUT_DIR, { recursive: true });
    const stamp = Date.now();
    const pdfName = `colouring-book-${stamp}.pdf`;
    await fs.writeFile(path.join(OUT_DIR, pdfName), pdf);

    res.json({
      promptSource: source,
      imageProvider: provider.name,
      pdf: `/out/${pdfName}`,
      pages: pages.map((p) => ({
        prompt: p.prompt,
        image: `data:image/png;base64,${p.buffer.toString('base64')}`,
      })),
    });
  } catch (err) {
    console.error('[generate] error:', err);
    res.status(500).json({ error: err.message || 'Generation failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const provider = selectProvider();
  console.log(`\n  Colouring Book Generator running at http://localhost:${PORT}`);
  console.log(`  Image provider: ${provider.name}${provider.name === 'mock' ? ' (add OPENAI_API_KEY for real designs)' : ''}`);
  console.log(`  Claude prompts: ${process.env.ANTHROPIC_API_KEY ? 'on' : 'off (using template fallback)'}\n`);
});
