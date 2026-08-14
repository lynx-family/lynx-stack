// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const DEFAULT_GENUI_SERVER_URL = 'http://localhost:3060';

export function resolveGenuiServerUrl(raw: string | undefined): string {
  const configured = raw?.trim();
  const value = configured === undefined || configured === ''
    ? DEFAULT_GENUI_SERVER_URL
    : configured;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      `GENUI_SERVER_URL must be a valid HTTP(S) origin, got ${
        JSON.stringify(value)
      }`,
    );
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:')
    || url.username
    || url.password
    || url.pathname !== '/'
    || url.search
    || url.hash
  ) {
    throw new Error(
      'GENUI_SERVER_URL must be an HTTP(S) origin without credentials, path, query, or fragment',
    );
  }

  return url.origin;
}
