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
import { CONTENT, DOCS, LOCALES, publicPackages } from './workspace.ts';

const SIDEBAR = [
  { type: 'dir', name: 'react', label: '@lynx-js/react' },
  {
    type: 'dir',
    name: 'react/testing-library',
    label: '@lynx-js/react/testing-library',
  },
  { type: 'dir', name: 'genui', label: '@lynx-js/genui' },
  { type: 'dir', name: 'config', label: 'Build configuration' },
  { type: 'dir', name: 'packages', label: 'All packages' },
];

/** The sections listed by {@link SIDEBAR} instead of by their parent. */
const OWN_SIDEBAR_ENTRY = ['testing-library'];

/** The group TypeDoc puts the `@document` pages of a package in. */
const DOCUMENTS = 'Documents';

type SidebarItem = string | { type?: string; name?: string };

/**
 * Rewrites an entry of a generated sidebar: the index page is the link of the
 * section itself, a section with its own entry is not listed by its parent,
 * and the `@document` pages are listed one by one instead of as a group.
 */
function sidebarItems(item: SidebarItem, dir: string): SidebarItem[] {
  if (typeof item === 'string') return item === 'index' ? [] : [item];
  if (OWN_SIDEBAR_ENTRY.includes(item.name ?? '')) return [];
  if (item.name !== DOCUMENTS) return [item];
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

/** The directories the `member` router writes, in the order they are listed. */
const KINDS: Record<string, string> = {
  classes: 'Classes',
  interfaces: 'Interfaces',
  'type-aliases': 'Type Aliases',
  enumerations: 'Enumerations',
  functions: 'Functions',
  variables: 'Variables',
  namespaces: 'Namespaces',
};

/**
 * Names the directories of a module the way the generated pages read: a
 * subpath keeps its name, a kind gets its plural title.
 */
function writeKindMeta(dir: string): void {
  if (!statSync(dir).isDirectory()) return;
  const names = readdirSync(dir).filter(name =>
    statSync(join(dir, name)).isDirectory()
  );
  if (names.length === 0) return;
  const kinds = Object.keys(KINDS);
  const order = (name: string) =>
    kinds.includes(name) ? kinds.indexOf(name) + 1 : 0;
  writeFileSync(
    join(dir, '_meta.json'),
    `${
      JSON.stringify(
        names
          .sort((a, b) => order(a) - order(b) || a.localeCompare(b))
          .map(name => ({ type: 'dir', name, label: KINDS[name] ?? name })),
        null,
        2,
      )
    }\n`,
  );
  for (const name of names) writeKindMeta(join(dir, name));
}

/** The kinds a page can document, in the order {@link KINDS} lists them. */
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
      config(config) {
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
                writeKindMeta(join(dir, name));
              }
            } else {
              writeKindMeta(dir);
            }
          }
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
        translations.save();
        return config;
      },
    },
  ];
}
