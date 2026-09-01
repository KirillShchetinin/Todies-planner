// analyze-core.mjs — which files in frontend/common/ are self-contained enough
// to be shared with the iOS app verbatim.
//
// The web frontend has no modules: every file's top-level names land in one
// global scope, so a file can freely use a name another file declared without
// saying so. That is invisible until you try to import one file on its own.
// This walks each file's AST and reports, per file, the names it declares and
// the names it expects someone else to have declared.
//
//   node scripts/analyze-core.mjs

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

const COMMON_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend', 'common');

// Globals a React Native runtime provides too, so depending on them is fine.
const UNIVERSAL = new Set([
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Math', 'JSON', 'Date', 'RegExp',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Symbol', 'Error', 'TypeError',
  'Infinity', 'NaN', 'undefined', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'console', 'structuredClone', 'encodeURIComponent', 'decodeURIComponent',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'globalThis',
  'Intl', 'URLSearchParams', 'fetch', 'AbortController', 'TextEncoder', 'arguments',
]);

// Globals only a browser has. Depending on these at module scope is fatal;
// inside a function body it is merely a function RN must never call.
const BROWSER_ONLY = new Set([
  'document', 'window', 'location', 'navigator', 'localStorage', 'sessionStorage',
  'performance', 'matchMedia', 'HTMLElement', 'Element', 'Node', 'getComputedStyle',
  'requestAnimationFrame', 'alert', 'confirm', 'prompt', 'visualViewport',
]);

function declaredNames(node) {
  // Every binding a declaration introduces, including destructuring patterns.
  const out = [];
  const fromPattern = (p) => {
    if (!p) return;
    if (p.type === 'Identifier') out.push(p.name);
    else if (p.type === 'ObjectPattern') p.properties.forEach(pr => fromPattern(pr.value || pr.argument));
    else if (p.type === 'ArrayPattern') p.elements.forEach(fromPattern);
    else if (p.type === 'AssignmentPattern') fromPattern(p.left);
    else if (p.type === 'RestElement') fromPattern(p.argument);
  };
  if (node.type === 'VariableDeclaration') node.declarations.forEach(d => fromPattern(d.id));
  else if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
    if (node.id) out.push(node.id.name);
  }
  return out;
}

function analyze(file) {
  const src = readFileSync(join(COMMON_DIR, file), 'utf8');
  const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script' });

  const topLevel = [];
  for (const node of ast.body) topLevel.push(...declaredNames(node));
  const declared = new Set(topLevel);

  // Collect every identifier that is read, minus ones bound by any enclosing
  // scope. acorn-walk gives us scope-free traversal, so we approximate by
  // gathering all bindings anywhere in the file — conservative in the right
  // direction: it under-reports free variables rather than inventing them.
  const anyBinding = new Set(declared);
  walk.full(ast, (node) => {
    if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' ||
        node.type === 'ArrowFunctionExpression') {
      if (node.id) anyBinding.add(node.id.name);
      for (const p of node.params) {
        if (p.type === 'Identifier') anyBinding.add(p.name);
        else declaredNames({ type: 'VariableDeclaration', declarations: [{ id: p }] })
          .forEach(n => anyBinding.add(n));
      }
    } else if (node.type === 'VariableDeclaration') {
      declaredNames(node).forEach(n => anyBinding.add(n));
    } else if (node.type === 'CatchClause' && node.param) {
      anyBinding.add(node.param.name);
    }
  });

  const free = new Set();
  const moduleScopeFree = new Set();
  let fnDepth = 0;
  walk.recursive(ast, { depth: 0 }, {
    Function(node, st, c) {
      c(node.body, { depth: st.depth + 1 });
    },
    Identifier(node, st) {
      const n = node.name;
      if (anyBinding.has(n) || UNIVERSAL.has(n)) return;
      free.add(n);
      if (st.depth === 0) moduleScopeFree.add(n);
    },
    MemberExpression(node, st, c) {
      c(node.object, st);
      if (node.computed) c(node.property, st);
    },
    Property(node, st, c) {
      if (node.computed) c(node.key, st);
      c(node.value, st);
    },
  });

  const browser = [...free].filter(n => BROWSER_ONLY.has(n));
  const crossFile = [...free].filter(n => !BROWSER_ONLY.has(n));
  const moduleScopeBad = [...moduleScopeFree];

  return { file, exports: topLevel, browser, crossFile, moduleScopeBad };
}

const files = readdirSync(COMMON_DIR).filter(f => f.endsWith('.js')).sort();
const results = files.map(analyze);

const SHAREABLE = [];
for (const r of results) {
  const verdict = r.moduleScopeBad.length ? 'UNSAFE (module-scope free vars)'
    : r.crossFile.length ? 'needs injection'
    : r.browser.length ? 'shareable (browser refs in fn bodies only)'
    : 'SHAREABLE (fully self-contained)';
  if (!r.moduleScopeBad.length && !r.crossFile.length) SHAREABLE.push(r.file);
  console.log(`\n${r.file}  — ${verdict}`);
  console.log(`  declares : ${r.exports.join(', ') || '(none)'}`);
  if (r.crossFile.length) console.log(`  needs    : ${r.crossFile.join(', ')}`);
  if (r.browser.length) console.log(`  browser  : ${r.browser.join(', ')}`);
}

console.log(`\n\n=== Verbatim-shareable: ${SHAREABLE.join(', ')} ===`);
