// Turns a theme + style guidelines + reference images into a set of
// detailed, original line-art prompts — one per colouring-book page.
//
// Preferred path: Claude (vision) reads the references and writes prompts that
// capture the *style* while inventing *original* scenes. Fallback path: a local
// template that needs no API key, so the app always works.

import Anthropic from '@anthropic-ai/sdk';

// Constraints every colouring-book prompt must satisfy, regardless of theme.
const LINE_ART_RULES = [
  'black and white line art only, clean bold black outlines on a pure white background',
  'no shading, no greyscale, no solid black fills, no color',
  'closed, connected outlines suitable for colouring in',
  'clear large regions that are easy to colour',
  'single centered subject, generous white margins, printable page',
].join('; ');

const SYSTEM_PROMPT = `You are an art director for an original colouring book.
You are given a theme, optional written style guidelines, and optional reference images.
Your job: design ORIGINAL colouring-book pages that follow the STYLE and THEME of the
references without copying any specific copyrighted character or artwork.

For each page, write a single vivid image-generation prompt describing one original scene.
Every prompt MUST describe black-and-white line art: ${LINE_ART_RULES}.
Vary the subjects across pages so the book feels diverse. Keep each prompt under 80 words.`;

/**
 * @param {object} opts
 * @param {string} opts.theme
 * @param {string} [opts.styleGuidelines]
 * @param {number} opts.count
 * @param {Array<{base64:string, mediaType:string}>} [opts.referenceImages]
 * @param {string} [opts.complexity]  'simple' | 'medium' | 'detailed'
 * @returns {Promise<{prompts: string[], source: 'claude'|'template'}>}
 */
export async function buildPrompts(opts) {
  const { theme, styleGuidelines = '', count, referenceImages = [], complexity = 'medium' } = opts;

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const prompts = await buildWithClaude({ theme, styleGuidelines, count, referenceImages, complexity });
      if (prompts.length) return { prompts, source: 'claude' };
    } catch (err) {
      console.warn('[promptBuilder] Claude path failed, falling back to template:', err.message);
    }
  }
  return { prompts: buildWithTemplate({ theme, styleGuidelines, count, complexity }), source: 'template' };
}

async function buildWithClaude({ theme, styleGuidelines, count, referenceImages, complexity }) {
  const client = new Anthropic();

  const userContent = [];
  for (const img of referenceImages.slice(0, 6)) {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
    });
  }
  userContent.push({
    type: 'text',
    text: `Theme: ${theme}
Style guidelines: ${styleGuidelines || '(none provided — infer style from the reference images, or use a friendly clean default)'}
Line complexity: ${complexity}
Number of pages: ${count}

Return ${count} original page prompts.`,
  });

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'medium',
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            prompts: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['prompts'],
          additionalProperties: false,
        },
      },
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });

  const text = response.content.find((b) => b.type === 'text')?.text ?? '{}';
  const parsed = JSON.parse(text);
  const prompts = Array.isArray(parsed.prompts) ? parsed.prompts.slice(0, count) : [];
  // Defensively append the line-art rules in case the model under-specified them.
  return prompts.map((p) => ensureLineArt(p));
}

function buildWithTemplate({ theme, styleGuidelines, count, complexity }) {
  // A deterministic, key-free fallback. It rotates through a handful of scene
  // framings so the pages aren't identical, and folds the theme + style in.
  const framings = [
    'a single large friendly subject inspired by',
    'a playful scene built around',
    'a decorative pattern arrangement of',
    'a close-up portrait composition of',
    'a whimsical landscape featuring',
    'a symmetrical mandala-style design of',
  ];
  const detail =
    complexity === 'simple'
      ? 'few large simple shapes, very young-child friendly'
      : complexity === 'detailed'
        ? 'intricate fine details and patterns for older colourists'
        : 'a balanced amount of detail';

  const styleBit = styleGuidelines ? `, in the style of: ${styleGuidelines}` : '';
  const prompts = [];
  for (let i = 0; i < count; i++) {
    const framing = framings[i % framings.length];
    prompts.push(
      ensureLineArt(`${framing} ${theme}${styleBit}; ${detail}`),
    );
  }
  return prompts;
}

function ensureLineArt(prompt) {
  const lower = prompt.toLowerCase();
  if (lower.includes('line art') || lower.includes('line-art')) return prompt;
  return `${prompt.trim()} — ${LINE_ART_RULES}.`;
}
