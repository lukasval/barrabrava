// esbuild bundler — emits a single IIFE for Nakama's V8 runtime.
// __CLUBS_JSON__ is inlined at build time so the runtime does not need filesystem access.

import { build } from 'esbuild';
import { readFileSync } from 'fs';

const clubsJson = readFileSync('./data/clubs.json', 'utf-8');

await build({
  entryPoints: ['src/main.ts'],
  outfile: 'build/index.js',
  bundle: true,
  format: 'iife',
  globalName: '__bbmod',
  target: 'es2017',
  platform: 'neutral',
  define: {
    __CLUBS_JSON__: JSON.stringify(clubsJson),
  },
  // Nakama's V8 scanner only finds `InitModule` if it's a true top-level binding.
  // The IIFE hides our export, so we hoist it back out via a footer:
  footer: {
    js: 'var InitModule = __bbmod.InitModule;',
  },
  external: ['nakama-runtime'],
  logLevel: 'info',
});

console.log('Built nakama/build/index.js');
