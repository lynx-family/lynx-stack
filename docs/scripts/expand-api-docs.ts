// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EN, ZH, renderDirective } from './render.ts';
import type { Directive, SiteAnchors, Translations } from './render.ts';

const DOCS = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(DOCS, 'api-data');

function resolve(...p: string[]) {
  return join(...p);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.mdx?$/.test(name)) out.push(p);
  }
  return out;
}

const BEGIN =
  /\{\/\*\s*@api\s+([A-Za-z]+)((?:\s+[a-zA-Z]+="[^"]*")*)\s*\*\/\}/g;
const END = '{/* @api-end */}';

function parseAttrs(s: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of s.matchAll(/([a-z]+)="([^"]*)"/gi)) attrs[m[1]!] = m[2]!;
  return attrs;
}

function pagePath(root: string, file: string): string {
  const rel = relative(root, file).split('\\').join('/').replace(
    /\.mdx?$/,
    '',
  );
  if (rel === 'index') return '/';
  return `/${rel.endsWith('/index') ? rel.slice(0, -'index'.length) : rel}`;
}

const PRIORITY: Record<string, number> = {
  ConfigOptions: 0,
  ApiOptions: 0,
  ApiExports: 1,
};

function collectSiteAnchors(): SiteAnchors {
  const site: SiteAnchors = new Map();
  const root = join(DOCS, 'content', 'en');
  if (!existsSync(root)) return site;
  for (const file of walk(root)) {
    const src = readFileSync(file, 'utf8');
    if (!src.includes('{/* @api ')) continue;
    const page = pagePath(root, file);
    for (const m of src.matchAll(BEGIN)) {
      const d: Directive = { name: m[1]!, attrs: parseAttrs(m[2] ?? '') };
      const priority = PRIORITY[d.name];
      if (priority === undefined) continue;
      try {
        renderDirective(d, DATA, EN, undefined, {
          onAnchors: (id, anchors) => {
            for (const [name, anchor] of anchors) {
              const key = `${id}|${name}`;
              const prev = site.get(key);
              if (!prev || priority < prev.priority) {
                site.set(key, {
                  url: anchor ? `${page}#${anchor}` : page,
                  priority,
                });
              }
            }
          },
        });
      } catch {
        continue;
      }
    }
  }
  return site;
}

const site = collectSiteAnchors();

let changed = 0;
let total = 0;
const errors: string[] = [];
for (const locale of ['en', 'zh'] as const) {
  const root = join(DOCS, 'content', locale);
  let files: string[] = [];
  try {
    files = walk(root);
  } catch {
    continue;
  }
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    if (!src.includes('{/* @api ')) continue;
    const page = pagePath(root, file);
    let out = '';
    let last = 0;
    for (const m of src.matchAll(BEGIN)) {
      const start = m.index;
      const afterBegin = start + m[0].length;
      const endIdx = src.indexOf(END, afterBegin);
      if (endIdx === -1) {
        errors.push(`${relative(DOCS, file)}: missing ${END} after ${m[0]}`);
        break;
      }
      const d: Directive = { name: m[1]!, attrs: parseAttrs(m[2] ?? '') };
      let rendered: string;
      try {
        const sidecar = join(DATA, locale, `${d.attrs['package']}.json`);
        const translations = locale !== 'en' && existsSync(sidecar)
          ? JSON.parse(readFileSync(sidecar, 'utf8')) as Translations
          : undefined;
        rendered = renderDirective(
          d,
          DATA,
          locale === 'zh' ? ZH : EN,
          locale === 'zh' ? translations ?? {} : undefined,
          { site, page, prefix: locale === 'zh' ? '/zh' : '' },
        );
      } catch (err) {
        errors.push(`${relative(DOCS, file)}: ${(err as Error).message}`);
        rendered = src.slice(afterBegin, endIdx);
        out += src.slice(last, start) + m[0] + rendered;
        last = endIdx;
        continue;
      }
      total++;
      out += src.slice(last, start) + m[0] + '\n\n' + rendered.trimEnd()
        + '\n\n';
      last = endIdx;
    }
    out += src.slice(last);
    if (out !== src) {
      writeFileSync(file, out);
      changed++;
      console.info(`updated ${relative(DOCS, file)}`);
    }
  }
}
console.info(`${total} directives expanded, ${changed} files changed`);
if (errors.length > 0) {
  console.error('\nerrors:\n  ' + errors.join('\n  '));
  process.exitCode = 1;
}
