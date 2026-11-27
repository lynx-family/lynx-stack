// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// `node:url` from the npm `url` package (the legacy `parse`, `format` and
// `resolve`), with the members of Node.js 24 that it lacks and that build
// tools use: the WHATWG classes and the file URL conversions.

/// <reference path="./packages.d.ts" />

import npmUrl from 'url/url.js';

function fileURLToPath(url: string | URL): string {
  const parsed = typeof url === 'string' ? new URL(url) : url;
  if (parsed.protocol !== 'file:') {
    throw new TypeError(`The URL must be of scheme file: ${String(url)}`);
  }
  return decodeURIComponent(parsed.pathname);
}

function pathToFileURL(path: string): URL {
  const url = new URL('file://');
  url.pathname = path.split('/').map((segment) => encodeURIComponent(segment))
    .join('/');
  return url;
}

const url = {
  ...npmUrl,
  URL: globalThis.URL,
  URLSearchParams: globalThis.URLSearchParams,
  fileURLToPath,
  pathToFileURL,
};

export const { Url, parse, resolve, resolveObject, format, URLSearchParams } =
  url;
// Not destructured: a `URL` binding would shadow the global in this module.
const WhatwgURL = url.URL;
export { fileURLToPath, pathToFileURL, WhatwgURL as URL };
export default url;
