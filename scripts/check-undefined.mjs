/* ─── NAMES THAT DON'T EXIST ──────────────────────────────────────────
   `<MediaLibrarySheet …>` was rendered in the capture screen without
   ever being imported. Nothing caught it: Metro bundles fine, the
   export succeeds, the app boots, the boot check passes — because the
   line only runs when somebody opens the library. It reached a real
   phone and crashed the tab with "Can't find variable:
   MediaLibrarySheet", which took sending a message and picking a video
   down with it. `<EffectsSheet>` was one tap from doing the same.

   That is the worst shape a bug can have: invisible to every automatic
   check and guaranteed to hit a person. And it is not only a component
   problem — calling a helper you forgot to import fails in exactly the
   same way, just as silently.

   So this asks Babel, not a regular expression. It parses every file,
   walks the real scope chain, and reports any identifier that is
   referenced but bound nowhere: not imported, not declared, not a
   parameter, not a global. A regex cannot tell a variable from a
   property or a string, and a check that cries wolf gets switched off.

   Run it before deploying — the workflow already does:

       node scripts/check-undefined.mjs
*/

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = _traverse.default || _traverse;

const ROOTS = ['src', 'App.js'];

/* Things that genuinely exist at runtime but are bound outside any
   file: browser and React Native globals, and the bundler's own. Every
   entry here is a blind spot, so it stays as short as it can be. */
const GLOBALS = new Set([
  // language
  'globalThis', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Symbol', 'BigInt',
  'Math', 'JSON', 'Date', 'RegExp', 'Error', 'TypeError', 'RangeError', 'Promise', 'Function',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Proxy', 'Reflect', 'Intl', 'ArrayBuffer',
  'DataView', 'Uint8Array', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array',
  'Float32Array', 'Float64Array', 'Int8Array', 'Uint8ClampedArray',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'NaN', 'Infinity', 'undefined',
  'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI', 'escape', 'unescape',
  'require', 'module', 'exports', 'process', 'Buffer', 'console', 'structuredClone',
  // timers + web
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame', 'queueMicrotask',
  'window', 'document', 'navigator', 'location', 'history', 'screen',
  'localStorage', 'sessionStorage', 'fetch', 'Headers', 'Request', 'Response',
  'FormData', 'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'AbortController',
  'Image', 'Audio', 'Event', 'CustomEvent', 'MessageChannel', 'MutationObserver',
  'IntersectionObserver', 'ResizeObserver', 'WebSocket', 'XMLHttpRequest',
  'MediaRecorder', 'MediaStream', 'AudioContext', 'webkitAudioContext',
  'RTCPeerConnection', 'RTCSessionDescription', 'RTCIceCandidate',
  'PromiseRejectionEvent', 'DOMParser', 'atob', 'btoa', 'crypto', 'performance',
  'alert', 'confirm', 'prompt', 'getComputedStyle', 'matchMedia',
  // react native / expo
  '__DEV__', 'global', 'HermesInternal', 'nativeCallSyncHook', 'ErrorUtils',
  // three.js and Leaflet arrive on window from a script tag
  'THREE', 'L',
]);

function collect(target, out) {
  if (!existsSync(target)) return out;
  if (statSync(target).isDirectory()) {
    for (const e of readdirSync(target)) collect(join(target, e), out);
  } else if (/\.jsx?$/.test(target)) out.push(target);
  return out;
}

const files = collect(ROOTS[0], []).concat(collect(ROOTS[1], []));
const problems = [];

for (const file of files) {
  let ast;
  try {
    ast = parse(readFileSync(file, 'utf8'), {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport'],
      errorRecovery: true,
    });
  } catch (e) {
    problems.push(relative('.', file) + '  could not be parsed: ' + e.message);
    continue;
  }

  traverse(ast, {
    // every reference that resolves to nothing anywhere up the scope chain
    ReferencedIdentifier(path) {
      const name = path.node.name;
      if (GLOBALS.has(name)) return;
      if (path.scope.hasBinding(name, true)) return;
      const line = path.node.loc && path.node.loc.start.line;
      const isComponent = /^[A-Z]/.test(name);
      problems.push(
        relative('.', file) + ':' + line + '  ' +
        (isComponent ? '<' + name + '>' : name + '()') +
        ' is used but bound nowhere — not imported, not declared'
      );
    },
  });
}

if (problems.length) {
  console.error('Names used that do not exist:\n');
  problems.forEach((p) => console.error('  ' + p));
  console.error('\n' + problems.length + ' problem(s). Each one throws the moment that line runs.');
  process.exit(1);
}
console.log('Checked ' + files.length + ' files: every name used exists where it is used.');
