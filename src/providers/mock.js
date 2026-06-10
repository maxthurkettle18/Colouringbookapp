// Key-free placeholder image generator. It draws a procedural, colouring-book
// style line-art page (outlined shapes on white) so the whole pipeline —
// generate -> clean -> assemble PDF — works before you add any API key.
//
// It is NOT meant to be good art; it proves the plumbing and lets you click
// through the real UX. Swap in a hosted image API for actual designs.

import sharp from 'sharp';

export function isAvailable() {
  return true; // always available
}

// Deterministic-ish PRNG seeded from the prompt so each page looks different
// but is reproducible for the same prompt.
function seededRandom(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function flower(cx, cy, r, petals, rnd) {
  let path = '';
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    path += `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${(r * 0.5).toFixed(1)}" ry="${(r * 0.28).toFixed(1)}" transform="rotate(${((a * 180) / Math.PI).toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)})"/>`;
  }
  path += `<circle cx="${cx}" cy="${cy}" r="${(r * 0.45).toFixed(1)}"/>`;
  return path;
}

/**
 * @param {string} prompt
 * @param {object} [opts]
 * @param {number} [opts.size] pixel size (square)
 * @returns {Promise<Buffer>} PNG buffer
 */
export async function generate(prompt, opts = {}) {
  const size = opts.size || 1024;
  const rnd = seededRandom(prompt);
  const shapes = [];

  // A few big flowers
  const flowers = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < flowers; i++) {
    const cx = 150 + rnd() * (size - 300);
    const cy = 150 + rnd() * (size - 300);
    const r = 70 + rnd() * 110;
    shapes.push(flower(cx, cy, r, 5 + Math.floor(rnd() * 4), rnd));
  }
  // Some circles / leaves
  const blobs = 4 + Math.floor(rnd() * 6);
  for (let i = 0; i < blobs; i++) {
    const cx = 80 + rnd() * (size - 160);
    const cy = 80 + rnd() * (size - 160);
    const r = 25 + rnd() * 70;
    if (rnd() > 0.5) {
      shapes.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}"/>`);
    } else {
      shapes.push(
        `<path d="M ${cx.toFixed(1)} ${(cy - r).toFixed(1)} Q ${(cx + r).toFixed(1)} ${cy.toFixed(1)} ${cx.toFixed(1)} ${(cy + r).toFixed(1)} Q ${(cx - r).toFixed(1)} ${cy.toFixed(1)} ${cx.toFixed(1)} ${(cy - r).toFixed(1)} Z"/>`,
      );
    }
  }
  // A decorative border
  const m = 40;
  shapes.push(
    `<rect x="${m}" y="${m}" width="${size - 2 * m}" height="${size - 2 * m}" rx="24"/>`,
  );

  const label = String(prompt).slice(0, 40).replace(/[<&>]/g, '');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="white"/>
    <g fill="none" stroke="black" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
      ${shapes.join('\n      ')}
    </g>
    <text x="${size / 2}" y="${size - 16}" font-family="sans-serif" font-size="18" fill="black" text-anchor="middle">mock preview · ${label}</text>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
