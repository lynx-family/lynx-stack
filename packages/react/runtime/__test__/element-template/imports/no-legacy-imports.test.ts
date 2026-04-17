import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runtimeRoot = fs.realpathSync(path.resolve(__dirname, '..', '..', '..'));
const runtimeSrc = fs.realpathSync(path.resolve(runtimeRoot, 'src'));

const entryFiles = [
  path.resolve(runtimeSrc, 'element-template/index.ts'),
  path.resolve(runtimeSrc, 'element-template/internal.ts'),
  path.resolve(runtimeSrc, 'element-template/native/index.ts'),
];

const forbiddenExact = new Set([
  path.resolve(runtimeSrc, 'snapshot.ts'),
  path.resolve(runtimeSrc, 'backgroundSnapshot.ts'),
  path.resolve(runtimeSrc, 'listUpdateInfo.ts'),
  path.resolve(runtimeSrc, 'pendingListUpdates.ts'),
]);

const forbiddenDirs = [
  path.resolve(runtimeSrc, 'lynx') + path.sep,
  path.resolve(runtimeSrc, 'snapshot') + path.sep,
  path.resolve(runtimeSrc, 'lifecycle', 'patch') + path.sep,
];

function isForbidden(filePath: string): boolean {
  if (forbiddenExact.has(filePath)) return true;
  return forbiddenDirs.some(prefix => filePath.startsWith(prefix));
}

function isInsideRuntimeSrc(filePath: string): boolean {
  const normalized = filePath + (filePath.endsWith(path.sep) ? '' : '');
  return normalized.startsWith(runtimeSrc + path.sep) || normalized === runtimeSrc;
}

function resolveRelativeImport(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  const ext = path.extname(base);
  const baseNoExt = ext ? base.slice(0, -ext.length) : base;

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,

    baseNoExt,
    `${baseNoExt}.ts`,
    `${baseNoExt}.tsx`,
    `${baseNoExt}.js`,
    `${baseNoExt}.jsx`,

    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
    path.join(base, 'index.jsx'),

    path.join(baseNoExt, 'index.ts'),
    path.join(baseNoExt, 'index.tsx'),
    path.join(baseNoExt, 'index.js'),
    path.join(baseNoExt, 'index.jsx'),
  ];
  const found = candidates.find(p => fs.existsSync(p) && fs.statSync(p).isFile());
  return found ? fs.realpathSync(found) : null;
}

function isIdentChar(ch: string): boolean {
  return /[\w$]/.test(ch);
}

function isWordAt(s: string, i: number, word: string): boolean {
  if (s.slice(i, i + word.length) !== word) return false;
  const before = i - 1 >= 0 ? s[i - 1]! : '';
  const after = i + word.length < s.length ? s[i + word.length]! : '';
  if (before && isIdentChar(before)) return false;
  if (after && isIdentChar(after)) return false;
  return true;
}

function skipSpaces(s: string, i: number): number {
  while (i < s.length) {
    const c = s[i]!;
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') i++;
    else break;
  }
  return i;
}

function readStringLiteral(s: string, i: number): { value: string; next: number } | null {
  const quote = s[i];
  if (quote !== '\'' && quote !== '"') return null;
  let j = i + 1;
  let out = '';
  while (j < s.length) {
    const c = s[j]!;
    if (c === '\\') {
      const next = s[j + 1];
      if (next) {
        out += next;
        j += 2;
        continue;
      }
      j++;
      continue;
    }
    if (c === quote) {
      return { value: out, next: j + 1 };
    }
    out += c;
    j++;
  }
  return null;
}

function collectImportSpecifiers(code: string): string[] {
  const specs: string[] = [];

  let i = 0;
  while (i < code.length) {
    const c = code[i]!;
    const next = i + 1 < code.length ? code[i + 1]! : '';

    if (c === '/' && next === '/') {
      i += 2;
      while (i < code.length && code[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i + 1 < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '\'' || c === '"') {
      const res = readStringLiteral(code, i);
      i = res ? res.next : i + 1;
      continue;
    }
    if (c === '`') {
      i++;
      while (i < code.length) {
        const cc = code[i]!;
        if (cc === '\\') {
          i += 2;
          continue;
        }
        if (cc === '`') {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    const keyword = isWordAt(code, i, 'import')
      ? 'import'
      : (isWordAt(code, i, 'export')
        ? 'export'
        : null);

    if (!keyword) {
      i++;
      continue;
    }

    let j = i + keyword.length;
    j = skipSpaces(code, j);

    if (keyword === 'import' && isWordAt(code, j, 'type')) {
      j = skipSpaces(code, j + 4);

      const direct = readStringLiteral(code, j);
      if (direct) {
        i = direct.next;
        continue;
      }

      while (j < code.length) {
        const cc = code[j]!;
        const nn = j + 1 < code.length ? code[j + 1]! : '';
        if (cc === '/' && nn === '/') {
          j += 2;
          while (j < code.length && code[j] !== '\n') j++;
          continue;
        }
        if (cc === '/' && nn === '*') {
          j += 2;
          while (j + 1 < code.length && !(code[j] === '*' && code[j + 1] === '/')) j++;
          j += 2;
          continue;
        }
        if (cc === '\'' || cc === '"') {
          const res = readStringLiteral(code, j);
          j = res ? res.next : j + 1;
          continue;
        }
        if (cc === '`') {
          j++;
          while (j < code.length) {
            const tc = code[j]!;
            if (tc === '\\') {
              j += 2;
              continue;
            }
            if (tc === '`') {
              j++;
              break;
            }
            j++;
          }
          continue;
        }

        if (isWordAt(code, j, 'from')) {
          const k = skipSpaces(code, j + 4);
          const lit = readStringLiteral(code, k);
          i = lit ? lit.next : k + 1;
          break;
        }

        if (cc === ';') {
          i = j + 1;
          break;
        }
        j++;
      }

      continue;
    }

    if (keyword === 'export' && isWordAt(code, j, 'type')) {
      j = skipSpaces(code, j + 4);
      while (j < code.length) {
        const cc = code[j]!;
        const nn = j + 1 < code.length ? code[j + 1]! : '';
        if (cc === '/' && nn === '/') {
          j += 2;
          while (j < code.length && code[j] !== '\n') j++;
          continue;
        }
        if (cc === '/' && nn === '*') {
          j += 2;
          while (j + 1 < code.length && !(code[j] === '*' && code[j + 1] === '/')) j++;
          j += 2;
          continue;
        }
        if (cc === '\'' || cc === '"') {
          const res = readStringLiteral(code, j);
          j = res ? res.next : j + 1;
          continue;
        }
        if (cc === '`') {
          j++;
          while (j < code.length) {
            const tc = code[j]!;
            if (tc === '\\') {
              j += 2;
              continue;
            }
            if (tc === '`') {
              j++;
              break;
            }
            j++;
          }
          continue;
        }

        if (isWordAt(code, j, 'from')) {
          const k = skipSpaces(code, j + 4);
          const lit = readStringLiteral(code, k);
          i = lit ? lit.next : k + 1;
          break;
        }

        if (cc === ';') {
          i = j + 1;
          break;
        }
        j++;
      }

      continue;
    }

    if (keyword === 'import' && code[j] === '(') {
      j++;
      j = skipSpaces(code, j);
      const lit = readStringLiteral(code, j);
      if (lit) specs.push(lit.value);
      i = j + 1;
      continue;
    }

    if (keyword === 'import') {
      const lit = readStringLiteral(code, j);
      if (lit) {
        specs.push(lit.value);
        i = lit.next;
        continue;
      }
    }

    while (j < code.length) {
      const cc = code[j]!;
      const nn = j + 1 < code.length ? code[j + 1]! : '';
      if (cc === '/' && nn === '/') {
        j += 2;
        while (j < code.length && code[j] !== '\n') j++;
        continue;
      }
      if (cc === '/' && nn === '*') {
        j += 2;
        while (j + 1 < code.length && !(code[j] === '*' && code[j + 1] === '/')) j++;
        j += 2;
        continue;
      }
      if (cc === '\'' || cc === '"') {
        const res = readStringLiteral(code, j);
        j = res ? res.next : j + 1;
        continue;
      }
      if (cc === '`') {
        j++;
        while (j < code.length) {
          const tc = code[j]!;
          if (tc === '\\') {
            j += 2;
            continue;
          }
          if (tc === '`') {
            j++;
            break;
          }
          j++;
        }
        continue;
      }

      if (isWordAt(code, j, 'from')) {
        const k = skipSpaces(code, j + 4);
        const lit = readStringLiteral(code, k);
        if (lit) specs.push(lit.value);
        break;
      }

      if (cc === ';' || cc === '\n') break;
      j++;
    }

    i = j + 1;
  }

  return specs;
}

describe('element-template import boundaries', () => {
  it('does not reference forbidden legacy runtime files transitively', () => {
    for (const entry of entryFiles) {
      expect(fs.existsSync(entry)).toBe(true);
    }

    const visited = new Set<string>();
    const parent = new Map<string, string>();
    const queue = [...entryFiles.map(p => fs.realpathSync(p))];

    for (const p of queue) {
      visited.add(p);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      const code = fs.readFileSync(current, 'utf8');
      const specs = collectImportSpecifiers(code);

      for (const spec of specs) {
        const resolved = resolveRelativeImport(current, spec);
        if (!resolved) continue;
        if (!isInsideRuntimeSrc(resolved)) continue;
        if (visited.has(resolved)) continue;
        visited.add(resolved);
        parent.set(resolved, current);
        queue.push(resolved);
      }
    }

    const forbidden = [...visited].filter(p => isForbidden(p));
    if (forbidden.length === 0) return;

    const lines = forbidden.map(f => {
      const chain: string[] = [f];
      let cur = f;
      for (let i = 0; i < 50; i++) {
        const p = parent.get(cur);
        if (!p) break;
        chain.push(p);
        cur = p;
      }
      return chain.map(p => path.relative(runtimeRoot, p)).join(' <- ');
    });

    throw new Error(`forbidden imports reached:\n${lines.join('\n')}`);
  });
});
