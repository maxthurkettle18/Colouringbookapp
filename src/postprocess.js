// Cleans a generated image into print-friendly colouring-book line art:
// grayscale -> normalize -> threshold to pure black on white.
//
// This guarantees a colourable page even if the image model returns some
// shading or off-white tones. Tune `threshold` for thicker/thinner lines.

import sharp from 'sharp';

/**
 * @param {Buffer} pngBuffer
 * @param {object} [opts]
 * @param {number} [opts.threshold] 0-255; higher keeps more as black
 * @returns {Promise<Buffer>} cleaned PNG buffer
 */
export async function toLineArt(pngBuffer, opts = {}) {
  const threshold = opts.threshold ?? 200;
  return sharp(pngBuffer)
    .flatten({ background: '#ffffff' }) // remove any alpha -> white
    .grayscale()
    .normalize()
    .threshold(threshold) // pure black/white
    .png()
    .toBuffer();
}
