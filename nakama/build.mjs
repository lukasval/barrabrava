// esbuild bundler for Nakama's V8 (Goja) runtime.
// __CLUBS_JSON__ is inlined at build time so the runtime does not need filesystem access.
//
// Goja's r.Get("InitModule") (called from registerRpc native code) only finds
// bindings that live at the SCRIPT top level — not inside an IIFE wrapper.
// We bundle with format=iife, then strip the wrapper post-build so every
// `var` and `function` declaration in the bundle ends up on globalThis.

import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';

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
  external: ['nakama-runtime'],
  logLevel: 'info',
});

// --- Post-process: unwrap IIFE so all declarations are top-level ---
const out = readFileSync('build/index.js', 'utf-8');

// esbuild emits exactly:
//   "use strict";
//   var __bbmod = (() => {  ... body ...
//     return __toCommonJS(main_exports);
//   })();
// We need to:
//   1. Drop `"use strict";` (forces strict mode — declarations less global-bound)
//   2. Replace the IIFE opening with empty
//   3. Replace the IIFE closing with code that hoists InitModule to globalThis
const HEAD = /^"use strict";\s*\nvar __bbmod = \(\(\) => \{\s*\n/;
const TAIL = /\s*return __toCommonJS\(main_exports\);\s*\}\)\(\);\s*$/;

if (!HEAD.test(out)) throw new Error('Bundle head does not match expected IIFE opening');
if (!TAIL.test(out)) throw new Error('Bundle tail does not match expected IIFE closing');

const unwrapped =
  out.replace(HEAD, '// BarraBrava runtime — unwrapped IIFE for Goja top-level lookup\n')
     .replace(
       TAIL,
       '\n// InitModule is already a top-level `var` after unwrapping.\n// Ensure Goja r.Get("InitModule") finds it via globalThis.\nthis.InitModule = InitModule;\n',
     );

writeFileSync('build/index.js', unwrapped);

console.log('Built nakama/build/index.js (IIFE unwrapped)');
