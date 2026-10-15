// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// @ts-nocheck
/* istanbul ignore file -- stringified into the application runtime */

export default function(): void {
  var bundleName;
  var updates;
  var applying = false;

  // Only HMR loads use this adapter; normal lazy and external loads keep their
  // existing loaders. One section evaluation supplies every chunk in an update.
  __webpack_require__.lynxHMRLoad = function(name, callback) {
    if (name.endsWith('.json')) {
      updates = undefined;
      new Promise(function(resolve) {
        lynx.fetchBundle(name.slice(0, -5) + '.bundle', {}).then(resolve);
      }).then(function(response) {
        if (response.code !== 0) throw new Error(JSON.stringify(response));
        bundleName = response.url;
        return lynx.loadScript('manifest', { bundleName: bundleName });
      }).then(function(manifest) {
        callback(null, manifest);
      }, callback);
    } else {
      try {
        if (!updates) {
          updates = lynx.loadScript('updates', { bundleName: bundleName });
        }
        var filename = name.slice(__webpack_require__.p.length);
        callback(null, updates[filename]);
      } catch (error) {
        callback(error);
      }
    }
  };

  globalThis[$METHOD$] = function(request) {
    var acknowledge = function(ok, error) {
      lynx.getJSContext().dispatchEvent({
        type: $EVENT$,
        data: JSON.stringify({
          session: request.session,
          sequence: request.sequence,
          hash: __webpack_require__.h(),
          ok: ok,
          error: error && String(error),
        }),
      });
    };
    if (applying || request.hash !== __webpack_require__.h()) {
      acknowledge(false, new Error('Main-thread HMR version mismatch'));
      return;
    }
    applying = true;
    Promise.resolve().then(function() {
      return __webpack_require__.c[$HOT_MODULE$].hot.check(true);
    }).then(function(updated) {
      if (updated === null) {
        throw new Error('Main-thread HMR update is missing');
      }
      applying = false;
      acknowledge(true);
    }).catch(function(error) {
      applying = false;
      acknowledge(false, error);
    });
  };
}
