// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

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
  URL: globalThis.URL,
  URLSearchParams: globalThis.URLSearchParams,
  fileURLToPath,
  pathToFileURL,
  format: (input: unknown) => String(input),
  parse: (input: string) => new URL(input, 'file:///'),
};

export const { URL, URLSearchParams, format, parse } = url;
export { fileURLToPath, pathToFileURL };
export default url;
