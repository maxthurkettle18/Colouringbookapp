# Colouring Book Generator

Generate **original** colouring-book line-art pages guided by your own **style and theme**
references, then export a print-ready PDF.

This is a working prototype. It runs end-to-end with **no API keys** using a built-in mock
image generator, and upgrades to real AI-generated designs when you add a key.

## How it works

```
theme + style + reference images
        │
        ▼
 1. Prompt building   ── Claude (vision) turns your references into detailed,
        │                original line-art prompts.  Falls back to a local
        │                template if no ANTHROPIC_API_KEY is set.
        ▼
 2. Image generation  ── A hosted image API (OpenAI gpt-image-1) renders each
        │                prompt.  Falls back to a procedural mock generator if
        │                no OPENAI_API_KEY is set.
        ▼
 3. Clean-up          ── Each image is forced to pure black-on-white line art
        │                (grayscale → threshold) so it's colourable.
        ▼
 4. PDF assembly      ── Pages are laid out into a print-ready A4 PDF.
```

Claude orchestrates and evaluates; the actual pixels come from a dedicated image model
(Claude does not generate images).

## Quick start

```bash
npm install
npm start
# open http://localhost:3000
```

That's it — you can generate a book immediately in **mock mode**.

## Enable real designs

Copy `.env.example` to `.env` and fill in:

- `ANTHROPIC_API_KEY` — lets Claude write strong, reference-aware prompts.
- `OPENAI_API_KEY` — lets the app generate real line-art images.

```bash
cp .env.example .env
# edit .env, then:
npm start
```

The UI shows which backends are active (top of the page).

## Project layout

| Path | Purpose |
|------|---------|
| `src/server.js` | Express server + `/api/generate` pipeline |
| `src/promptBuilder.js` | Claude-or-template prompt generation |
| `src/providers/` | Swappable image backends (`openai`, `mock`) |
| `src/postprocess.js` | Line-art clean-up (sharp) |
| `src/pdf.js` | Print-ready PDF assembly (pdfkit) |
| `public/` | Web UI |

## Roadmap / upgrade path

- **Tighter style matching** — add reference-image conditioning (IP-Adapter / style
  reference) or train a per-style LoRA for a self-hosted model.
- **Vectorize** pages to SVG (e.g. `potrace`) for crisp printing at any size.
- **Self-hosted generation** (SDXL / Flux) to cut per-image cost at volume.
- **Page editing / regeneration** of individual designs.

## A note on originality & copyright

Use references as *style/theme inspiration* for original output. Avoid training on or
closely reproducing someone else's copyrighted artwork or characters.
