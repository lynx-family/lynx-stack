/*
 * Copyright 2026 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

export function getExecutionSourceURL(
  bundleURL: string,
  sourcePath: string,
): string {
  const resolvedBundleURL = new URL(bundleURL, globalThis.location.href);
  resolvedBundleURL.hash = '';
  resolvedBundleURL.search = '';
  const encodedSourcePath = encodeURIComponent(sourcePath.replace(/^\/+/, ''));
  return `${resolvedBundleURL.href.replace(/\/+$/, '')}/${encodedSourcePath}`;
}
