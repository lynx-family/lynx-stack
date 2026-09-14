// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  ApiData,
  ApiExport,
  ApiMember,
  ApiParam,
} from './generate-api-data.ts';
import type { RsbuildOption } from './rsbuild-config.ts';

const cache = new Map<string, ApiData>();

export function loadApi(dataDir: string, id: string): ApiData {
  let d = cache.get(id);
  if (!d) {
    d = JSON.parse(
      readFileSync(join(dataDir, `${id}.json`), 'utf8'),
    ) as ApiData;
    cache.set(id, d);
  }
  return d;
}

export interface Locale {
  type: string;
  default: string;
  deprecated: string;
  beta: string;
  alpha: string;
  experimental: string;
  example: string;
  parameters: string;
  returns: string;
  name: string;
  description: string;
  otherOptions: string;
  members: string;
  functions: string;
  classes: string;
  constants: string;
  types: string;
  from: string;
  noDescription: string;
  generated: string;
  untranslated: string;
  source: string;
  changelog: string;
  lynxOptions: string;
  rsbuildOptions: string;
  rsbuildOptionsIntro: string;
  lynxDefault: string;
  rsbuildDocs: string;
  rsbuildDocsBase: string;
  withPluginLynx: string;
  rspeedyOnly: string;
  lynxBadge: string;
}

export const EN: Locale = {
  type: 'Type',
  default: 'Default',
  deprecated: 'Deprecated',
  beta: 'Beta',
  alpha: 'Alpha',
  experimental: 'Experimental',
  example: 'Example',
  parameters: 'Parameters',
  returns: 'Returns',
  name: 'Name',
  description: 'Description',
  otherOptions: 'Other options',
  members: 'Members',
  functions: 'Functions',
  classes: 'Classes',
  constants: 'Constants',
  types: 'Types',
  from: 'from',
  noDescription: 'No description yet.',
  generated: 'Generated from',
  untranslated: 'EN',
  source: 'Source',
  changelog: 'Changelog',
  lynxOptions: 'Lynx-specific options',
  rsbuildOptions: 'Rsbuild options',
  rsbuildOptionsIntro:
    'Standard Rsbuild options. The Lynx default is listed where it differs from Rsbuild; see the Rsbuild documentation for the details.',
  lynxDefault: 'Lynx default',
  rsbuildDocs: 'Rsbuild docs',
  rsbuildDocsBase: 'https://rsbuild.rs/config/',
  withPluginLynx: 'With Rsbuild, pass this option to {link}.',
  rspeedyOnly: 'Available only in `lynx.config.ts` (Rspeedy).',
  lynxBadge: 'Lynx',
};

export const ZH: Locale = {
  type: '类型',
  default: '默认值',
  deprecated: '已废弃',
  beta: 'Beta',
  alpha: 'Alpha',
  experimental: '实验性',
  example: '示例',
  parameters: '参数',
  returns: '返回值',
  name: '名称',
  description: '说明',
  otherOptions: '其他选项',
  members: '成员',
  functions: '函数',
  classes: '类',
  constants: '常量',
  types: '类型',
  from: '来自',
  noDescription: '暂无说明。',
  generated: '生成自',
  untranslated: '待翻译',
  source: '源码',
  changelog: '更新日志',
  lynxOptions: 'Lynx 特有配置',
  rsbuildOptions: 'Rsbuild 配置',
  rsbuildOptionsIntro:
    '以下是标准的 Rsbuild 配置。与 Rsbuild 默认值不同时会列出 Lynx 的默认值，详细说明请查看 Rsbuild 文档。',
  lynxDefault: 'Lynx 默认值',
  rsbuildDocs: 'Rsbuild 文档',
  rsbuildDocsBase: 'https://rsbuild.rs/zh/config/',
  withPluginLynx: '使用 Rsbuild 构建时，将此选项传给 {link}。',
  rspeedyOnly: '仅在 `lynx.config.ts`（Rspeedy）中可用。',
  lynxBadge: 'Lynx',
};

export const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const EXTERNAL_DOCS: Record<string, string> = {
  '@rsbuild/core': 'https://rsbuild.rs/config/',
  '@rspack/core': 'https://rspack.rs/config/',
  '@rslib/core': 'https://rslib.rs/config/',
};

function escapeMdx(md: string): string {
  const out: string[] = [];
  const lines = md.split('\n');
  let fence: string | null = null;
  for (const line of lines) {
    const f = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence) {
      out.push(line);
      if (f && f[1]!.startsWith(fence[0]!) && f[1]!.length >= fence.length) {
        fence = null;
      }
      continue;
    }
    if (f) {
      fence = f[1]!;
      out.push(line);
      continue;
    }
    out.push(escapeInline(line));
  }
  return out.join('\n');
}

function escapeInline(line: string): string {
  let res = '';
  let i = 0;
  while (i < line.length) {
    const ch = line[i]!;
    if (ch === '`') {
      let n = 0;
      while (line[i + n] === '`') n++;
      const open = '`'.repeat(n);
      const close = line.indexOf(open, i + n);
      if (close === -1) {
        res += open;
        i += n;
        continue;
      }
      res += line.slice(i, close + n);
      i = close + n;
      continue;
    }
    if (ch === '<') res += '\\<';
    else if (ch === '{') res += '\\{';
    else if (ch === '}') res += '\\}';
    else res += ch;
    i++;
  }
  return res;
}

const pipe = (s: string) => s.replace(/\|/g, '\\|');
const flat = (s: string) => {
  const fence = /```[a-z]*\n([\s\S]*?)\n```/.exec(s);
  const t = fence
    ? s.replace(fence[0], code(fence[1]!.trim().replace(/\n\s*/g, ' ')))
    : s;
  return t.replace(/\n+/g, ' ').trim();
};
const code = (s: string) => {
  const ticks = s.includes('`') ? '``' : '`';
  return `${ticks}${s.includes('`') ? ` ${s} ` : s}${ticks}`;
};

export interface Translation {
  hash: string;
  text: string;
}
export type Translations = Record<string, Translation>;

export type SiteAnchors = Map<string, { url: string; priority: number }>;

interface Ctx {
  api: ApiData;
  l: Locale;
  anchors: Map<string, string>;
  tr?: Translations | undefined;
  stale: Set<string>;
  site?: SiteAnchors | undefined;
  page?: string | undefined;
  prefix?: string | undefined;
  rsbuild?: RsbuildOptions | undefined;
}

type RsbuildOptions = Record<string, RsbuildOption>;

const rsbuildCache = new Map<string, RsbuildOptions>();

function loadRsbuild(path: string): RsbuildOptions {
  let d = rsbuildCache.get(path);
  if (!d) {
    d = JSON.parse(readFileSync(path, 'utf8')) as RsbuildOptions;
    rsbuildCache.set(path, d);
  }
  return d;
}

export function hashText(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function tr(ctx: Ctx, key: string, en: string | undefined): string | undefined {
  if (!en || !ctx.tr) return en;
  const t = ctx.tr[key];
  if (t?.text && t.hash === hashText(en)) return t.text;
  ctx.stale.add(key);
  return en;
}

function untranslated(ctx: Ctx, key: string): string {
  if (!ctx.tr) return '';
  return ctx.stale.has(key)
    ? ` <span className="api-badge api-badge-stale">${ctx.l.untranslated}</span>`
    : '';
}

function resolveLinks(md: string, ctx: Ctx): string {
  return md.replace(
    /\[([^\]]*)\]\(api:([^)]+)\)/g,
    (_, text: string, target: string) => {
      const [top, ...rest] = target.split('.');
      const t = linkTarget(ctx, target)
        ?? (rest.length > 0 ? linkTarget(ctx, rest.join('.')) : undefined)
        ?? linkTarget(ctx, top!);
      return t ? `[${text}](${t})` : text;
    },
  );
}

function md(text: string | undefined, ctx: Ctx): string {
  if (!text) return '';
  return escapeMdx(resolveLinks(text, ctx));
}

function linkTarget(ctx: Ctx, name: string): string | undefined {
  const local = ctx.anchors.get(name);
  if (local) return `#${local}`;
  const site = ctx.site?.get(`${ctx.api.id}|${name}`);
  if (!site) return undefined;
  const [page, anchor] = site.url.split('#');
  if (page === ctx.page) return anchor ? `#${anchor}` : undefined;
  return `${ctx.prefix ?? ''}${site.url}`;
}

const spaced = (s: string) =>
  code(s.replace(/^ +| +$/g, m => ' '.repeat(m.length)));

function linkedType(type: string, names: string[], ctx: Ctx): string {
  const targets = new Map<string, string>();
  for (const n of names) {
    const t = linkTarget(ctx, n);
    if (t) targets.set(n, t);
  }
  if (targets.size === 0) return code(type);
  const alternatives = [...targets.keys()].map(n =>
    n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const re = new RegExp(
    `(?<![\\w$.])(?:${alternatives.join('|')})(?![\\w$])`,
    'g',
  );
  let out = '';
  let last = 0;
  for (const m of type.matchAll(re)) {
    if (m.index > last) out += spaced(type.slice(last, m.index));
    out += `[${code(m[0])}](${targets.get(m[0])})`;
    last = m.index + m[0].length;
  }
  if (last < type.length) out += spaced(type.slice(last));
  return out;
}

function typeCell(
  m: Pick<ApiMember, 'type' | 'ref' | 'refs' | 'external'>,
  ctx: Ctx,
): string {
  const c = linkedType(m.type, m.refs ?? (m.ref ? [m.ref] : []), ctx);
  if (m.external) {
    const url = EXTERNAL_DOCS[m.external];
    return url
      ? `${c} (${ctx.l.from} [${m.external}](${url}))`
      : `${c} (${ctx.l.from} ${m.external})`;
  }
  return c;
}

function badges(m: ApiMember, ctx: Ctx): string {
  const b: string[] = [];
  if (m.deprecated !== undefined) {
    b.push(
      `<span className="api-badge api-badge-deprecated">${ctx.l.deprecated}</span>`,
    );
  }
  if (m.beta) {
    b.push(`<span className="api-badge api-badge-beta">${ctx.l.beta}</span>`);
  }
  if (m.alpha) {
    b.push(`<span className="api-badge api-badge-alpha">${ctx.l.alpha}</span>`);
  }
  if (m.experimental) {
    b.push(
      `<span className="api-badge api-badge-beta">${ctx.l.experimental}</span>`,
    );
  }
  return b.length > 0 ? ' ' + b.join(' ') : '';
}

function examples(list: string[] | undefined, ctx: Ctx, key: string): string {
  if (!list || list.length === 0) return '';
  return list.map((e, i) => md(tr(ctx, `${key}.example.${i}`, e), ctx)).join(
    '\n\n',
  ) + '\n\n';
}

function body(m: ApiMember, ctx: Ctx, key: string): string {
  let s = '';
  if (m.deprecated !== undefined) {
    s += `:::warning ${ctx.l.deprecated}\n${
      md(tr(ctx, `${key}.deprecated`, m.deprecated), ctx) || ''
    }\n:::\n\n`;
  }
  const summary = tr(ctx, `${key}.summary`, m.summary);
  s += summary ? md(summary, ctx) + '\n\n' : `*${ctx.l.noDescription}*\n\n`;
  if (m.remarks) s += md(tr(ctx, `${key}.remarks`, m.remarks), ctx) + '\n\n';
  s += examples(m.examples, ctx, key);
  return s;
}

function metaList(
  m: ApiMember,
  ctx: Ctx,
  key: string,
  includeType = true,
): string {
  const rows: string[] = [];
  if (includeType) rows.push(`- **${ctx.l.type}:** ${typeCell(m, ctx)}`);
  if (m.default !== undefined) {
    rows.push(
      `- **${ctx.l.default}:** ${
        md(tr(ctx, `${key}.default`, m.default), ctx)
      }`,
    );
  }
  return rows.length > 0 ? rows.join('\n') + '\n\n' : '';
}

function findExport(ctx: Ctx, name: string): ApiExport | undefined {
  return ctx.api.exports.find(e => e.name === name);
}

function expandable(m: ApiMember, ctx: Ctx): ApiExport | undefined {
  if (!m.ref) return undefined;
  const e = findExport(ctx, m.ref);
  return (e?.members?.length ?? 0) > 0 ? e : undefined;
}

function isCompact(m: ApiMember, ctx: Ctx): boolean {
  return !m.remarks && (m.examples?.length ?? 0) === 0 && !expandable(m, ctx)
    && m.deprecated === undefined && !m.params
    && !(m.default ?? '').includes('\n') && !(m.summary ?? '').includes('```');
}

function registerAnchors(
  members: ApiMember[],
  prefix: string,
  ctx: Ctx,
  seen = new Set<string>(),
): void {
  for (const m of members) {
    const path = prefix ? `${prefix}.${m.name}` : m.name;
    const a = slug(path);
    ctx.anchors.set(path, a);
    const e = expandable(m, ctx);
    if (e && !seen.has(e.name)) {
      seen.add(e.name);
      ctx.anchors.set(e.name, a);
      for (const c of e.members ?? []) {
        ctx.anchors.set(`${e.name}.${c.name}`, slug(`${path}.${c.name}`));
      }
      registerAnchors(e.members ?? [], path, ctx, seen);
    }
  }
}

function heading(
  depth: number,
  path: string,
  m: ApiMember,
  ctx: Ctx,
  key: string,
): string {
  const d = Math.min(depth, 6);
  return `${'#'.repeat(d)} ${code(path)}${badges(m, ctx)}${
    untranslated(ctx, `${key}.summary`)
  } \\{#${slug(path)}\\}\n\n`;
}

const RSBUILD_PAGE_OVERRIDES: Record<string, string> = {
  'performance.chunkSplit': 'split-chunks',
};

const kebab = (s: string) => s.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);

function rsbuildUrl(path: string, ctx: Ctx): string {
  const [ns, option] = path.split('.');
  const key = option ? `${ns}.${option}` : ns!;
  const page = RSBUILD_PAGE_OVERRIDES[key]
    ?? (option ? `${ns}/${kebab(option)}` : kebab(ns!));
  return `${ctx.l.rsbuildDocsBase}${page}`;
}

function isRsbuild(path: string, rsbuild: RsbuildOptions): boolean {
  if (path in rsbuild) return true;
  const dot = path.lastIndexOf('.');
  if (dot === -1) return false;
  const parent = path.slice(0, dot);
  return isRsbuild(parent, rsbuild)
    && !Object.keys(rsbuild).some(k => k.startsWith(`${parent}.`));
}

const plainDefault = (s: string) =>
  s.replace(/[`'"\s]/g, '').replace(/^\.\//, '');

function showLynxDefault(
  lynx: string | undefined,
  rsbuild: string | undefined,
): boolean {
  const text = lynx?.trim().replace(/^```[a-z]*\s*/, '');
  if (!text || /^`?undefined`?$/.test(text)) return false;
  if (/\b(?:Rspeedy|Lynx)\b/.test(text)) return true;
  const literal = /^`([^`]+)`/.exec(text)?.[1] ?? text.split(/\s+/)[0]!;
  return plainDefault(literal) !== plainDefault(rsbuild ?? '');
}

function firstSentence(text: string): string {
  let inCode = false;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '`') inCode = !inCode;
    if (inCode) continue;
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    else if (depth === 0) {
      if (ch === '。') return text.slice(0, i + 1);
      if (ch === '\n' && text[i + 1] === '\n') return text.slice(0, i);
      if (
        ch === '.' && (i + 1 === text.length || /\s/.test(text[i + 1]!))
        && !/(?:e\.g|i\.e|etc)$/.test(text.slice(0, i))
      ) return text.slice(0, i + 1);
    }
  }
  return text;
}

function pluginLynxNote(path: string, m: ApiMember, ctx: Ctx): string {
  const site = ctx.site?.get(`rsbuild-plugin|${path}`);
  if (site) {
    const [page = ''] = site.url.split('#');
    const url = page === ctx.page
      ? site.url.slice(page.length)
      : `${ctx.prefix ?? ''}${site.url}`;
    return `${
      ctx.l.withPluginLynx.replace('{link}', `[\`pluginLynx\`](${url})`)
    }\n\n`;
  }
  return m.deprecated === undefined ? `${ctx.l.rspeedyOnly}\n\n` : '';
}

interface ConfigItem {
  m: ApiMember;
  path: string;
  owner: string;
}

function collectLynx(
  members: ApiMember[],
  prefix: string,
  owner: string,
  ctx: Ctx,
  rsbuild: RsbuildOptions,
  ancestors: ReadonlySet<string>,
  out: ConfigItem[],
): void {
  for (const m of members) {
    const path = prefix ? `${prefix}.${m.name}` : m.name;
    if (!isRsbuild(path, rsbuild)) {
      out.push({ m, path, owner });
      continue;
    }
    const e = expandable(m, ctx);
    if (e && !ancestors.has(e.name)) {
      collectLynx(
        e.members ?? [],
        path,
        e.name,
        ctx,
        rsbuild,
        new Set([...ancestors, e.name]),
        out,
      );
    }
  }
}

function renderConfig(
  members: ApiMember[],
  prefix: string,
  depth: number,
  ctx: Ctx,
  owner: string,
  rsbuild: RsbuildOptions,
): string {
  const pathOf = (m: ApiMember) => prefix ? `${prefix}.${m.name}` : m.name;
  const rows = members.filter(m => isRsbuild(pathOf(m), rsbuild));
  const lynx: ConfigItem[] = [];
  collectLynx(members, prefix, owner, ctx, rsbuild, new Set([owner]), lynx);
  for (const m of rows) {
    ctx.anchors.set(pathOf(m), slug(pathOf(m)));
    const e = expandable(m, ctx);
    if (e && !ctx.anchors.has(e.name)) ctx.anchors.set(e.name, slug(pathOf(m)));
  }
  for (const { m, path } of lynx) {
    ctx.anchors.set(path, slug(path));
    const e = expandable(m, ctx);
    if (e) {
      if (!ctx.anchors.has(e.name)) ctx.anchors.set(e.name, slug(path));
      registerAnchors(e.members ?? [], path, ctx);
    }
  }
  const h = '#'.repeat(Math.max(depth - 1, 2));
  let s = '';
  if (lynx.length > 0) {
    s += `${h} ${ctx.l.lynxOptions} \\{#lynx-options\\}\n\n`;
    for (const { m, path, owner: o } of lynx) {
      const key = `${o}.${m.name}`;
      s += heading(depth, path, m, ctx, key);
      s += metaList(m, ctx, key);
      s += body(m, ctx, key);
      s += pluginLynxNote(path, m, ctx);
      if (m.params) s += paramsTable(m.params, ctx, key);
      const e = expandable(m, ctx);
      if (e) {
        s += renderOptions(
          e.members ?? [],
          path,
          depth + 1,
          ctx,
          e.name,
          new Set([o, e.name]),
        );
      }
    }
  }
  if (rows.length > 0) {
    s +=
      `${h} ${ctx.l.rsbuildOptions} \\{#rsbuild-options\\}\n\n${ctx.l.rsbuildOptionsIntro}\n\n`;
    s +=
      `| ${ctx.l.name} | ${ctx.l.type} | ${ctx.l.lynxDefault} | ${ctx.l.description} |\n| --- | --- | --- | --- |\n`;
    for (const m of rows) {
      const path = pathOf(m);
      const key = `${owner}.${m.name}`;
      const summary = tr(ctx, `${key}.summary`, m.summary);
      const def = showLynxDefault(m.default, rsbuild[path]?.default)
        ? pipe(flat(md(tr(ctx, `${key}.default`, m.default), ctx)))
        : '';
      const desc = [
        summary ? flat(md(firstSentence(summary), ctx)) : '',
        `[${ctx.l.rsbuildDocs}](${rsbuildUrl(path, ctx)})`,
      ].filter(Boolean).join(' ');
      s += `| <a id="${slug(path)}"></a>${code(m.name)}${badges(m, ctx)}${
        untranslated(ctx, `${key}.summary`)
      } | ${pipe(typeCell(m, ctx))} | ${def} | ${pipe(desc)} |\n`;
    }
    s += '\n';
  }
  return s;
}

export function renderOptions(
  members: ApiMember[],
  prefix: string,
  depth: number,
  ctx: Ctx,
  owner: string,
  ancestors: ReadonlySet<string> = new Set([owner]),
): string {
  let s = '';
  const full = members.filter(m => !isCompact(m, ctx));
  const compact = members.filter(m => isCompact(m, ctx));
  for (const m of full) {
    const path = prefix ? `${prefix}.${m.name}` : m.name;
    const key = `${owner}.${m.name}`;
    const e = expandable(m, ctx);
    const bodyText = body(m, ctx, key);
    s += heading(depth, path, m, ctx, key);
    s += metaList(m, ctx, key);
    s += bodyText;
    if (m.params) s += paramsTable(m.params, ctx, key);
    if (e && !ancestors.has(e.name)) {
      s += renderOptions(
        e.members ?? [],
        path,
        depth + 1,
        ctx,
        e.name,
        new Set([...ancestors, e.name]),
      );
    }
  }
  if (compact.length > 0) {
    if (full.length > 0) {
      s += `${'#'.repeat(Math.min(depth, 6))} ${ctx.l.otherOptions} \\{#${
        slug((prefix ? prefix + '-' : '') + 'other-options')
      }\\}\n\n`;
    }
    s +=
      `| ${ctx.l.name} | ${ctx.l.type} | ${ctx.l.default} | ${ctx.l.description} |\n| --- | --- | --- | --- |\n`;
    for (const m of compact) {
      const path = prefix ? `${prefix}.${m.name}` : m.name;
      const key = `${owner}.${m.name}`;
      const summary = tr(ctx, `${key}.summary`, m.summary);
      s += `| <a id="${slug(path)}"></a>${code(m.name)}${badges(m, ctx)}${
        untranslated(ctx, `${key}.summary`)
      } | ${pipe(typeCell(m, ctx))} | ${
        m.default === undefined
          ? ''
          : pipe(flat(md(tr(ctx, `${key}.default`, m.default), ctx)))
      } | ${pipe(flat(md(summary, ctx)))} |\n`;
    }
    s += '\n';
  }
  return s;
}

function paramsTable(params: ApiParam[], ctx: Ctx, key: string): string {
  if (params.length === 0) return '';
  let s =
    `| ${ctx.l.parameters} | ${ctx.l.type} | ${ctx.l.description} |\n| --- | --- | --- |\n`;
  for (const p of params) {
    s += `| ${code(p.name + (p.optional ? '?' : ''))} | ${
      pipe(typeCell(p, ctx))
    } | ${
      pipe(flat(md(tr(ctx, `${key}.params.${p.name}`, p.description), ctx)))
    } |\n`;
  }
  return s + '\n';
}

function membersTable(members: ApiMember[], ctx: Ctx, parent: string): string {
  if (members.length === 0) return '';
  let s =
    `| ${ctx.l.members} | ${ctx.l.type} | ${ctx.l.description} |\n| --- | --- | --- |\n`;
  for (const m of members) {
    const key = `${parent}.${m.name}`;
    const desc = [
      tr(ctx, `${key}.summary`, m.summary),
      m.deprecated === undefined
        ? ''
        : `**${ctx.l.deprecated}.** ${
          tr(ctx, `${key}.deprecated`, m.deprecated)
        }`,
    ].filter(Boolean).join(' ');
    s += `| <a id="${slug(parent + '.' + m.name)}"></a>${
      code(m.name + (m.optional ? '?' : ''))
    }${badges(m, ctx)} | ${pipe(typeCell(m, ctx))} | ${
      pipe(flat(md(desc, ctx)))
    } |\n`;
  }
  return s + '\n';
}

function renderExport(e: ApiExport, depth: number, ctx: Ctx): string {
  const h = '#'.repeat(Math.min(depth, 6));
  const title = e.kind === 'function' ? `${e.name}()` : e.name;
  const key = e.name;
  const bodyText = body(e, ctx, key);
  let s = `${h} ${code(title)}${badges(e, ctx)}${
    untranslated(ctx, `${key}.summary`)
  } \\{#${slug(e.name)}\\}\n\n`;
  if (e.signatures && e.signatures.length > 0) {
    s += '```ts\n' + e.signatures.map(sig => sig.text).join('\n') + '\n```\n\n';
  } else if (e.kind === 'variable' || e.kind === 'typealias') {
    const t = e.literalUnion ? e.literalUnion.join(' | ') : e.type;
    if (t && t !== 'unknown') {
      s += '```ts\n'
        + `${e.kind === 'variable' ? 'const' : 'type'} ${e.name}${
          e.kind === 'variable' ? ':' : ' ='
        } ${t}` + '\n```\n\n';
    }
  }
  s += bodyText;
  if (e.default !== undefined && e.kind !== 'variable') {
    s += `- **${ctx.l.default}:** ${
      md(tr(ctx, `${key}.default`, e.default), ctx)
    }\n\n`;
  }
  const sig = e.signatures?.[0];
  if (sig) {
    s += paramsTable(sig.params, ctx, key);
    if (sig.returns.type && sig.returns.type !== 'void') {
      s += `**${ctx.l.returns}:** ${typeCell(sig.returns, ctx)}${
        sig.returns.description
          ? ' — '
            + md(tr(ctx, `${key}.returns`, sig.returns.description), ctx)
              .replace(/\n+/g, ' ')
          : ''
      }\n\n`;
    }
  }
  if (e.members && e.members.length > 0) {
    s += membersTable(e.members, ctx, e.name);
  }
  return s;
}

export function renderExports(
  ctx: Ctx,
  opts: {
    exclude?: string[] | undefined;
    include?: string[] | undefined;
    depth?: number;
  },
): string {
  const depth = opts.depth ?? 3;
  const excl = new Set(opts.exclude ?? []);
  const incl = opts.include ? new Set(opts.include) : undefined;
  let list = ctx.api.exports.filter(e =>
    !excl.has(e.name) && (!incl || incl.has(e.name))
  );
  if (opts.include) {
    list = [...list].sort((a, b) =>
      opts.include!.indexOf(a.name) - opts.include!.indexOf(b.name)
    );
  }
  for (const e of list) ctx.anchors.set(e.name, slug(e.name));
  const groups: [string, (e: ApiExport) => boolean][] = [
    [ctx.l.functions, e => e.kind === 'function'],
    [ctx.l.classes, e => e.kind === 'class'],
    [ctx.l.constants, e => e.kind === 'variable'],
    [
      ctx.l.types,
      e => ['interface', 'typealias', 'enum', 'namespace'].includes(e.kind),
    ],
  ];
  let s = '';
  for (const [title, pred] of groups) {
    const items = list.filter(e => pred(e));
    if (items.length === 0) continue;
    s += `${'#'.repeat(Math.max(depth - 1, 2))} ${title} \\{#${
      slug(title)
    }\\}\n\n`;
    for (const e of items) s += renderExport(e, depth, ctx);
  }
  return s;
}

export function renderOverview(
  members: ApiMember[],
  prefix: string,
  ctx: Ctx,
  owner: string,
): string {
  let s =
    `| ${ctx.l.name} | ${ctx.l.type} | ${ctx.l.description} |\n| --- | --- | --- |\n`;
  for (const m of members) {
    const path = prefix ? `${prefix}.${m.name}` : m.name;
    const target = linkTarget(ctx, path)
      ?? (ctx.site ? undefined : `#${slug(path)}`);
    const lynxOnly = ctx.rsbuild && !isRsbuild(path, ctx.rsbuild)
      ? ` <span className="api-badge api-badge-lynx">${ctx.l.lynxBadge}</span>`
      : '';
    s += `| ${target ? `[${code(m.name)}](${target})` : code(m.name)}${
      badges(m, ctx)
    }${lynxOnly} | ${pipe(typeCell(m, ctx))} | ${
      pipe(flat(md(tr(ctx, `${owner}.${m.name}.summary`, m.summary), ctx)))
    } |\n`;
  }
  return s + '\n';
}

export function renderHeader(ctx: Ctx): string {
  const a = ctx.api;
  const npm = `https://www.npmjs.com/package/${a.package}`;
  return `<div className="api-pkg-header"><code>${a.package}</code> <span className="api-pkg-version">v${a.version}</span> · <a href="${npm}" target="_blank" rel="noopener">npm</a> · <a href="${a.srcUrl}" target="_blank" rel="noopener">${ctx.l.source}</a> · <a href="${a.srcUrl}/CHANGELOG.md" target="_blank" rel="noopener">${ctx.l.changelog}</a></div>\n\n`;
}

export interface Directive {
  name: string;
  attrs: Record<string, string>;
}

export interface RenderOptions {
  site?: SiteAnchors;
  page?: string;
  prefix?: string;
  onAnchors?: (id: string, anchors: ReadonlyMap<string, string>) => void;
}

export function renderDirective(
  d: Directive,
  dataDir: string,
  locale: Locale,
  translations?: Translations,
  options: RenderOptions = {},
): string {
  const api = loadApi(dataDir, d.attrs['package']!);
  const ctx: Ctx = {
    api,
    l: locale,
    anchors: new Map(),
    tr: translations,
    stale: new Set(),
    site: options.site,
    page: options.page,
    prefix: options.prefix,
    rsbuild: api.id === 'rspeedy'
        && existsSync(join(dataDir, 'rsbuild-config.json'))
      ? loadRsbuild(join(dataDir, 'rsbuild-config.json'))
      : undefined,
  };
  const out = renderBody(d, ctx);
  options.onAnchors?.(api.id, ctx.anchors);
  return out;
}

function renderBody(d: Directive, ctx: Ctx): string {
  const depth = d.attrs['depth'] ? Number(d.attrs['depth']) : 3;
  switch (d.name) {
    case 'PackageHeader':
      return renderHeader(ctx);
    case 'ApiOptions': {
      const e = findExport(ctx, d.attrs['type']!);
      if (!e?.members) {
        throw new Error(
          `ApiOptions: ${d.attrs['package']} has no interface ${
            d.attrs['type']
          }`,
        );
      }
      ctx.anchors.set(e.name, slug(e.name));
      registerAnchors(e.members, '', ctx);
      return `<a id="${slug(e.name)}"></a>\n\n${
        renderOptions(e.members, '', depth, ctx, e.name)
      }`;
    }
    case 'ConfigOptions':
    case 'ConfigOverview': {
      const root = findExport(ctx, d.attrs['type'] ?? 'Config');
      if (!root?.members) {
        throw new Error(`${d.name}: no interface ${d.attrs['type']}`);
      }
      const path = d.attrs['path'];
      let members = root.members;
      let prefix = '';
      let owner = root.name;
      let namespace: string | undefined;
      if (path) {
        let cur: ApiMember | undefined;
        let list = root.members;
        let leaf = false;
        let listOwner = root.name;
        let parentOwner = root.name;
        for (const seg of path.split('.')) {
          cur = list.find(m => m.name === seg);
          if (!cur) throw new Error(`${d.name}: path ${path} not found`);
          const e = expandable(cur, ctx);
          leaf = !e;
          parentOwner = listOwner;
          list = e?.members ?? [];
          listOwner = e?.name ?? listOwner;
        }
        if (leaf && cur) {
          members = [cur];
          prefix = path.split('.').slice(0, -1).join('.');
          owner = parentOwner;
        } else {
          members = list;
          prefix = path;
          owner = listOwner;
          namespace = path;
        }
      }
      if (d.name === 'ConfigOverview') {
        if (!ctx.site) registerAnchors(members, prefix, ctx);
        return renderOverview(members, prefix, ctx, owner);
      }
      if (namespace) {
        ctx.anchors.set(namespace, '');
        if (!ctx.anchors.has(owner)) ctx.anchors.set(owner, '');
      }
      if (ctx.rsbuild) {
        return renderConfig(members, prefix, depth, ctx, owner, ctx.rsbuild);
      }
      registerAnchors(members, prefix, ctx);
      return renderOptions(members, prefix, depth, ctx, owner);
    }
    case 'ApiExports': {
      const exclude = d.attrs['exclude']?.split(',').map(s => s.trim()).filter(
        Boolean,
      );
      const include = d.attrs['include']?.split(',').map(s => s.trim()).filter(
        Boolean,
      );
      if (d.attrs['optionsType']) {
        const e = findExport(ctx, d.attrs['optionsType']);
        if (e?.members) {
          ctx.anchors.set(e.name, slug(e.name));
          registerAnchors(e.members, '', ctx);
        }
      }
      return renderExports(ctx, { exclude, include, depth });
    }
    default:
      throw new Error(`unknown directive ${d.name}`);
  }
}
