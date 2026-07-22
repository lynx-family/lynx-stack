// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export function createLepusCodeBlob(
  code: string | Uint8Array,
  sourceURL: string,
  isLazy: boolean,
  isExternalBundle: boolean,
): Blob {
  const prefix = isExternalBundle
    ? 'var exports=(module.exports={}); '
    : isLazy && code.length > 0
    ? 'module.exports='
    : '';
  return new Blob([
    '//# allFunctionsCalledOnLoad\n(function(){ "use strict"; const navigator=void 0,postMessage=void 0,window=void 0; ',
    prefix,
    code as BlobPart,
    ` \n })()\n//# sourceURL=${sourceURL}\n`,
  ], {
    type: 'text/javascript; charset=utf-8',
  });
}
