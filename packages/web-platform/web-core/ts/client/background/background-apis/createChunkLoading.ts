// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  NativeApp,
  BTSChunkEntry,
  BundleInitReturnObj,
} from '../../../types/index.js';

function createExecutionGlobal(sourceURL: string): typeof globalThis {
  // Bundled runtimes use the worker's location to resolve `publicPath: 'auto'`.
  // Keep all other global operations on the real worker global.
  const sourceLocation = new URL(sourceURL, globalThis.location.href);
  const callableCache = new WeakMap<Function, Function>();
  let executionGlobal: typeof globalThis;
  executionGlobal = new Proxy(globalThis, {
    get(target, property, receiver) {
      if (property === 'location') {
        return sourceLocation;
      }
      if (property === 'globalThis' || property === 'self') {
        return receiver;
      }
      const value = Reflect.get(target, property, target);
      if (typeof value !== 'function') {
        return value;
      }

      let callable = callableCache.get(value);
      if (callable === undefined) {
        const wrapped = new Proxy(value, {
          apply(targetFunction, thisArgument, argumentsList) {
            return Reflect.apply(
              targetFunction,
              thisArgument === executionGlobal ? target : thisArgument,
              argumentsList,
            );
          },
        });
        callableCache.set(value, wrapped);
        callable = wrapped;
      }
      return callable;
    },
  });
  return executionGlobal;
}

export function createChunkLoading(
  entryTemplateUrl: string,
  cardType: string,
): {
  readScript: NativeApp['readScript'];
  loadScript: NativeApp['loadScript'];
  loadScriptAsync: NativeApp['loadScriptAsync'];
  templateCache: Map<string, Record<string, string>>;
} {
  const templateCache = new Map<string, Record<string, string>>();
  const resolveTemplateURL = (templateURL?: string) =>
    !templateURL || templateURL === '__Card__'
      ? entryTemplateUrl
      : templateURL;
  const readScript: NativeApp['readScript'] = (
    sourceURL,
    templateUrl,
  ) => {
    const resolvedTemplateURL = resolveTemplateURL(templateUrl);
    const finalSourceURL = templateCache.get(resolvedTemplateURL)
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
    const resolvedTemplateURL = resolveTemplateURL(templateUrl);
    const finalSourceURL = templateCache.get(resolvedTemplateURL)
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
    executionSourceURL: string,
  ): BundleInitReturnObj => {
    const paramNames: string[] = [
      'postMessage',
      'module',
      'exports',
      'lynxCoreInject',
      ...(cardType !== 'react' ? ['Card'] : []),
      'setTimeout',
      'setInterval',
      'clearInterval',
      'clearTimeout',
      'NativeModules',
      ...(cardType !== 'react' ? ['Component'] : []),
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
      // 'fetch',
      // 'XMLHttpRequest',
      'webkit',
      'Reporter',
      'print',
      'global',
      // Lynx API
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'globalThis',
    ];
    const foo = new Function(
      ...paramNames,
      jsContent,
    ) as BTSChunkEntry;
    return {
      init(lynxCoreInject) {
        const module = { exports: {} };
        const tt = lynxCoreInject.tt as any;
        const args: unknown[] = [
          undefined,
          module,
          module.exports,
          lynxCoreInject,
          ...(cardType !== 'react' ? [tt.Card.bind(tt)] : []),
          tt.setTimeout,
          tt.setInterval,
          tt.clearInterval,
          tt.clearTimeout,
          tt.NativeModules,
          ...(cardType !== 'react' ? [tt.Component.bind(tt)] : []),
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
          // tt.fetch,
          // tt.XMLHttpRequest,
          tt.webkit,
          tt.Reporter,
          tt.print,
          tt.global,
          tt.requestAnimationFrame,
          tt.cancelAnimationFrame,
          createExecutionGlobal(executionSourceURL),
        ];
        (foo as Function).apply(undefined, args);
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
        resolveTemplateURL(templateUrl),
      );
    },
    loadScriptAsync: async (sourceURL, callback, templateUrl: string) => {
      readScriptAsync(sourceURL, templateUrl).then((jsContent) => {
        callback(
          null,
          createBundleInitReturnObj(
            jsContent,
            resolveTemplateURL(templateUrl),
          ),
        );
      });
    },
    templateCache,
  };
}
