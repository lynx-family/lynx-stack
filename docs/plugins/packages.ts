// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { existsSync, rmSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import type { RspressPlugin } from '@rspress/core';

import { contentDir } from './site.ts';
import type { Site } from './site.ts';
import type { Translations } from './translate.ts';
import { LOCALES, hasEntryPoint, json, write } from './workspace.ts';
import type { Locale, WorkspacePackage } from './workspace.ts';

/**
 * The route of a package under `/api`: the section of its own when it has
 * one, `packages/<name without scope>` otherwise.
 */
function packageRoute(pkg: WorkspacePackage, site: Site): string {
  const own = site.ownSections[pkg.name];
  if (own) return `${own}/`;
  return `packages/${pkg.name.replace(/^@[^/]+\//, '')}`;
}

/**
 * The registry, source and changelog links shown under the title of a package.
 */
function packageLinks(pkg: WorkspacePackage, site: Site): string {
  const dir = relative(site.root, pkg.dir).replaceAll(sep, '/');
  const { repository, branch } = site;
  const links = [
    `[npm](${site.packagePage(pkg.name)})`,
    `[Source](${repository}/tree/${branch}/${dir})`,
  ];
  if (existsSync(join(pkg.dir, 'CHANGELOG.md'))) {
    links.push(`[Changelog](${repository}/blob/${branch}/${dir}/CHANGELOG.md)`);
  }
  return links.join(' · ');
}

/**
 * Inserts {@link packageLinks} under the first heading of a page.
 */
export function withPackageLinks(
  markdown: string,
  pkg: WorkspacePackage,
  site: Site,
): string {
  return markdown.replace(
    /^# .*\n/m,
    heading => `${heading}\n${packageLinks(pkg, site)}\n`,
  );
}

/** The group a package is listed under, for every public package. */
export function packageGroups(
  packages: WorkspacePackage[],
  site: Site,
): { name: string; route: string; group: string }[] {
  return packages.map(pkg => ({
    name: pkg.name,
    route: `api/${packageRoute(pkg, site).replace(/\/$/, '')}`,
    group: groupOf(pkg, site),
  }));
}

function groupOf(pkg: WorkspacePackage, site: Site): string {
  const dir = relative(site.root, pkg.dir).replaceAll(sep, '/');
  return site.groups.find(group =>
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
  site: Site,
): RspressPlugin {
  return {
    name: 'lynx:api-reference-packages',
    config(config) {
      for (const locale of LOCALES) {
        writePackagePages(packages, locale, translations, site);
      }
      return config;
    },
  };
}

function writePackagePages(
  packages: WorkspacePackage[],
  locale: Locale,
  translations: Translations,
  site: Site,
): void {
  const content = contentDir(site);
  const out = join(content, locale, 'api/packages');
  const text = (en: string) => translations.translate(en, locale);

  for (const pkg of packages) {
    if (pkg.name in site.ownSections) continue;
    if (hasEntryPoint(pkg.dir)) continue;
    const page = [`# ${pkg.name}`, '', packageLinks(pkg, site), ''];
    if (pkg.description) page.push(pkg.description, '');
    write(
      join(content, locale, 'api', `${packageRoute(pkg, site)}.mdx`),
      text(page.join('\n')),
    );
  }

  // The index TypeDoc writes lists every package; the sidebar does that.
  rmSync(join(out, 'index.mdx'));

  const groups = site.groups.map(group => ({
    name: text(group.name),
    packages: packages.filter(pkg => groupOf(pkg, site) === group.name),
  }));

  write(
    join(out, '_meta.json'),
    json([
      ...groups.flatMap(group => [
        { type: 'section-header', label: group.name },
        ...group.packages
          .filter(pkg => packageRoute(pkg, site).startsWith('packages/'))
          .map(pkg => {
            const name = packageRoute(pkg, site).slice('packages/'.length);
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
