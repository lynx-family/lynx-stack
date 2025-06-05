// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { glob } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@lynx-js/rspeedy';
import { commonConfig } from './commonConfig.js';
import { Compilation, Compiler } from '@rspack/core';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const reactBasicCases = await Array.fromAsync(
  glob(path.join(__dirname, 'i18n-*', '*.jsx')),
);

export default defineConfig({
  ...commonConfig(),
  source: {
    entry: Object.fromEntries(reactBasicCases.map((reactBasicEntry) => {
      return [path.basename(path.dirname(reactBasicEntry)), reactBasicEntry];
    })),
    define: {
      __I18N__NEXT: JSON.stringify(true),
    },
  },
  tools: {
    rspack: (config, { appendPlugins }) => {
      appendPlugins([new I18nPlugin()]);
    },
  },
});

const replaceGlobalThis = (code: string): string => {
  const i18nUseFallbackNextRegExp = /globalThis.__I18N__USE__FALLBACK__NEXT/g;
  const i18nFallbackResourceNextRegExp =
    /globalThis.__I18N__FALLBACK__RESOURCE__NEXT/g;
  const i18nNextLepusRegExp = /globalThis.__I18N__NEXT__LEPUS/g;
  const i18nResources = /globalThis.__I18N__RESOURCES/g;
  const i18nLocale = /globalThis.__I18N__LOCALE/g;
  return code
    .replace(
      i18nUseFallbackNextRegExp,
      (word, prop) => '__I18N__USE__FALLBACK__NEXT',
    )
    .replace(
      i18nFallbackResourceNextRegExp,
      (word, prop) => '__I18N__FALLBACK__RESOURCE__NEXT',
    )
    .replace(i18nNextLepusRegExp, (word, prop) => '__I18N__NEXT__LEPUS')
    .replace(i18nResources, (word, prop) => '__I18N__RESOURCES')
    .replace(i18nLocale, (word, prop) => '__I18N__LOCALE');
};

class I18nPlugin {
  pluginName = 'I18nPlugin';

  apply(compiler: Compiler): void {
    const {
      sources: { RawSource }, // 获取类
    } = compiler.webpack;

    compiler.hooks.compilation.tap(
      this.pluginName,
      (compilation: Compilation) => {
        compilation.hooks.processAssets.tapPromise({
          name: this.pluginName,
          // Use a stage like ADDITIONAL_ASSETS to run after initial assets are generated
          stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        }, async (assets) => {
          for (const assetName in assets) {
            const isAppService = /(background(\.[a-zA-Z0-9]+)?\.js)$/.test(
              assetName,
            );
            const isLepus = /(main-thread(\.[a-zA-Z0-9]+)?\.js)$/.test(
              assetName,
            );
            let initCode = isLepus
              ? 'let __I18N__NEXT__LEPUS = true; let __I18N__LOCALE = ""; let __I18N__RESOURCES = {};'
              : 'var __I18N__NEXT__LEPUS = false; var __I18N__LOCALE = ""; var __I18N__RESOURCES = {};';
            const def = isLepus ? 'let' : 'var';
            const source = compilation.getAsset(assetName);
            const content = source.source.source().toString(); // Get asset content as string
            let finalContent = content;

            initCode =
              `${initCode} ${def} __I18N__USE__FALLBACK__NEXT = false; ${def} __I18N__FALLBACK__RESOURCE__NEXT = {};`;
            finalContent = replaceGlobalThis(`${initCode}${content}`);
            compilation.updateAsset(assetName, new RawSource(finalContent));
          }
        });
      },
    );
  }
}
