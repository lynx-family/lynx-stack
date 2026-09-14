// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Application,
  LiteralType,
  ReferenceType,
  Reflection,
  ReflectionKind,
  ReflectionType,
  TSConfigReader,
  TypeDocReader,
  UnionType,
} from 'typedoc';
import type {
  Comment,
  CommentDisplayPart,
  DeclarationReflection,
  ProjectReflection,
  SignatureReflection,
  Type,
} from 'typedoc';

import { PACKAGES } from './packages.ts';
import type { PackageEntry } from './packages.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = join(ROOT, 'docs/api-data');

export interface ApiMember {
  name: string;
  optional?: boolean;
  type: string;
  ref?: string;
  external?: string;
  default?: string;
  summary?: string;
  remarks?: string;
  examples?: string[];
  deprecated?: string;
  beta?: boolean;
  alpha?: boolean;
  experimental?: boolean;
  params?: ApiParam[];
  returns?: { type: string; description?: string };
  members?: ApiMember[];
  kind?: string;
}

export interface ApiParam {
  name: string;
  type: string;
  optional?: boolean;
  description?: string;
}

export interface ApiExport extends ApiMember {
  kind: string;
  signatures?: ApiSignature[];
  literalUnion?: string[];
}

export interface ApiSignature {
  text: string;
  params: ApiParam[];
  returns: { type: string; description?: string };
  summary?: string;
  remarks?: string;
  examples?: string[];
}

export interface ApiData {
  id: string;
  package: string;
  version: string;
  description?: string;
  section: string;
  internal?: boolean;
  srcUrl: string;
  exports: ApiExport[];
}

const only = process.argv.slice(2);

function partsToMd(parts: readonly CommentDisplayPart[] | undefined): string {
  if (!parts || parts.length === 0) return '';
  return parts.map(p => {
    if (p.kind === 'inline-tag') {
      const target = p.target;
      if (target instanceof Reflection) {
        return `[\`${p.text || target.name}\`](api:${qualifiedName(target)})`;
      }
      if (typeof target === 'string') {
        const text = p.text?.trim() || target;
        return `[${text}](${target})`;
      }
      return `\`${p.text}\``;
    }
    return p.text;
  }).join('').replace(/\r\n?/g, '\n').trim();
}

function qualifiedName(r: Reflection): string {
  const names: string[] = [];
  let cur: Reflection | undefined = r;
  while (cur && !(cur.kindOf(ReflectionKind.Project))) {
    if (
      !cur.kindOf(
        ReflectionKind.CallSignature | ReflectionKind.ConstructorSignature,
      )
    ) {
      names.unshift(cur.name);
    }
    cur = cur.parent;
  }
  return names.join('.');
}

function tag(
  comment: Comment | undefined,
  name: `@${string}`,
): string | undefined {
  const t = comment?.blockTags.find(b => b.tag === name);
  return t ? partsToMd(t.content) : undefined;
}

function tags(comment: Comment | undefined, name: `@${string}`): string[] {
  return comment?.blockTags.filter(b => b.tag === name).map(b =>
    partsToMd(b.content)
  ).filter(Boolean) ?? [];
}

function unwrapCodeFence(md: string): string {
  const m = /^```[a-z]*\n([^\n]*)\n```$/.exec(md);
  return m ? `\`${m[1]}\`` : md;
}

function stripUndefined(t: string): string {
  return t.replace(/\s*\|\s*undefined$/, '').replace(/^undefined\s*\|\s*/, '');
}

function typeInfo(
  type: Type | undefined,
  project: ProjectReflection,
): Pick<ApiMember, 'type' | 'ref' | 'external'> {
  if (!type) return { type: 'unknown' };
  const text = type.toString();
  const refs: ReferenceType[] = [];
  type.visit({
    reference: r => {
      refs.push(r);
    },
  });
  const inner = refs.length > 0
    ? refs
    : (type instanceof ReferenceType ? [type] : []);
  const out: Pick<ApiMember, 'type' | 'ref' | 'external'> = { type: text };
  for (const r of inner) {
    const refl = r.reflection;
    if (
      refl && refl.parent === project
      && refl.kindOf(
        ReflectionKind.Interface | ReflectionKind.TypeAlias
          | ReflectionKind.Class,
      )
    ) {
      out.ref = refl.name;
      break;
    }
    if (!refl && r.package && !r.package.startsWith('@lynx-js/')) {
      out.external = r.package;
    }
  }
  return out;
}

const LICENSE_HEADER = /^(?:\/\/\s*)?Copyright \d{4}/;

function commentFields(comment: Comment | undefined): Partial<ApiMember> {
  if (!comment || LICENSE_HEADER.test(partsToMd(comment.summary))) return {};
  const out: Partial<ApiMember> = {};
  const summary = partsToMd(comment.summary);
  if (summary) out.summary = summary;
  const remarks = tag(comment, '@remarks');
  if (remarks) out.remarks = remarks;
  const examples = tags(comment, '@example');
  if (examples.length > 0) out.examples = examples;
  const dep = comment.blockTags.find(b => b.tag === '@deprecated');
  if (dep || comment.modifierTags.has('@deprecated')) {
    out.deprecated = partsToMd(dep?.content) || 'Deprecated.';
  }
  const def = tag(comment, '@defaultValue') ?? tag(comment, '@default');
  if (def !== undefined) out.default = unwrapCodeFence(def);
  if (comment.modifierTags.has('@beta')) out.beta = true;
  if (comment.modifierTags.has('@alpha')) out.alpha = true;
  if (comment.modifierTags.has('@experimental')) out.experimental = true;
  return out;
}

function signature(sig: SignatureReflection): ApiSignature {
  const params: ApiParam[] = (sig.parameters ?? []).map(p => ({
    name: p.name,
    type: stripUndefined(p.type?.toString() ?? 'unknown'),
    ...(p.flags.isOptional ? { optional: true } : {}),
    ...(p.comment ? { description: partsToMd(p.comment.summary) } : {}),
  }));
  const returnsDesc = tag(sig.comment, '@returns');
  const text = `${sig.parent?.name ?? sig.name}(${
    params.map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ')
  }): ${sig.type?.toString() ?? 'void'}`;
  const c = commentFields(sig.comment);
  return {
    text,
    params,
    returns: {
      type: sig.type?.toString() ?? 'void',
      ...(returnsDesc ? { description: returnsDesc } : {}),
    },
    ...(c.summary ? { summary: c.summary } : {}),
    ...(c.remarks ? { remarks: c.remarks } : {}),
    ...(c.examples ? { examples: c.examples } : {}),
  };
}

function member(
  r: DeclarationReflection,
  project: ProjectReflection,
): ApiMember {
  const optional = r.flags.isOptional;
  const base = typeInfo(r.type, project);
  const m: ApiMember = {
    name: r.name,
    ...(optional ? { optional: true } : {}),
    ...base,
    type: optional ? stripUndefined(base.type) : base.type,
    ...commentFields(r.comment),
    kind: ReflectionKind[r.kind].toLowerCase(),
  };
  if (
    r.kindOf(ReflectionKind.Method | ReflectionKind.Constructor)
    && r.signatures?.[0]
  ) {
    const s = signature(r.signatures[0]);
    m.type = s.text;
    m.params = s.params;
    m.returns = s.returns;
    if (!m.summary && s.summary) m.summary = s.summary;
    if (!m.remarks && s.remarks) m.remarks = s.remarks;
    if (!m.examples && s.examples) m.examples = s.examples;
  }
  if (r.kindOf(ReflectionKind.Accessor) && r.getSignature) {
    m.type = r.getSignature.type?.toString() ?? m.type;
    m.summary ??= partsToMd(r.getSignature.comment?.summary);
  }
  return m;
}

function exportOf(
  r: DeclarationReflection,
  project: ProjectReflection,
): ApiExport {
  const kind = ReflectionKind[r.kind].toLowerCase();
  const base = typeInfo(r.type, project);
  const e: ApiExport = {
    name: r.name,
    kind,
    ...base,
    ...commentFields(r.comment),
  };
  const fnSignatures =
    r.kindOf(ReflectionKind.Variable) && r.type instanceof ReflectionType
      ? r.type.declaration.signatures ?? []
      : [];
  if (fnSignatures.length > 0 && (r.signatures?.length ?? 0) === 0) {
    e.kind = 'function';
    const signatures: ApiSignature[] = fnSignatures.map(s => ({
      ...signature(s),
      text: signature(s).text.replace(/^__type/, r.name),
    }));
    e.signatures = signatures;
    const first = signatures[0]!;
    if (!e.summary && first.summary) e.summary = first.summary;
    if (!e.remarks && first.remarks) e.remarks = first.remarks;
    if (!e.examples && first.examples) e.examples = first.examples;
    e.type = first.text;
  }
  if (r.signatures && r.signatures.length > 0) {
    e.signatures = r.signatures.map(s => signature(s));
    const first = e.signatures[0]!;
    if (!e.summary && first.summary) e.summary = first.summary;
    if (!e.remarks && first.remarks) e.remarks = first.remarks;
    if (!e.examples && first.examples) e.examples = first.examples;
    e.type = first.text;
  }
  if (
    r.kindOf(
      ReflectionKind.Interface | ReflectionKind.Class | ReflectionKind.Enum
        | ReflectionKind.Namespace,
    )
  ) {
    e.members = (r.children ?? [])
      .filter(c =>
        !c.flags.isPrivate && !c.flags.isProtected
        && !c.comment?.modifierTags.has('@internal')
      )
      .map(c => member(c, project));
  }
  if (r.kindOf(ReflectionKind.TypeAlias)) {
    const t = r.type;
    const children = t instanceof ReflectionType
      ? t.declaration.children ?? []
      : [];
    if (children.length > 0) {
      e.members = children.map(c => member(c, project));
    }
    if (t instanceof UnionType) {
      const literals = t.types.filter(u => u instanceof LiteralType);
      if (literals.length === t.types.length) {
        e.literalUnion = literals.map(u => JSON.stringify(u.value));
      }
    }
  }
  if (r.kindOf(ReflectionKind.Variable) && r.defaultValue && !e.default) {
    e.default = r.defaultValue;
  }
  return e;
}

async function generate(entry: PackageEntry): Promise<ApiData | null> {
  const dir = join(ROOT, entry.dir);
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
    name: string;
    version: string;
    description?: string;
  };
  const entries = (Array.isArray(entry.entry) ? entry.entry : [entry.entry])
    .map(e => join(dir, e));
  for (const e of entries) {
    if (!existsSync(e)) {
      console.warn(`  skip ${entry.id}: entry not found ${e}`);
      return null;
    }
  }
  const tsconfig = join(dir, entry.tsconfig ?? 'tsconfig.json');
  const base = existsSync(tsconfig) ? tsconfig : join(ROOT, 'tsconfig.json');
  const project = await convert(entries, base)
    ?? await convert(entries, entryOnlyTsconfig(entry.id, base, entries));
  if (!project) {
    console.warn(`  skip ${entry.id}: convert failed`);
    return null;
  }
  const children = (project.children ?? []).filter(c =>
    !c.comment?.modifierTags.has('@internal')
  );
  const apiExports = children.map(c => exportOf(c, project));
  for (const e of apiExports) {
    const callable = e.kind === 'variable' && e.ref
      ? apiExports.find(x =>
        x.name === e.ref && (x.signatures?.length ?? 0) > 0
      )
      : undefined;
    if (!callable?.signatures) continue;
    e.kind = 'function';
    e.signatures = callable.signatures.map(sig => ({
      ...sig,
      text: sig.text.replace(callable.name, e.name),
    }));
    e.type = e.signatures[0]!.text;
    delete e.ref;
    if (!e.summary && callable.summary) e.summary = callable.summary;
  }
  return {
    id: entry.id,
    package: pkg.name,
    version: pkg.version,
    ...(pkg.description ? { description: pkg.description } : {}),
    section: entry.section,
    ...(entry.internal ? { internal: true } : {}),
    srcUrl: `https://github.com/lynx-family/lynx-stack/tree/main/${entry.dir}`,
    exports: apiExports,
  };
}

function entryOnlyTsconfig(
  id: string,
  base: string,
  entries: string[],
): string {
  const dir = join(tmpdir(), 'lynx-docs-tsconfig');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${id}.json`);
  writeFileSync(
    path,
    JSON.stringify({
      extends: base,
      compilerOptions: { noEmit: true, rootDir: '/' },
      files: entries,
      include: [],
    }),
  );
  return path;
}

async function convert(
  entries: string[],
  tsconfig: string,
): Promise<ProjectReflection | undefined> {
  const app = await Application.bootstrapWithPlugins({
    entryPoints: entries,
    tsconfig,
    excludePrivate: true,
    excludeProtected: true,
    excludeExternals: true,
    excludeInternal: true,
    disableSources: true,
    logLevel: 'Warn',
    skipErrorChecking: true,
    blockTags: [
      '@defaultValue',
      '@default',
      '@remarks',
      '@example',
      '@deprecated',
      '@returns',
      '@param',
      '@see',
      '@since',
      '@platform',
      '@inheritdoc',
    ],
    modifierTags: [
      '@public',
      '@beta',
      '@alpha',
      '@internal',
      '@experimental',
      '@deprecated',
      '@packageDocumentation',
      '@sealed',
      '@virtual',
      '@override',
      '@readonly',
      '@eventProperty',
    ],
  }, [new TSConfigReader(), new TypeDocReader()]);
  return await app.convert();
}

mkdirSync(OUT_DIR, { recursive: true });
const failed: string[] = [];
const index: Record<
  string,
  {
    package: string;
    version: string;
    section: string;
    internal?: boolean;
    description?: string;
    exports: number;
  }
> = {};
for (const entry of PACKAGES) {
  if (only.length > 0 && !only.includes(entry.id)) continue;
  process.stdout.write(`${entry.id} ... `);
  try {
    const data = await generate(entry);
    if (!data) {
      failed.push(entry.id);
      continue;
    }
    writeFileSync(
      join(OUT_DIR, `${entry.id}.json`),
      JSON.stringify(data, null, 2) + '\n',
    );
    index[entry.id] = {
      package: data.package,
      version: data.version,
      section: data.section,
      ...(data.internal ? { internal: true } : {}),
      ...(data.description ? { description: data.description } : {}),
      exports: data.exports.length,
    };
    console.info(`${data.exports.length} exports`);
  } catch (err) {
    failed.push(entry.id);
    console.info(`FAILED: ${(err as Error).message.split('\n')[0]}`);
  }
}
if (only.length === 0) {
  writeFileSync(
    join(OUT_DIR, 'index.json'),
    JSON.stringify(index, null, 2) + '\n',
  );
}
if (failed.length > 0) console.info(`\nfailed: ${failed.join(', ')}`);
