// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/** Resolve only the packaged demo assets, leaving user-authored URLs untouched. */
export function resolveOpenUIExampleAssets(
  raw: string,
  baseUrl: string,
): string {
  return raw.replace(
    /(["'])(\.\/demos\/openui\/chat\/[^"'\s]+)\1/g,
    (_match, quote: string, path: string) =>
      `${quote}${new URL(path, baseUrl).href}${quote}`,
  );
}
