// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

function fileURLToPath(url) {
  const parsed = typeof url === 'string' ? new URL(url) : url;
  if (parsed.protocol !== 'file:') {
    throw new TypeError(`The URL must be of scheme file: ${String(url)}`);
  }
  return decodeURIComponent(parsed.pathname);
}

function pathToFileURL(path) {
  const url = new URL('file://');
  url.pathname = path.split('/').map((segment) => encodeURIComponent(segment))
    .join('/');
  return url;
}

module.exports = {
  URL,
  URLSearchParams,
  fileURLToPath,
  pathToFileURL,
  format: (url) => String(url),
  parse: (url) => new URL(url, 'file:///'),
};
