// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

declare const __GENUI_SERVER_URL__: string;

export const GENUI_SERVER_URL = __GENUI_SERVER_URL__;

export function buildGenuiServerUrl(path: string): string {
  return new URL(path.replace(/^\/+/, ''), `${GENUI_SERVER_URL}/`).toString();
}
