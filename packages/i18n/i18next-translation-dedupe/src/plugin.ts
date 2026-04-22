// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { getI18nextExtractorWebpackPluginHooks } from 'rsbuild-plugin-i18next-extractor';
import type { AfterExtractPayload } from 'rsbuild-plugin-i18next-extractor';

import type { RsbuildPlugin, Rspack } from '@lynx-js/rspeedy';
import type {
  LynxTemplatePlugin as LynxTemplatePluginClass,
  TemplateHooks,
} from '@lynx-js/template-webpack-plugin';

import { I18N_TRANSLATIONS_SECTION_KEY } from './constants.js';

type I18nExtractionStore = Map<
  string,
  AfterExtractPayload['extractedTranslationsByLocale']
>;

type BeforeEncodeArgs = Parameters<
  Parameters<TemplateHooks['beforeEncode']['tapPromise']>[1]
>[0];

interface LynxTemplatePluginExposure {
  LynxTemplatePlugin: {
    getLynxTemplatePluginHooks:
      typeof LynxTemplatePluginClass.getLynxTemplatePluginHooks;
  };
}

class LynxI18nextExtractorHooksWebpackPlugin {
  constructor(private readonly store: I18nExtractionStore) {}

  apply(compiler: Rspack.Compiler) {
    compiler.hooks.compilation.tap(
      'LynxI18nextExtractorHooksWebpackPlugin',
      (compilation) => {
        this.store.clear();

        const hooks = getI18nextExtractorWebpackPluginHooks(compilation);

        hooks.afterExtract.tap(
          'LynxI18nextExtractorHooksWebpackPlugin',
          (payload) => {
            this.store.set(
              payload.entryName,
              payload.extractedTranslationsByLocale,
            );

            return payload;
          },
        );

        hooks.renderExtractedTranslations.tapPromise(
          'LynxI18nextExtractorHooksWebpackPlugin',
          async (payload) => ({
            ...payload,
            code: '',
            skip: true,
          }),
        );
      },
    );
  }
}

class LynxI18nextTranslationDedupeWebpackPlugin {
  constructor(
    private readonly store: I18nExtractionStore,
    private readonly lynxTemplatePlugin:
      LynxTemplatePluginExposure['LynxTemplatePlugin'],
  ) {}

  apply(compiler: Rspack.Compiler) {
    compiler.hooks.compilation.tap(
      'LynxI18nextTranslationDedupeWebpackPlugin',
      (compilation) => {
        const hooks = this.lynxTemplatePlugin.getLynxTemplatePluginHooks(
          compilation as unknown as Parameters<
            LynxTemplatePluginExposure['LynxTemplatePlugin'][
              'getLynxTemplatePluginHooks'
            ]
          >[0],
        );

        hooks.beforeEncode.tap(
          'LynxI18nextTranslationDedupeWebpackPlugin',
          (args: BeforeEncodeArgs) => {
            const entryName = args.entryNames[0];

            if (!entryName) {
              return args;
            }

            const translationsByLocale = this.store.get(entryName);

            if (!translationsByLocale) {
              return args;
            }

            args.encodeData.customSections[I18N_TRANSLATIONS_SECTION_KEY] = {
              content: translationsByLocale,
            };

            return args;
          },
        );
      },
    );
  }
}

export function pluginLynxI18nextTranslationDedupe(): RsbuildPlugin {
  return {
    name: 'lynx:i18next-translation-dedupe',
    pre: ['lynx:react', 'rsbuild:i18next-extractor'],
    setup(api) {
      const store: I18nExtractionStore = new Map();
      const templatePluginExposure = api.useExposed<LynxTemplatePluginExposure>(
        Symbol.for('LynxTemplatePlugin'),
      );

      if (!templatePluginExposure) {
        return;
      }

      const { LynxTemplatePlugin } = templatePluginExposure;

      api.modifyBundlerChain((chain) => {
        chain
          .plugin('lynx:i18next-extractor-hooks')
          .use(LynxI18nextExtractorHooksWebpackPlugin, [store]);

        chain
          .plugin('lynx:i18next-translation-dedupe')
          .use(LynxI18nextTranslationDedupeWebpackPlugin, [
            store,
            LynxTemplatePlugin,
          ]);
      });
    },
  } as RsbuildPlugin;
}
