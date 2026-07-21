// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export function isWebPlatform(): boolean {
  return typeof SystemInfo !== 'undefined'
    && String(SystemInfo.platform) === 'web';
}

export function resolveMcpAppBundleUrl(
  web: boolean,
  url: string,
  webUrl?: string,
): string {
  if (web) return typeof webUrl === 'string' ? webUrl.trim() : '';
  return typeof url === 'string' ? url.trim() : '';
}

export function normalizeMcpAppHeight(height: number | undefined): number {
  return typeof height === 'number' && Number.isFinite(height) && height > 0
    ? height
    : 480;
}
