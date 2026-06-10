// Real image generation via OpenAI's image API (gpt-image-1).
// Returns a PNG buffer for a given prompt.

import OpenAI from 'openai';

export function isAvailable() {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * @param {string} prompt
 * @param {object} [opts]
 * @param {string} [opts.size]  e.g. '1024x1024'
 * @returns {Promise<Buffer>} PNG image buffer
 */
export async function generate(prompt, opts = {}) {
  const client = new OpenAI();
  const size = opts.size || '1024x1024';

  const result = await client.images.generate({
    model: 'gpt-image-1',
    prompt,
    size,
    n: 1,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI image response contained no image data');
  return Buffer.from(b64, 'base64');
}
