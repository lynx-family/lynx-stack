// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  NativeApp,
  LynxTemplate,
  BTSChunkEntry,
  BundleInitReturnObj,
} from '@lynx-js/web-constants';

export function createChunkLoading(initialTemplate: LynxTemplate): {
  readScript: NativeApp['readScript'];
  loadScript: NativeApp['loadScript'];
  loadScriptAsync: NativeApp['loadScriptAsync'];
  templateCache: Map<string, LynxTemplate>;
} {
  const templateCache = new Map<string, LynxTemplate>([[
    '__Card__',
    initialTemplate,
  ]]);
  const readScript: NativeApp['readScript'] = (
    sourceURL,
    entryName = '__Card__',
  ) => {
    const jsContentInTemplate = templateCache.get(entryName!)
      ?.manifest[`/${sourceURL}`];
    if (jsContentInTemplate) return jsContentInTemplate;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', sourceURL, false);
    xhr.send(null);
    if (xhr.status === 200) {
      return xhr.responseText;
    }
    throw new Error(`Failed to load ${sourceURL}, status: ${xhr.status}`);
  };

  const readScriptAsync: (
    sourceURL: string,
    entryName: string | undefined,
  ) => Promise<string> = async (sourceURL, entryName = '__Card__') => {
    const jsContentInTemplate = templateCache.get(entryName!)
      ?.manifest[`/${sourceURL}`];
    if (jsContentInTemplate) return jsContentInTemplate;
    return new Promise((resolve, reject) => {
      fetch(sourceURL).then((response) => {
        if (response.ok) {
          response.text().then((text) => resolve(text), reject);
        } else {
          reject(
            new Error(
              `Failed to load ${sourceURL}, status: ${response.status}`,
            ),
          );
        }
      }, reject);
    });
  };
  const createBundleInitReturnObj = (
    jsContent: string,
    fileName: string,
  ): BundleInitReturnObj => {
    const foo = new Function(
      'postMessage',
      'module',
      'exports',
      'lynxCoreInject',
      'Card',
      'setTimeout',
      'setInterval',
      'clearInterval',
      'clearTimeout',
      'NativeModules',
      'Component',
      'ReactLynx',
      'nativeAppId',
      'Behavior',
      'LynxJSBI',
      'lynx',
      // BOM API
      'window',
      'document',
      'frames',
      'location',
      'navigator',
      'localStorage',
      'history',
      'Caches',
      'screen',
      'alert',
      'confirm',
      'prompt',
      'fetch',
      'XMLHttpRequest',
      'webkit',
      'Reporter',
      'print',
      'global',
      // Lynx API
      'requestAnimationFrame',
      'cancelAnimationFrame',
      [
        jsContent,
        '\n//# sourceURL=',
        fileName,
      ].join(''),
    ) as BTSChunkEntry;
    return {
      init(lynxCoreInject) {
        const module = { exports: {} };
        const tt = lynxCoreInject.tt as any;
        foo(
          undefined,
          module,
          module.exports,
          lynxCoreInject,
          tt.Card,
          tt.setTimeout,
          tt.setInterval,
          tt.clearInterval,
          tt.clearTimeout,
          tt.NativeModules,
          tt.Component,
          tt.ReactLynx,
          tt.nativeAppId,
          tt.Behavior,
          tt.LynxJSBI,
          tt.lynx,
          // BOM API
          tt.window,
          tt.document,
          tt.frames,
          tt.location,
          tt.navigator,
          tt.localStorage,
          tt.history,
          tt.Caches,
          tt.screen,
          tt.alert,
          tt.confirm,
          tt.prompt,
          tt.fetch,
          tt.XMLHttpRequest,
          tt.webkit,
          tt.Reporter,
          tt.print,
          tt.global,
          tt.requestAnimationFrame,
          tt.cancelAnimationFrame,
        );
        return module.exports;
      },
    };
  };
  return {
    readScript,
    loadScript: (sourceURL, entryName = '__Card__') => {
      const jsContent = readScript(sourceURL, entryName);
      return createBundleInitReturnObj(
        jsContent,
        `${encodeURIComponent(entryName)}/${sourceURL}`,
      );
    },
    loadScriptAsync: async (sourceURL, callback, entryName = '__Card__') => {
      readScriptAsync(sourceURL, entryName).then((jsContent) => {
        callback(
          null,
          createBundleInitReturnObj(
            jsContent,
            `${encodeURIComponent(entryName)}/${sourceURL}`,
          ),
        );
      });
    },
    templateCache,
  };
}
