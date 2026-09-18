// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RspressPlugin } from '@rspress/core';
import { pluginTypeDoc } from '@rspress/plugin-typedoc';
import { Reflection, ReflectionKind, RendererEvent } from 'typedoc';
import type { Application } from 'typedoc';
import { MarkdownPageEvent } from 'typedoc-plugin-markdown';

import { withPackageLinks } from './packages.ts';
import { rewritePackageReferences } from './references.ts';
import type { Section } from './sections.ts';
import type { Translations } from './translate.ts';
import { assertNoWarnings } from './warnings.ts';
import type { Locale, WorkspacePackage } from './workspace.ts';

/**
 * Renders a section of the API reference with `@rspress/plugin-typedoc`.
 * Each package is converted with its own `typedoc.json`, falling back to
 * `src/index.ts`.
 */
export function pluginApiSection(
  section: Section,
  locale: Locale,
  packages: WorkspacePackage[],
  translations: Translations,
  extend?: (app: Application) => void,
): RspressPlugin {
  const name = `${locale}/${section.out}`;
  const byName = new Map(packages.map(pkg => [pkg.name, pkg]));
  let typedoc: Application | undefined;
  const plugin = pluginTypeDoc({
    entryPoints: section.packages,
    outDir: name,
    setup(app) {
      typedoc = app;
      app.options.setValue('entryPointStrategy', 'packages');
      app.options.setValue('packageOptions', {
        entryPoints: ['src/index.ts'],
        excludePrivate: true,
        excludeProtected: true,
        excludeInternal: true,
        skipErrorChecking: true,
        readme: 'none',
      });
      if (section.name) app.options.setValue('name', section.name);
      app.options.setValue('router', section.router);
      // A package page nests group > member > section > property, which is one
      // level deeper than the page outline of Rspress shows.
      if (section.router === 'module') {
        app.options.setValue('hideGroupHeadings', true);
      }
      app.options.setValue('fileExtension', '.mdx');
      app.options.setValue('sanitizeComments', true);
      app.options.setValue('disableSources', false);
      app.options.setValue('useCodeBlocks', true);
      app.options.setValue('expandParameters', true);
      app.options.setValue('parametersFormat', 'table');
      app.options.setValue('excludeScopesInPaths', true);
      if (section.flatten) app.options.setValue('flattenOutputFiles', true);
      if (section.readme) {
        app.options.setValue('readme', section.readme);
        app.options.setValue('mergeReadme', true);
      }
      app.options.setValue('lang', locale);
      app.internationalization.setLocale(locale);
      rewritePackageReferences(app);
      app.renderer.on(RendererEvent.BEGIN, (event: RendererEvent) => {
        app.validate(event.project);
      });
      app.renderer.on(MarkdownPageEvent.END, page => {
        const { model } = page;
        let contents = page.contents ?? '';
        const pkg = byName.get(model.name);
        if (
          pkg && model instanceof Reflection
          && (model.kindOf(ReflectionKind.Module)
            || (model.kindOf(ReflectionKind.Project)
              && page.url === 'index.mdx'))
        ) {
          contents = withPackageLinks(contents, pkg);
        }
        page.contents = translations.translate(contents, locale);
      });
      extend?.(app);
    },
  });
  return {
    ...plugin,
    name: `lynx:api-reference:${name}`,
    async config(config, utils, isProd) {
      const result = await plugin.config!(config, utils, isProd);
      assertNoWarnings(typedoc!, name);
      return result;
    },
  };
}
