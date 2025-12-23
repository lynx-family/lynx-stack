// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  NativeApp,
  BTSChunkEntry,
  BundleInitReturnObj,
} from '../../../types/index.js';

export function createChunkLoading(entryTemplateUrl: string): {
  readScript: NativeApp['readScript'];
  loadScript: NativeApp['loadScript'];
  loadScriptAsync: NativeApp['loadScriptAsync'];
  templateCache: Map<string, Record<string, string>>;
} {
  const templateCache = new Map<string, Record<string, string>>();
  const readScript: NativeApp['readScript'] = (
    sourceURL,
    templateUrl,
  ) => {
    if (!templateUrl || templateUrl === '__Card__') {
      templateUrl = entryTemplateUrl;
    }
    const finalSourceURL = templateCache.get(templateUrl!)
      ?.[`/${sourceURL}`] ?? sourceURL;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', finalSourceURL, false);
    xhr.send(null);
    if (xhr.status === 200) {
      return xhr.responseText;
    }
    throw new Error(`Failed to load ${sourceURL}, status: ${xhr.status}`);
  };

  const readScriptAsync: (
    sourceURL: string,
    templateUrl: string,
  ) => Promise<string> = async (sourceURL, templateUrl) => {
    if (!templateUrl || templateUrl === '__Card__') {
      templateUrl = entryTemplateUrl;
    }
    const finalSourceURL = templateCache.get(templateUrl!)
      ?.[`/${sourceURL}`] ?? sourceURL;
    return new Promise((resolve, reject) => {
      fetch(finalSourceURL).then((response) => {
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
      jsContent,
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
          tt.Card.bind(tt),
          tt.setTimeout,
          tt.setInterval,
          tt.clearInterval,
          tt.clearTimeout,
          tt.NativeModules,
          tt.Component.bind(tt),
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
    loadScript: (sourceURL, templateUrl) => {
      const jsContent = readScript(sourceURL, templateUrl);
      return createBundleInitReturnObj(
        jsContent,
      );
    },
    loadScriptAsync: async (sourceURL, callback, templateUrl: string) => {
      readScriptAsync(sourceURL, templateUrl).then((jsContent) => {
        callback(
          null,
          createBundleInitReturnObj(
            jsContent,
          ),
        );
      });
    },
    templateCache,
  };
}
