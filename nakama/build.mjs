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
  target: 'es2017',
  platform: 'neutral',
  define: {
    __CLUBS_JSON__: JSON.stringify(clubsJson),
  },
  external: ['nakama-runtime'],
  logLevel: 'info',
});

console.log('Built nakama/build/index.js');
