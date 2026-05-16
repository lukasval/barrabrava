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
  // Nakama's Goja runtime calls r.Get("InitModule") internally from registerRpc
  // native code — needs a true `function InitModule(...)` DECLARATION at script
  // top level. `var InitModule = expr` does not hoist into Goja's script global
  // the way a function declaration does. Wrap the IIFE export as a forwarding
  // function declaration so registerRpc's internal lookup succeeds.
  footer: {
    js: 'function InitModule(ctx, logger, nk, initializer) { return __bbmod.InitModule(ctx, logger, nk, initializer); }',
  },
  external: ['nakama-runtime'],
  logLevel: 'info',
});

console.log('Built nakama/build/index.js');
