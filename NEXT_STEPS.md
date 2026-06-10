# Project handoff & next steps

Notes to resume the Colouring Book Generator on another machine.

## Where this is committed

- Branch: `claude/admiring-cori-0vmbhz`
- Everything below is already pushed. Clone the repo, `git checkout claude/admiring-cori-0vmbhz`.

## How to run it at home

```bash
# Requires Node.js 18+ (download "LTS" from nodejs.org if needed)
git clone <your repo URL>
cd Colouringbookapp
git checkout claude/admiring-cori-0vmbhz
npm install
npm start
# open http://localhost:3000
```

Runs in **mock mode (free)** out of the box — full flow works with no keys.

To enable real designs: `cp .env.example .env`, then add:
- `OPENAI_API_KEY` — real line-art images (gpt-image-1)
- `ANTHROPIC_API_KEY` — Claude writes the prompts from your references

## What works today (current state)

- Web UI: theme, style guidelines, page count (up to 40, default 28),
  detail level, image-quality selector, reference image upload.
- **Two-phase flow** (saves tokens):
  1. "Preview style (1 page)" renders ONE draft. Claude builds the whole
     prompt set here — approving spends only on images, no extra token cost.
  2. Approve → full book generates with a live progress bar.
  3. Download print-ready PDF (title page + N designs).
- Image generation runs 4-at-a-time (concurrency) so a 28-page book takes
  ~2 min instead of ~9.
- Line-art clean-up (pure black-on-white) + A4 PDF assembly.
- Graceful fallbacks: mock image generator + template prompt builder when
  no keys are set.

## Costs (with keys, per book)

| Quality | per page | 28-page book |
|---------|----------|--------------|
| Draft   | ~$0.01   | ~$0.35       |
| Medium  | ~$0.04   | ~$1.20       |
| High    | ~$0.17   | ~$4.80       |

Plus ~$0.05–0.10 for the one Claude prompt call per book. Verify current
rates on OpenAI's pricing page — image prices change. Mock mode = $0.

## Roadmap / next features (in rough priority order)

1. **Tighter style matching** — THE big quality upgrade. Right now the image
   model is stateless, so the 28 pages share a style *direction* but aren't
   guaranteed to match pixel-for-pixel. Options:
   - Reference-image conditioning (IP-Adapter / "style reference") via a
     hosted or self-hosted model.
   - Train a per-style LoRA on a small set of reference pages (self-hosted
     SDXL/Flux). Highest fidelity, most setup.
2. **Per-page regenerate** — redo just the few pages you don't like instead
   of the whole book.
3. **Vectorize to SVG** (e.g. `potrace`) so pages print crisp at any size.
4. **Self-hosted generation** (SDXL/Flux on a GPU) — near-zero per-image
   cost at volume, in exchange for setup.
5. **Cover page / page numbers / book metadata** options.
6. **Save & reload projects** (currently jobs are in-memory and expire after
   30 min).

## Known limitations to keep in mind

- Job state is in-memory only — restarting the server loses in-progress jobs.
- Mock art is placeholder geometry, not real designs (proves the pipeline).
- Approval proves the *style is on track*, not that every page is identical
  (see roadmap item #1).
- Copyright: use references as style/theme *inspiration* for original output;
  don't train on or closely reproduce someone else's copyrighted art.

## File map

| Path | Purpose |
|------|---------|
| `src/server.js` | Express + two-phase job flow (preview / approve / status) |
| `src/promptBuilder.js` | Claude-or-template prompt generation |
| `src/providers/` | Swappable image backends (`openai`, `mock`) |
| `src/postprocess.js` | Line-art clean-up (sharp) |
| `src/pdf.js` | Print-ready PDF assembly (pdfkit) |
| `public/` | Web UI (index.html, app.js, styles.css) |
| `.env.example` | Copy to `.env` to add keys |
