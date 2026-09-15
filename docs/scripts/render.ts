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
import { needsTranslation } from './i18n-strings.ts';
import { PACKAGES, PACKAGE_GROUPS } from './packages.ts';
import type { PackageEntry, PackageGroup } from './packages.ts';
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
  noDescription: string;
  generated: string;
  untranslated: string;
  source: string;
  changelog: string;
  lynxDefault: string;
  rsbuildDocsBase: string;
  overviewLegend: string;
  usage: string;
  withPluginLynx: string;
  withRspeedy: string;
  rspeedyOnly: string;
  options: string;
  lynxBadge: string;
  colon: string;
  defaultBadge: string;
  rsbuildOption: string;
  rsbuildDocsLink: string;
  packageGroups: Record<PackageGroup, string>;
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
  noDescription: 'No description yet.',
  generated: 'Generated from',
  untranslated: 'EN',
  source: 'Source',
  changelog: 'Changelog',
  lynxDefault: 'Lynx default',
  rsbuildDocsBase: 'https://rsbuild.rs/config/',
  overviewLegend:
    'Options marked {lynx} are specific to Lynx, and options marked {default} are Rsbuild options with a different default. Both have their own page here; the others link to the Rsbuild documentation.',
  usage: 'Usage',
  withPluginLynx: 'With Rsbuild, pass it to {link}:',
  withRspeedy: 'With Rspeedy, set it in `lynx.config.ts`:',
  rspeedyOnly: 'Available only in `lynx.config.ts` (Rspeedy):',
  options: 'Options',
  lynxBadge: 'Lynx',
  colon: ':',
  defaultBadge: 'Default changed',
  rsbuildOption:
    'Lynx changes the default of this Rsbuild option; everything else works as in Rsbuild. See the {link}.',
  rsbuildDocsLink: 'Rsbuild documentation',
  packageGroups: {
    build: 'Build tools',
    react: 'ReactLynx',
    web: 'Web platform',
    libraries: 'Libraries and tools',
    internals: 'Build internals',
  },
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
  noDescription: '暂无说明。',
  generated: '生成自',
  untranslated: '待翻译',
  source: '源码',
  changelog: '更新日志',
  lynxDefault: 'Lynx 默认值',
  rsbuildDocsBase: 'https://rsbuild.rs/zh/config/',
  overviewLegend:
    '标有 {lynx} 的是 Lynx 特有配置，标有 {default} 的是默认值与 Rsbuild 不同的 Rsbuild 配置，二者在本站都有单独的页面；其余配置链接到 Rsbuild 文档。',
  usage: '使用方式',
  withPluginLynx: '使用 Rsbuild 构建时，将它传给 {link}：',
  withRspeedy: '使用 Rspeedy 时，在 `lynx.config.ts` 中设置：',
  rspeedyOnly: '仅在 `lynx.config.ts`（Rspeedy）中可用：',
  options: '选项',
  lynxBadge: 'Lynx',
  colon: '：',
  defaultBadge: '默认值不同',
  rsbuildOption:
    'Lynx 修改了这个 Rsbuild 配置的默认值，其他用法与 Rsbuild 相同，详见 {link}。',
  rsbuildDocsLink: 'Rsbuild 文档',
  packageGroups: {
    build: '构建工具',
    react: 'ReactLynx',
    web: 'Web 平台',
    libraries: '库与工具',
    internals: '构建内部包',
  },
};

export const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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
  en: string;
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

function tr(ctx: Ctx, key: string, en: string | undefined): string | undefined {
  if (!en || !ctx.tr || !needsTranslation(en)) return en;
  const t = ctx.tr[key];
  if (t?.text && t.en === en) return t.text;
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
  m: Pick<ApiMember, 'type' | 'ref' | 'refs'>,
  ctx: Ctx,
): string {
  return linkedType(m.type, m.refs ?? (m.ref ? [m.ref] : []), ctx);
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
  if (includeType) {
    rows.push(`- **${ctx.l.type}${ctx.l.colon}** ${typeCell(m, ctx)}`);
  }
  if (m.default !== undefined) {
    rows.push(
      `- **${ctx.l.default}${ctx.l.colon}** ${
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

function isCompact(
  m: ApiMember,
  ctx: Ctx,
  notExpanded: ReadonlySet<string> = new Set(),
): boolean {
  const e = expandable(m, ctx);
  return !m.remarks && (m.examples?.length ?? 0) === 0
    && !(e && !notExpanded.has(e.name)) && m.deprecated === undefined
    && !m.params?.some(p => p.description)
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
  showOptional = false,
): string {
  const d = Math.min(depth, 6);
  const name = path + (showOptional && m.optional ? '?' : '');
  return `${'#'.repeat(d)} ${code(name)}${badges(m, ctx)}${
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

const LITERAL = /^(?:true|false|null|-?\d+(?:\.\d+)?|'[^']*'|"[^"]*")(?=\s|$)/;

function showLynxDefault(
  lynx: string | undefined,
  rsbuild: string | undefined,
): boolean {
  const text = lynx?.trim().replace(/^```[a-z]*\s*/, '');
  if (!text || /^`?undefined`?$/.test(text)) return false;
  const literal = /^`([^`]+)`/.exec(text)?.[1] ?? LITERAL.exec(text)?.[0];
  if (literal !== undefined) {
    return plainDefault(literal) !== plainDefault(rsbuild ?? '');
  }
  return /\b(?:Rspeedy|Lynx)\b/.test(text);
}

export function configPageUrl(path: string): string {
  const [ns = '', ...rest] = path.split('.');
  return rest.length > 0
    ? `/api/config/${ns}/${rest.map(s => kebab(s)).join('-')}`
    : `/api/config/${kebab(ns)}`;
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

interface ConfigGroup {
  name: string;
  items: OverviewItem[];
}

type OverviewItem = ConfigItem & { lynx: boolean; changed: boolean };

function configItem(
  m: ApiMember,
  path: string,
  owner: string,
  rsbuild: RsbuildOptions,
): OverviewItem {
  const lynx = !isRsbuild(path, rsbuild);
  return {
    m,
    path,
    owner,
    lynx,
    changed: !lynx && showLynxDefault(m.default, rsbuild[path]?.default),
  };
}

const CONFIG_GROUP_ORDER = [
  'base',
  'source',
  'output',
  'dev',
  'server',
  'resolve',
  'performance',
  'tools',
];

function groupRank(name: string): number {
  const i = CONFIG_GROUP_ORDER.indexOf(name);
  return i === -1 ? CONFIG_GROUP_ORDER.length : i;
}

function configGroups(ctx: Ctx, rsbuild: RsbuildOptions): ConfigGroup[] {
  const root = findExport(ctx, 'Config');
  if (!root?.members) throw new Error(`${ctx.api.id} has no Config interface`);
  const base: ConfigGroup = { name: 'base', items: [] };
  const groups: ConfigGroup[] = [base];
  for (const top of root.members) {
    const ns = top.type === top.ref ? expandable(top, ctx) : undefined;
    if (!ns) {
      base.items.push(configItem(top, top.name, root.name, rsbuild));
      continue;
    }
    const group: ConfigGroup = { name: top.name, items: [] };
    for (const m of ns.members ?? []) {
      const path = `${top.name}.${m.name}`;
      const item = configItem(m, path, ns.name, rsbuild);
      group.items.push(item);
      const e = item.lynx ? undefined : expandable(m, ctx);
      if (e) {
        const nested: ConfigItem[] = [];
        collectLynx(
          e.members ?? [],
          path,
          e.name,
          ctx,
          rsbuild,
          new Set([ns.name, e.name]),
          nested,
        );
        group.items.push(
          ...nested.map(i => ({ ...i, lynx: true, changed: false })),
        );
      }
    }
    groups.push(group);
  }
  return groups.filter(g => g.items.length > 0).sort((a, b) =>
    groupRank(a.name) - groupRank(b.name) || a.name.localeCompare(b.name)
  );
}

export function configPagePaths(
  dataDir: string,
): { path: string; lynx: boolean }[] {
  const ctx: Ctx = {
    api: loadApi(dataDir, 'rspeedy'),
    l: EN,
    anchors: new Map(),
    stale: new Set(),
  };
  const rsbuild = loadRsbuild(join(dataDir, 'rsbuild-config.json'));
  return configGroups(ctx, rsbuild).flatMap(g =>
    g.items.filter(i => i.lynx || i.changed).map(i => ({
      path: i.path,
      lynx: i.lynx,
    }))
  );
}

function renderConfigOverview(ctx: Ctx, rsbuild: RsbuildOptions): string {
  const lynxBadge =
    `<span className="api-badge api-badge-lynx">${ctx.l.lynxBadge}</span>`;
  const defaultBadge =
    `<span className="api-badge api-badge-default">${ctx.l.defaultBadge}</span>`;
  const legend = ctx.l.overviewLegend.replace('{lynx}', lynxBadge).replace(
    '{default}',
    defaultBadge,
  );
  let s = `${legend}\n\n<div className="api-config-overview">\n\n`;
  for (const g of configGroups(ctx, rsbuild)) {
    s += `<div className="api-config-group" id="${slug(g.name)}">\n\n`;
    s += `<div className="api-config-group-title">${g.name}</div>\n\n`;
    for (const { path, lynx, changed } of g.items) {
      const url = lynx || changed
        ? `${ctx.prefix ?? ''}${configPageUrl(path)}`
        : rsbuildUrl(path, ctx);
      const badge = lynx
        ? ` ${lynxBadge}`
        : (changed ? ` ${defaultBadge}` : '');
      s += `- <span id="${slug(path)}"></span>[${path}](${url})${badge}\n`;
    }
    s += '\n</div>\n\n';
  }
  return `${s}</div>\n\n`;
}

function resolveConfigMember(
  ctx: Ctx,
  path: string,
): { m: ApiMember; owner: string } {
  const root = findExport(ctx, 'Config');
  let list = root?.members ?? [];
  let owner = root?.name ?? 'Config';
  const segs = path.split('.');
  for (const [i, seg] of segs.entries()) {
    const m = list.find(x => x.name === seg);
    if (!m) break;
    if (i === segs.length - 1) return { m, owner };
    const e = expandable(m, ctx);
    if (!e) break;
    list = e.members ?? [];
    owner = e.name;
  }
  throw new Error(`ConfigOption: ${path} not found`);
}

function objectLines(segs: string[], value: string, depth: number): string[] {
  const pad = '  '.repeat(depth);
  const [head = '', ...rest] = segs;
  return rest.length === 0
    ? [`${pad}${head}: ${value},`]
    : [`${pad}${head}: {`, ...objectLines(rest, value, depth + 1), `${pad}},`];
}

function configUsage(path: string, m: ApiMember, ctx: Ctx): string {
  if (m.deprecated !== undefined) return '';
  const segs = path.split('.');
  const literal = /^`([^`]+)`$/.exec(m.default?.trim() ?? '')?.[1];
  const value = literal && literal !== 'undefined'
    ? literal
    : (/^boolean\b/.test(m.type) ? 'true' : '{}');
  const lynxConfig = [
    '```ts title="lynx.config.ts"',
    'import { defineConfig } from \'@lynx-js/rspeedy\'',
    '',
    'export default defineConfig({',
    ...objectLines(segs, value, 1),
    '})',
    '```',
  ].join('\n');
  const s = `## ${ctx.l.usage} \\{#usage\\}\n\n`;
  const plugin = ctx.site?.get(`rsbuild-plugin|${path}`);
  if (!plugin) return `${s}${ctx.l.rspeedyOnly}\n\n${lynxConfig}\n\n`;
  const rsbuildConfig = [
    '```ts title="rsbuild.config.ts"',
    'import { defineConfig } from \'@rsbuild/core\'',
    'import { pluginLynx } from \'@lynx-js/rsbuild-plugin\'',
    '',
    'export default defineConfig({',
    '  plugins: [',
    '    pluginLynx({',
    ...objectLines(segs, value, 3),
    '    }),',
    '  ],',
    '})',
    '```',
  ].join('\n');
  const link = `[\`pluginLynx\`](${ctx.prefix ?? ''}${plugin.url})`;
  return `${s}${
    ctx.l.withPluginLynx.replace('{link}', link)
  }\n\n${rsbuildConfig}\n\n${ctx.l.withRspeedy}\n\n${lynxConfig}\n\n`;
}

function splitSentences(text: string): string[] {
  const out: string[] = [];
  let inCode = false;
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '`') inCode = !inCode;
    if (inCode) continue;
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    else if (
      depth === 0 && (ch === '。'
        || (ch === '.' && /\s/.test(text[i + 1] ?? ' ')
          && !/(?:e\.g|i\.e|etc)$/.test(text.slice(start, i))))
    ) {
      out.push(text.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

function defaultParts(
  m: ApiMember,
  ctx: Ctx,
  key: string,
): { inline: string | undefined; section: string | undefined } {
  const text = tr(ctx, `${key}.default`, m.default)?.trim();
  if (!text || /^`?undefined`?$/.test(text)) {
    return { inline: undefined, section: undefined };
  }
  const literal = /^`[^`]+`/.exec(text)?.[0];
  const rest = (literal ? text.slice(literal.length) : text)
    .replace(/^[\s.,;:，。；：]+/, '')
    .trim();
  const inline = literal ? md(literal, ctx) : undefined;
  if (!rest) return { inline, section: undefined };
  const section = rest.includes('\n')
    ? md(rest, ctx)
    : splitSentences(rest).map(x => `- ${md(x, ctx)}`).join('\n');
  return { inline, section };
}

function configMeta(
  m: ApiMember,
  ctx: Ctx,
  inline: string | undefined,
): string {
  const rows = [`- **${ctx.l.type}${ctx.l.colon}** ${typeCell(m, ctx)}`];
  if (inline) rows.push(`- **${ctx.l.default}${ctx.l.colon}** ${inline}`);
  return `${rows.join('\n')}\n\n`;
}

function defaultSection(ctx: Ctx, section: string | undefined): string {
  return section ? `## ${ctx.l.default} \\{#default\\}\n\n${section}\n\n` : '';
}

function renderRsbuildDefault(
  ctx: Ctx,
  path: string,
  m: ApiMember,
  key: string,
): string {
  ctx.anchors.set(path, '');
  const { inline, section } = defaultParts(m, ctx, key);
  const warning = m.deprecated === undefined
    ? ''
    : `:::warning ${ctx.l.deprecated}\n${
      md(tr(ctx, `${key}.deprecated`, m.deprecated), ctx)
    }\n:::\n\n`;
  const mark = untranslated(ctx, `${key}.default`).trim();
  const link = `[${ctx.l.rsbuildDocsLink}](${rsbuildUrl(path, ctx)})`;
  return `${mark ? `${mark}\n\n` : ''}${configMeta(m, ctx, inline)}${warning}${
    ctx.l.rsbuildOption.replace('{link}', link)
  }\n\n${defaultSection(ctx, section)}`;
}

function renderConfigOption(
  ctx: Ctx,
  path: string,
  rsbuild: RsbuildOptions,
): string {
  const { m, owner } = resolveConfigMember(ctx, path);
  const key = `${owner}.${m.name}`;
  if (isRsbuild(path, rsbuild)) {
    return renderRsbuildDefault(ctx, path, m, key);
  }
  ctx.anchors.set(path, '');
  const e = expandable(m, ctx);
  if (e) {
    ctx.anchors.set(e.name, '');
    registerAnchors(e.members ?? [], path, ctx);
  }
  const { inline, section } = defaultParts(m, ctx, key);
  let s = configMeta(m, ctx, inline) + body(m, ctx, key)
    + defaultSection(ctx, section);
  const mark = untranslated(ctx, `${key}.summary`).trim();
  if (mark) s = `${mark}\n\n${s}`;
  s += configUsage(path, m, ctx);
  if (m.params) s += paramsTable(m.params, ctx, key);
  if (e) {
    s += `## ${ctx.l.options} \\{#options\\}\n\n${
      renderOptions(
        e.members ?? [],
        path,
        3,
        ctx,
        e.name,
        new Set([owner, e.name]),
      )
    }`;
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
  const withDefault = members.some(m => m.default !== undefined);
  let s = `| ${ctx.l.members} | ${ctx.l.type} |${
    withDefault ? ` ${ctx.l.default} |` : ''
  } ${ctx.l.description} |\n| --- | --- |${
    withDefault ? ' --- |' : ''
  } --- |\n`;
  for (const m of members) {
    const key = `${parent}.${m.name}`;
    const summary = tr(ctx, `${key}.summary`, m.summary);
    const def = m.default === undefined
      ? ''
      : pipe(flat(md(tr(ctx, `${key}.default`, m.default), ctx)));
    s += `| <a id="${slug(key)}"></a>${code(m.name + (m.optional ? '?' : ''))}${
      badges(m, ctx)
    }${untranslated(ctx, `${key}.summary`)} | ${pipe(typeCell(m, ctx))} |${
      withDefault ? ` ${def} |` : ''
    } ${pipe(flat(md(summary, ctx)))} |\n`;
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
    s += `- **${ctx.l.default}${ctx.l.colon}** ${
      md(tr(ctx, `${key}.default`, e.default), ctx)
    }\n\n`;
  }
  const sig = e.signatures?.[0];
  if (sig) {
    s += paramsTable(sig.params, ctx, key);
    if (sig.returns.type && sig.returns.type !== 'void') {
      s += `**${ctx.l.returns}${ctx.l.colon}** ${typeCell(sig.returns, ctx)}${
        sig.returns.description
          ? ' — '
            + md(tr(ctx, `${key}.returns`, sig.returns.description), ctx)
              .replace(/\n+/g, ' ')
          : ''
      }\n\n`;
    }
  }
  if (e.members && e.members.length > 0) {
    const exported = new Set(ctx.api.exports.map(x => x.name));
    const compact = e.members.filter(m => isCompact(m, ctx, exported));
    s += membersTable(compact, ctx, e.name);
    for (const m of e.members.filter(m => !compact.includes(m))) {
      const path = `${e.name}.${m.name}`;
      s += heading(depth + 1, path, m, ctx, path, true);
      s += metaList(m, ctx, path);
      s += body(m, ctx, path);
      if (m.params) s += paramsTable(m.params, ctx, path);
    }
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
  for (const e of list) {
    ctx.anchors.set(e.name, slug(e.name));
    for (const m of e.members ?? []) {
      ctx.anchors.set(`${e.name}.${m.name}`, slug(`${e.name}.${m.name}`));
    }
  }
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

let packageIndex: Record<string, { package: string }> | undefined;

export function packageLabel(dataDir: string, entry: PackageEntry): string {
  packageIndex ??= JSON.parse(
    readFileSync(join(dataDir, 'index.json'), 'utf8'),
  ) as Record<string, { package: string }>;
  const name = entry.name ?? packageIndex[entry.id]?.package
    ?? `@lynx-js/${entry.id}`;
  return name.replace(/^@lynx-js\//, '');
}

export const packagePageUrl = (entry: PackageEntry) =>
  entry.page ?? `/api/packages/${entry.id}`;

function renderPackagesOverview(
  dataDir: string,
  l: Locale,
  prefix: string,
): string {
  let s = '<div className="api-config-overview api-packages-overview">\n\n';
  for (const group of PACKAGE_GROUPS) {
    s += `<div className="api-config-group" id="${group}">\n\n`;
    s += `<div className="api-config-group-title">${
      l.packageGroups[group]
    }</div>\n\n`;
    for (const entry of PACKAGES.filter(e => e.group === group)) {
      const main = entry.main
        ? ` <span className="api-package-main">${entry.main}</span>`
        : '';
      s += `- <span id="${entry.id}"></span>[${
        packageLabel(dataDir, entry)
      }](${prefix}${packagePageUrl(entry)})${main}\n`;
    }
    s += '\n</div>\n\n';
  }
  return `${s}</div>\n\n`;
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
  if (d.name === 'PackagesOverview') {
    return renderPackagesOverview(dataDir, locale, options.prefix ?? '');
  }
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
    case 'ConfigOverview':
      if (!ctx.rsbuild) {
        throw new Error(
          'ConfigOverview: api-data/rsbuild-config.json is missing',
        );
      }
      return renderConfigOverview(ctx, ctx.rsbuild);
    case 'ConfigOption':
      if (!ctx.rsbuild) {
        throw new Error(
          'ConfigOption: api-data/rsbuild-config.json is missing',
        );
      }
      return renderConfigOption(ctx, d.attrs['path']!, ctx.rsbuild);
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
