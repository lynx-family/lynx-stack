// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const DEFAULT_GENUI_SERVER_URL = 'http://localhost:3060';

export function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized === '127.0.0.1'
    || normalized === '[::1]';
}

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
  if (url.protocol === 'http:' && !isLoopbackHostname(url.hostname)) {
    throw new Error(
      'GENUI_SERVER_URL must use HTTPS unless it targets a loopback hostname',
    );
  }

  return url.origin;
}

export function assertTrustedGenuiServerCredentialTarget(
  rawTarget: string,
  configuredOrigin: string,
): void {
  let target: URL;
  let configured: URL;
  try {
    target = new URL(rawTarget);
    configured = new URL(configuredOrigin);
  } catch {
    throw new Error('Custom API key requests require a valid GenUI Server URL');
  }

  if (
    target.origin !== configured.origin
    || target.username
    || target.password
  ) {
    throw new Error(
      'Custom API keys may only be sent to the configured GenUI Server origin',
    );
  }
  if (
    target.protocol !== 'https:'
    && !(target.protocol === 'http:' && isLoopbackHostname(target.hostname))
  ) {
    throw new Error(
      'Custom API keys require an HTTPS GenUI Server; HTTP is allowed only for loopback development',
    );
  }
}
