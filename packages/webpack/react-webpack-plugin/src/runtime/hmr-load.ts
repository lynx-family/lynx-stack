// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// @ts-nocheck
/* istanbul ignore file -- stringified into the application runtime */

export default function(): void {
  if (
    typeof lynx.fetchBundle !== 'function'
    || typeof lynx.loadScript !== 'function'
  ) return;

  var bundleName;
  $RuntimeGlobals_lynxHMRLoad$ = function(name, callback) {
    if (name.endsWith('.json')) {
      // Native ResponseHandler is a thenable, not a chainable Promise.
      new Promise(function(resolve, reject) {
        lynx.fetchBundle(name.slice(0, -5) + '.bundle', {}).then(
          resolve,
          reject,
        );
      }).then(function(response) {
        if (response.code !== 0) throw new Error(JSON.stringify(response));
        bundleName = response.url;
        return lynx.loadScript('manifest', { bundleName: bundleName });
      }).then(function(manifest) {
        // Early BTS hosts expose loadScript but return the wrapper instead of
        // initializing its app scope. Probe that contract before applying code.
        if ($BACKGROUND$ && typeof manifest.init === 'function') {
          $RuntimeGlobals_lynxHMRLoad$ = undefined;
          return new Promise(function(resolve, reject) {
            lynx.requireModuleAsync(name, function(error, result) {
              if (error) reject(error);
              else resolve(result);
            });
          });
        }
        return manifest;
      }).then(function(manifest) {
        callback(null, manifest);
      }, callback);
    } else {
      try {
        var filename = name.slice(__webpack_require__.p.length);
        callback(null, lynx.loadScript(filename, { bundleName: bundleName }));
      } catch (error) {
        callback(error);
      }
    }
  };
}
