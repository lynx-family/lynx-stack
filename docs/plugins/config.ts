// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { Converter, DeclarationReflection, ReflectionKind } from 'typedoc';
import type {
  Application,
  Context,
  ProjectReflection,
  SomeType,
} from 'typedoc';
import {
  MarkdownPageEvent,
  MarkdownRendererEvent,
} from 'typedoc-plugin-markdown';
import type { MarkdownTheme } from 'typedoc-plugin-markdown';
import ts from 'typescript';

import type { Translations } from './translate.ts';
import { CONTENT } from './workspace.ts';
import type { Locale } from './workspace.ts';

type Category = 'Lynx' | 'Default changed' | 'Rspeedy' | 'Rsbuild';

interface ConfigOption {
  path: string[];
  category: Category;
  reflection: DeclarationReflection;
}

const CATEGORIES: { category: Category; description: string }[] = [
  {
    category: 'Lynx',
    description:
      'Options that [`pluginLynx`](/api/packages/rsbuild-plugin) adds for Lynx bundles. With Rsbuild, pass them to `pluginLynx()`; with Rspeedy, set them in `lynx.config.ts`.',
  },
  {
    category: 'Default changed',
    description:
      'Rsbuild options whose default `pluginLynx` changes for Lynx bundles.',
  },
  {
    category: 'Rspeedy',
    description:
      'Options that only `lynx.config.ts` accepts. Rsbuild does not have them.',
  },
  {
    category: 'Rsbuild',
    description:
      'Rsbuild options that work in a Lynx app as they are documented by Rsbuild.',
  },
];

const RSPEEDY_CONFIG = 'packages/rspeedy/core/src/config/index.ts';

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`);
}

function slug(path: string[]): string {
  const [first, ...rest] = path;
  return rest.length === 0
    ? kebab(first!)
    : `${first}/${rest.map(name => kebab(name)).join('-')}`;
}

function interfacesOf(type: SomeType | undefined): DeclarationReflection[] {
  if (type?.type === 'union') {
    return type.types.flatMap(member => interfacesOf(member));
  }
  if (
    type?.type === 'reference'
    && type.reflection instanceof DeclarationReflection
    && type.reflection.kindOf(ReflectionKind.Interface)
  ) {
    return [type.reflection];
  }
  return [];
}

function* properties(
  model: DeclarationReflection,
  prefix: string[],
  expand: (path: string[]) => boolean,
): Generator<{ path: string[]; reflection: DeclarationReflection }> {
  for (const child of model.children ?? []) {
    if (!child.kindOf(ReflectionKind.Property)) continue;
    const path = [...prefix, child.name];
    const children = interfacesOf(child.type);
    if (prefix.length > 0 || children.length === 0) {
      yield { path, reflection: child };
    }
    if (expand(path)) {
      for (const iface of children) yield* properties(iface, path, expand);
    }
  }
}

/**
 * Reads whether an option path exists in the `RsbuildConfig` that Rspeedy
 * imports.
 */
function rsbuildPaths(context: Context, file: ts.SourceFile) {
  const checker = context.checker;
  const alias = checker
    .getSymbolsInScope(file, ts.SymbolFlags.Alias)
    .find(symbol => symbol.name === 'RsbuildConfig')!;
  const config = checker.getDeclaredTypeOfSymbol(
    checker.getAliasedSymbol(alias),
  );
  return (path: string[]): boolean => {
    let types = [config];
    for (const name of path) {
      types = types.flatMap(type => {
        const nonNullable = checker.getNonNullableType(type);
        return (nonNullable.isUnion() ? nonNullable.types : [nonNullable])
          .map(member => member.getProperty(name))
          .filter(symbol => symbol !== undefined)
          .map(symbol => checker.getTypeOfSymbol(symbol));
      });
      if (types.length === 0) return false;
    }
    return true;
  };
}

function collectOptions(
  project: ProjectReflection,
  inRsbuild: (path: string[]) => boolean,
): ConfigOption[] {
  const options = new Map<string, ConfigOption>();
  const lynx = project.getChildByName([
    '@lynx-js/rsbuild-plugin',
    'LynxPluginOptions',
  ]) as DeclarationReflection;
  for (const { path, reflection } of properties(lynx, [], () => true)) {
    if (interfacesOf(reflection.type).length > 0) continue;
    options.set(path.join('.'), { path, category: 'Lynx', reflection });
  }
  const rspeedy = project.getChildByName([
    '@lynx-js/rspeedy',
    'Config',
  ]) as DeclarationReflection;
  for (const { path, reflection } of properties(rspeedy, [], inRsbuild)) {
    const key = path.join('.');
    if (options.has(key)) continue;
    if (reflection.comment?.hasModifier('@lynxDefaultChanged')) {
      options.set(key, { path, category: 'Default changed', reflection });
    } else if (!inRsbuild(path)) {
      options.set(key, { path, category: 'Rspeedy', reflection });
    } else if (path.length <= 2) {
      options.set(key, { path, category: 'Rsbuild', reflection });
    }
  }
  return [...options.values()].sort((a, b) =>
    Number(a.path.length > 1) - Number(b.path.length > 1)
    || a.path.join('.').localeCompare(b.path.join('.'))
  );
}

function linkOf(option: ConfigOption, prefix: string): string {
  return option.category === 'Rsbuild'
    ? `https://rsbuild.rs/config/${slug(option.path)}`
    : `${prefix}/api/config/${slug(option.path)}`;
}

function write(file: string, content: string): void {
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, content);
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeOverview(
  options: ConfigOption[],
  out: string,
  prefix: string,
  text: (en: string) => string,
): void {
  const page = [
    `# ${text('Config overview')}`,
    '',
    text(
      'The options for building a Lynx app, with Rsbuild and `pluginLynx` in `rsbuild.config.ts` or with Rspeedy in `lynx.config.ts`.',
    ),
    '',
    'import { OverviewGroup } from \'@rspress/core/theme\';',
    '',
  ];
  for (const { category, description } of CATEGORIES) {
    const namespaces = new Map<string, ConfigOption[]>();
    for (const option of options) {
      if (option.category !== category) continue;
      const namespace = option.path.length === 1 ? 'base' : option.path[0]!;
      namespaces.set(namespace, [
        ...namespaces.get(namespace) ?? [],
        option,
      ]);
    }
    const group = {
      name: '',
      items: [...namespaces].map(([namespace, items]) => ({
        text: namespace,
        link: '',
        items: items.map(option => ({
          text: option.path.join('.'),
          link: linkOf(option, prefix),
        })),
      })),
    };
    page.push(
      `## ${text(category)}`,
      '',
      text(description),
      '',
      `<OverviewGroup group={${JSON.stringify(group)}} />`,
      '',
    );
  }
  write(join(out, 'index.mdx'), page.join('\n'));
}

function writeSidebar(
  options: ConfigOption[],
  out: string,
  text: (en: string) => string,
): void {
  const pages = options.filter(option => option.category !== 'Rsbuild');
  const item = (option: ConfigOption) => ({
    type: 'file',
    name: slug(option.path).split('/').pop(),
    label: option.path.join('.'),
    tag: text(option.category),
  });
  const namespaces = [
    ...new Set(
      pages.filter(option => option.path.length > 1).map(option =>
        option.path[0]!
      ),
    ),
  ];
  write(
    join(out, '_meta.json'),
    json([
      ...pages.filter(option => option.path.length === 1).map(option =>
        item(option)
      ),
      ...namespaces.map(namespace => ({
        type: 'dir-section-header',
        name: namespace,
        label: namespace,
      })),
    ]),
  );
  for (const namespace of namespaces) {
    write(
      join(out, namespace, '_meta.json'),
      json(
        pages.filter(option =>
          option.path.length > 1 && option.path[0] === namespace
        ).map(option => item(option)),
      ),
    );
  }
}

/**
 * Renders the configuration reference under `api/config` from the TSDoc of
 * the Rspeedy `Config` and the `pluginLynx` options.
 *
 * @remarks
 *
 * Each option is classified by where it comes from: `Lynx` options are in
 * `LynxPluginOptions`, `Default changed` options are tagged `@lynxDefaultChanged`,
 * `Rspeedy` options are not in `RsbuildConfig`, and the remaining `Rsbuild`
 * options link to the Rsbuild documentation.
 */
export function renderConfigReference(
  app: Application,
  locale: Locale,
  translations: Translations,
): void {
  let inRsbuild: ((path: string[]) => boolean) | undefined;
  app.converter.on(
    Converter.EVENT_CREATE_DECLARATION,
    (context: Context, reflection: DeclarationReflection) => {
      if (inRsbuild || !reflection.kindOf(ReflectionKind.Interface)) return;
      const file = context.getSymbolFromReflection(reflection)?.declarations
        ?.[0]?.getSourceFile();
      if (file?.fileName.endsWith(RSPEEDY_CONFIG)) {
        inRsbuild = rsbuildPaths(context, file);
      }
    },
  );
  app.renderer.on(
    MarkdownRendererEvent.END,
    (event: MarkdownRendererEvent) => {
      const prefix = locale === 'en' ? '' : `/${locale}`;
      const out = join(CONTENT, locale, 'api/config');
      const text = (en: string) => translations.translate(en, locale);
      const options = collectOptions(event.project, inRsbuild!);
      const theme = app.renderer.theme as MarkdownTheme;
      app.options.setValue('publicPath', `${prefix}/api/packages`);
      for (const option of options) {
        if (option.category === 'Rsbuild') continue;
        const page = new MarkdownPageEvent(option.reflection);
        page.project = event.project;
        const member = theme.getRenderContext(page).partials.member(
          option.reflection,
          { headingLevel: 1 },
        );
        write(
          join(out, `${slug(option.path)}.mdx`),
          text(`# ${option.path.join('.')}\n\n${member}`),
        );
      }
      app.options.setValue('publicPath', '');
      writeOverview(options, out, prefix, text);
      writeSidebar(options, out, text);
    },
  );
}
