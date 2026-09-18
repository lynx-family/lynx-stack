// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

/**
 * Rewrites an entry of a generated sidebar: the index page is the link of the
 * section itself, a section with its own entry is not listed by its parent,
 * and the `@document` pages are listed one by one instead of as a group.
 */
function sidebarItems(
  item: string | { name?: string },
  dir: string,
): (string | { type: string; name: string })[] {
  if (typeof item === 'string') return item === 'index' ? [] : [item];
  if (OWN_SIDEBAR_ENTRY.includes(item.name ?? '')) return [];
  if (item.name !== DOCUMENTS) return [item as { type: string; name: string }];
  return readdirSync(join(dir, DOCUMENTS)).sort().map(file => ({
    type: 'file',
    name: `${DOCUMENTS}/${basename(file, extname(file))}`,
  }));
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
            const meta = join(CONTENT, locale, section.out, '_meta.json');
            if (section.router === 'module' && section.out !== 'api/packages') {
              rmSync(meta);
            } else if (section.router === 'group') {
              const items = JSON.parse(readFileSync(meta, 'utf8')) as (
                | string
                | { name?: string }
              )[];
              writeFileSync(
                meta,
                `${
                  JSON.stringify(
                    items.flatMap(item =>
                      sidebarItems(item, join(CONTENT, locale, section.out))
                    ),
                    null,
                    2,
                  )
                }\n`,
              );
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
