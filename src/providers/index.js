// Selects an image provider based on env config and availability.

import * as openai from './openai.js';
import * as mock from './mock.js';

export function selectProvider() {
  const choice = (process.env.IMAGE_PROVIDER || 'auto').toLowerCase();

  if (choice === 'openai') return { name: 'openai', ...openai };
  if (choice === 'mock') return { name: 'mock', ...mock };

  // auto
  if (openai.isAvailable()) return { name: 'openai', ...openai };
  return { name: 'mock', ...mock };
}
