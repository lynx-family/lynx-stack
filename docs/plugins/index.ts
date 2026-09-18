// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, extname, join } from 'node:path';

import type { RspressPlugin } from '@rspress/core';

import { renderConfigReference } from './config.ts';
import { pluginPackagePages } from './packages.ts';
import { sections } from './sections.ts';
import { Translations } from './translate.ts';
import { pluginApiSection } from './typedoc.ts';
import {
  CONTENT,
  DOCS,
  LOCALES,
  json,
  publicPackages,
  write,
} from './workspace.ts';
import type { Locale } from './workspace.ts';

/**
 * The top navigation of this site, by the section each entry opens. The
 * labels are single words, which the dictionary does not carry.
 */
const NAV = [
  { text: { en: 'Frameworks', zh: '框架' }, route: 'api/react' },
  {
    text: { en: 'Build', zh: '构建' },
    route: 'api/config',
    active: 'api/(config|packages)',
  },
];

/** Writes the navigation bar of a locale next to its pages. */
function writeNav(locale: Locale): void {
  const prefix = locale === 'en' ? '' : `/${locale}`;
  write(
    join(CONTENT, locale, '_nav.json'),
    json(
      NAV.map(item => ({
        text: item.text[locale],
        link: `${prefix}/${item.route}/`,
        activeMatch: `^${prefix}/${item.active ?? item.route}/`,
      })),
    ),
  );
}

/**
 * Writes what the generated reference contains, so a site that installs the
 * pages reads the sections and the packages to show from one file instead of
 * knowing the layout of the package.
 */
function writeManifest(): void {
  const routes = readdirSync(join(CONTENT, 'en/api'))
    .filter(name => statSync(join(CONTENT, 'en/api', name)).isDirectory())
    .sort();
  writeFileSync(
    join(DOCS, 'manifest.json'),
    `${
      JSON.stringify(
        {
          sections: routes.map(name => ({
            route: `api/${name}`,
            content: Object.fromEntries(
              LOCALES.map(locale => [locale, `content/${locale}/api/${name}`]),
            ),
          })),
          shownPackages: JSON.parse(
            readFileSync(join(DOCS, 'shown-packages.json'), 'utf8'),
          ) as unknown,
        },
        null,
        2,
      )
    }\n`,
  );
}

const SIDEBAR = [
  { name: 'react', label: '@lynx-js/react' },
  {
    name: 'react/testing-library',
    label: '@lynx-js/react/testing-library',
  },
  { name: 'genui', label: '@lynx-js/genui' },
  { name: 'config', label: 'Build configuration' },
  { name: 'packages', label: 'All packages' },
].map(item => ({
  type: 'dir',
  ...item,
  collapsible: true,
  collapsed: true,
}));

/** The sections listed by {@link SIDEBAR} instead of by their parent. */
const OWN_SIDEBAR_ENTRY = ['testing-library'];

/** The group TypeDoc puts the `@document` pages of a package in. */
const DOCUMENTS = 'Documents';

type SidebarItem =
  | string
  | {
    type?: string;
    name?: string;
    collapsible?: boolean;
    collapsed?: boolean;
  };

/**
 * Rewrites an entry of a generated sidebar: the index page is the link of the
 * section itself, a section with its own entry is not listed by its parent,
 * and the `@document` pages are listed one by one instead of as a group.
 */
function sidebarItems(item: SidebarItem, dir: string): SidebarItem[] {
  if (typeof item === 'string') return item === 'index' ? [] : [item];
  if (OWN_SIDEBAR_ENTRY.includes(item.name ?? '')) return [];
  if (item.name !== DOCUMENTS) {
    return [
      item.type === 'dir'
        ? { ...item, collapsible: true, collapsed: true }
        : item,
    ];
  }
  return readdirSync(join(dir, DOCUMENTS)).filter(file => file !== '_meta.json')
    .sort().map(file => ({
      type: 'file',
      name: `${DOCUMENTS}/${basename(file, extname(file))}`,
    }));
}

/** Whether a sidebar entry is a `@document` page, which comes first. */
function isDocument(item: SidebarItem): boolean {
  return typeof item !== 'string'
    && (item.name?.startsWith(`${DOCUMENTS}/`) ?? false);
}

/**
 * The directories the `member` router writes for the exports a reader calls,
 * in the order the sidebar lists them.
 */
const API_KINDS = ['classes', 'functions', 'variables', 'enumerations'];

/**
 * The directories for the types those exports refer to. The sidebar leaves
 * them to the links of the pages that use them.
 */
const TYPE_KINDS = ['interfaces', 'type-aliases'];

/** The pages of a kind directory, as sidebar entries below the module. */
function kindItems(dir: string, kind: string): SidebarItem[] {
  const path = join(dir, kind);
  if (!existsSync(path)) return [];
  return readdirSync(path).filter(file => file !== '_meta.json').sort().map(
    file => ({
      type: 'file',
      name: `${kind}/${basename(file, extname(file))}`,
      label: basename(file, extname(file)),
    }),
  );
}

/**
 * Lists the exports of a module without their kind directories: what a reader
 * calls comes first, and a module of types alone still lists them.
 */
function writeMemberMeta(dir: string): void {
  const namespaces = join(dir, 'namespaces');
  const modules = readdirSync(dir).filter(name =>
    statSync(join(dir, name)).isDirectory()
    && ![...API_KINDS, ...TYPE_KINDS, 'namespaces'].includes(name)
  );
  const items = [
    ...modules.map(name => ({
      type: 'dir',
      name,
      label: name,
      collapsible: true,
      collapsed: true,
    })),
    ...API_KINDS.flatMap(kind => kindItems(dir, kind)),
    ...existsSync(namespaces)
      ? readdirSync(namespaces).filter(name =>
        statSync(join(namespaces, name)).isDirectory()
      ).sort().map(name => ({
        type: 'dir',
        name: `namespaces/${name}`,
        label: name,
        collapsible: true,
        collapsed: true,
      }))
      : [],
  ];
  writeFileSync(join(dir, '_meta.json'), json(items));
  for (const name of modules) writeMemberMeta(join(dir, name));
  if (existsSync(namespaces)) {
    for (const name of readdirSync(namespaces)) {
      const path = join(namespaces, name);
      if (statSync(path).isDirectory()) writeMemberMeta(path);
    }
  }
}

/** The kinds a page of a group can document, in the order they are listed. */
const KIND_TITLES = [
  'Class',
  'Interface',
  'Type Alias',
  'Enumeration',
  'Function',
  'Variable',
  'Namespace',
];

/** The kind a generated page documents, read from its title. */
function pageKind(file: string): number {
  const title = /^# ([^:\n]+):/m.exec(readFileSync(file, 'utf8'))?.[1] ?? '';
  const index = KIND_TITLES.indexOf(title);
  return index === -1 ? KIND_TITLES.length : index;
}

/**
 * Lists the pages of a group by kind instead of by name, the way the kind
 * directories of the `member` router are listed. A group of a single kind, as
 * the packages without `@group` tags have, is left to the file order.
 */
function writeGroupMeta(dir: string): void {
  for (const name of readdirSync(dir)) {
    const group = join(dir, name);
    if (
      !statSync(group).isDirectory() || existsSync(join(group, '_meta.json'))
    ) continue;
    const pages = readdirSync(group).map(file => ({
      name: basename(file, extname(file)),
      kind: pageKind(join(group, file)),
    }));
    pages.sort((a, b) => a.kind - b.kind || a.name.localeCompare(b.name));
    writeFileSync(
      join(group, '_meta.json'),
      `${JSON.stringify(pages.map(page => page.name), null, 2)}\n`,
    );
  }
}

/**
 * The sidebar of a section, with the `@document` pages before the API groups.
 */
function sidebar(items: SidebarItem[], dir: string): SidebarItem[] {
  const entries = items.flatMap(item => sidebarItems(item, dir));
  return [
    ...entries.filter(item => isDocument(item)),
    ...entries.filter(item => !isDocument(item)),
  ];
}

/**
 * Generates the API reference under `content/<locale>/api` from the TSDoc of
 * the workspace packages. English runs first so the Chinese pages can reuse
 * the strings it records.
 */
export function pluginApiReference(): RspressPlugin[] {
  const translations = new Translations(join(DOCS, 'i18n/zh.json'));
  const packages = publicPackages();
  const all = sections(packages);
  return [
    {
      name: 'lynx:api-reference-clean',
      config(config) {
        for (const locale of LOCALES) {
          rmSync(join(CONTENT, locale, 'api'), {
            recursive: true,
            force: true,
          });
        }
        return config;
      },
    },
    ...LOCALES.flatMap(locale =>
      all.map(section =>
        pluginApiSection(
          section,
          locale,
          packages,
          translations,
          section.out === 'api/packages'
            ? app => renderConfigReference(app, locale, translations)
            : undefined,
        )
      )
    ),
    pluginPackagePages(packages, translations),
    {
      name: 'lynx:api-reference-sidebar',
      config(config, _utils, isProd) {
        for (const locale of LOCALES) {
          for (const section of all) {
            const dir = join(CONTENT, locale, section.out);
            const meta = join(dir, '_meta.json');
            if (section.router === 'group') {
              writeGroupMeta(dir);
              const items = JSON.parse(
                readFileSync(meta, 'utf8'),
              ) as SidebarItem[];
              writeFileSync(
                meta,
                `${JSON.stringify(sidebar(items, dir), null, 2)}\n`,
              );
            } else if (section.out === 'api/packages') {
              // The sidebar of the section itself lists the packages.
              for (const name of readdirSync(dir)) {
                const path = join(dir, name);
                if (statSync(path).isDirectory()) writeMemberMeta(path);
              }
            } else {
              writeMemberMeta(dir);
            }
          }
          writeNav(locale);
          writeFileSync(
            join(CONTENT, locale, 'api/_meta.json'),
            `${
              JSON.stringify(
                SIDEBAR.map(item => ({
                  ...item,
                  label: translations.translate(item.label, locale),
                })),
                null,
                2,
              )
            }\n`,
          );
        }
        writeManifest();
        translations.save();
        // `dev` shows the English text of a string the dictionary is missing;
        // a build stops, so it cannot ship.
        const missing = isProd ? translations.missing : [];
        if (missing.length > 0) {
          throw new Error(
            `${missing.length} strings are not translated in docs/i18n/zh.json:\n${
              missing.map(text => `  ${text}`).join('\n')
            }`,
          );
        }
        return config;
      },
    },
  ];
}
