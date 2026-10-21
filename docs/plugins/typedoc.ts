// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RspressPlugin } from '@rspress/core';
import { pluginTypeDoc } from '@rspress/plugin-typedoc';
import {
  Converter,
  Reflection,
  ReflectionKind,
  RendererEvent,
  UnknownType,
} from 'typedoc';
import type {
  Application,
  Context,
  DeclarationReflection,
  ParameterReflection,
  SignatureReflection,
} from 'typedoc';
import { MarkdownPageEvent } from 'typedoc-plugin-markdown';
import ts from 'typescript';

import { escapeEsmLines } from './mdx.ts';
import { withPackageLinks } from './packages.ts';
import { rewritePackageReferences } from './references.ts';
import type { Section } from './sections.ts';
import type { Site } from './site.ts';
import { hidePlatformTags } from './tags.ts';
import type { Translations } from './translate.ts';
import { assertNoWarnings } from './warnings.ts';
import { generatedPackageNames } from './workspace.ts';
import type { Locale, WorkspacePackage } from './workspace.ts';
import { renameWrappedPackages } from './wrappers.ts';

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
  site: Site,
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
        excludeProtected: true,
        excludeInternal: true,
        skipErrorChecking: false,
        readme: 'none',
      });
      if (section.name) app.options.setValue('name', section.name);
      app.options.setValue('router', section.router);
      app.options.setValue('fileExtension', '.mdx');
      app.options.setValue('sanitizeComments', true);
      app.options.setValue('expandParameters', true);
      app.options.setValue('parametersFormat', 'table');
      app.options.setValue('excludeScopesInPaths', true);
      if (section.readme) {
        app.options.setValue('readme', section.readme);
        app.options.setValue('mergeReadme', true);
      }
      app.options.setValue('lang', locale);
      app.internationalization.setLocale(locale);
      const generated = generatedPackageNames(site);
      const hidden = new Set(
        packages.filter(pkg =>
          !generated.has(pkg.name) && !(pkg.name in site.ownSections)
        ).map(pkg => pkg.name),
      );
      rewritePackageReferences(
        app,
        section.out === 'api/packages' ? hidden : undefined,
      );
      // Resolve after conversion, when declaration and signature types are assigned.
      const pending: (() => void)[] = [];
      const preserve = (
        context: Context,
        reflection:
          | DeclarationReflection
          | SignatureReflection
          | ParameterReflection,
        node: ts.Node | undefined,
      ) => {
        if (!node || !('type' in node) || !node.type) return;
        const annotation = node.type as ts.TypeNode;
        pending.push(() => {
          if (
            annotation.kind === ts.SyntaxKind.AnyKeyword
            || reflection.type?.type !== 'intrinsic'
            || reflection.type.name !== 'any'
          ) return;
          let unavailable = false;
          const visit = (part: ts.Node) => {
            if (ts.isIdentifier(part)) {
              for (
                let decl of context.getSymbolAtLocation(part)?.declarations
                  ?? []
              ) {
                while (decl.parent && !ts.isImportDeclaration(decl)) {
                  decl = decl.parent as ts.Declaration;
                }
                if (
                  ts.isImportDeclaration(decl)
                  && ts.isStringLiteral(decl.moduleSpecifier)
                  && hidden.has(decl.moduleSpecifier.text)
                ) unavailable = true;
              }
            }
            ts.forEachChild(part, visit);
          };
          visit(annotation);
          if (unavailable) {
            reflection.type = new UnknownType(annotation.getText());
          }
        });
      };
      app.converter.on(
        Converter.EVENT_CREATE_DECLARATION,
        (context, reflection) =>
          preserve(
            context,
            reflection,
            context.getSymbolFromReflection(reflection)?.declarations?.[0],
          ),
      );
      app.converter.on(Converter.EVENT_CREATE_SIGNATURE, preserve);
      app.converter.on(Converter.EVENT_CREATE_PARAMETER, preserve);
      app.converter.on(Converter.EVENT_RESOLVE_BEGIN, () => {
        for (const apply of pending) apply();
        pending.length = 0;
      });
      hidePlatformTags(app);
      if (site.wrappers) renameWrappedPackages(app, site.wrappers);
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
          contents = withPackageLinks(contents, pkg, site);
        }
        page.contents = escapeEsmLines(
          translations.translate(contents, locale),
        );
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
