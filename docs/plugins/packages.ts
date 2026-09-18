// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { existsSync, rmSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import type { RspressPlugin } from '@rspress/core';

import type { Translations } from './translate.ts';
import {
  CONTENT,
  LOCALES,
  ROOT,
  hasEntryPoint,
  json,
  write,
} from './workspace.ts';
import type { Locale, WorkspacePackage } from './workspace.ts';

const REPOSITORY = 'https://github.com/lynx-family/lynx-stack';

const GROUPS = [
  { name: 'Build tools', dirs: ['packages/rspeedy/', 'packages/webpack/'] },
  { name: 'Web platform', dirs: ['packages/web-platform/'] },
  { name: 'Libraries and tools', dirs: [''] },
];

/**
 * The route of a package under `/api`: its own section for `@lynx-js/react`
 * and `@lynx-js/genui`, `packages/<name without scope>` otherwise.
 */
function packageRoute(pkg: WorkspacePackage): string {
  if (pkg.name === '@lynx-js/react' || pkg.name === '@lynx-js/genui') {
    return `${pkg.name.slice('@lynx-js/'.length)}/`;
  }
  return `packages/${pkg.name.replace(/^@[^/]+\//, '')}`;
}

/**
 * The npm, source and changelog links shown under the title of a package.
 */
function packageLinks(pkg: WorkspacePackage): string {
  const dir = relative(ROOT, pkg.dir).replaceAll(sep, '/');
  const links = [
    `[npm](https://www.npmjs.com/package/${pkg.name})`,
    `[Source](${REPOSITORY}/tree/main/${dir})`,
  ];
  if (existsSync(join(pkg.dir, 'CHANGELOG.md'))) {
    links.push(`[Changelog](${REPOSITORY}/blob/main/${dir}/CHANGELOG.md)`);
  }
  return links.join(' · ');
}

/**
 * Inserts {@link packageLinks} under the first heading of a page.
 */
export function withPackageLinks(
  markdown: string,
  pkg: WorkspacePackage,
): string {
  return markdown.replace(
    /^# .*\n/m,
    heading => `${heading}\n${packageLinks(pkg)}\n`,
  );
}

function groupOf(pkg: WorkspacePackage): string {
  const dir = relative(ROOT, pkg.dir).replaceAll(sep, '/');
  return GROUPS.find(group =>
    group.dirs.some(prefix => dir.startsWith(prefix))
  )!
    .name;
}

/**
 * Writes what TypeDoc does not render for the packages: a page for every
 * package without an API, the overview at `/api/packages/` and its sidebar.
 */
export function pluginPackagePages(
  packages: WorkspacePackage[],
  translations: Translations,
): RspressPlugin {
  return {
    name: 'lynx:api-reference-packages',
    config(config) {
      for (const locale of LOCALES) {
        writePackagePages(packages, locale, translations);
      }
      return config;
    },
  };
}

function writePackagePages(
  packages: WorkspacePackage[],
  locale: Locale,
  translations: Translations,
): void {
  const out = join(CONTENT, locale, 'api/packages');
  const text = (en: string) => translations.translate(en, locale);

  for (const pkg of packages) {
    if (pkg.name === '@lynx-js/react' || pkg.name === '@lynx-js/genui') {
      continue;
    }
    if (hasEntryPoint(pkg.dir)) continue;
    const page = [`# ${pkg.name}`, '', packageLinks(pkg), ''];
    if (pkg.description) page.push(pkg.description, '');
    write(
      join(CONTENT, locale, 'api', `${packageRoute(pkg)}.mdx`),
      text(page.join('\n')),
    );
  }

  // The index TypeDoc writes lists every package; the sidebar does that.
  rmSync(join(out, 'index.mdx'));

  const groups = GROUPS.map(group => ({
    name: text(group.name),
    packages: packages.filter(pkg => groupOf(pkg) === group.name),
  }));

  write(
    join(out, '_meta.json'),
    json([
      ...groups.flatMap(group => [
        { type: 'section-header', label: group.name },
        ...group.packages
          .filter(pkg => packageRoute(pkg).startsWith('packages/'))
          .map(pkg => {
            const name = packageRoute(pkg).slice('packages/'.length);
            const dir = existsSync(join(out, name));
            return {
              type: dir ? 'dir' : 'file',
              name,
              label: pkg.name,
              ...dir ? { collapsible: true, collapsed: true } : {},
            };
          }),
      ]),
    ]),
  );
}
