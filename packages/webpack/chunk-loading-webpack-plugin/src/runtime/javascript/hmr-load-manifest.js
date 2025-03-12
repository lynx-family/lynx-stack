/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
// @ts-nocheck

export default function() {
  $RuntimeGlobals_hmrDownloadManifest$ = function() {
    if (globalThis.__QueryComponent) {
      return new Promise((resolve, reject) => {
        globalThis.__QueryComponent(
          $RuntimeGlobals_publicPath$
            + $RuntimeGlobals_getUpdateManifestFilename$() + '.template.js',
          (ret) => {
            const {
              code,
              data,
            } = ret;

            if (code === 0) {
              const evalResult = data.evalResult;

              if (typeof evalResult === 'function') {
                const manifest = evalResult();
                resolve(manifest);
              } else {
                reject(
                  new Error(
                    'Failed to get mainThread exports. evalResult is not a function.',
                  ),
                );
              }
            }
            reject(
              new Error(
                'Failed to get mainThread exports. ret: ' + JSON.stringify(ret),
              ),
            );
          },
        );
      });
    }
    return new Promise((resolve, reject) =>
      lynx.requireModuleAsync(
        $RuntimeGlobals_publicPath$
          + $RuntimeGlobals_getUpdateManifestFilename$(),
        (err, ret) => {
          if (err) return reject(err);
          resolve(ret);
        },
      )
    )['catch'](function(err) {
      if (err.code !== 'MODULE_NOT_FOUND') throw err;
    });
  };
}
