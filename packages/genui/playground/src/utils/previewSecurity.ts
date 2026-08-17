// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const SAFE_DEMO_ID = /^[a-z0-9][a-z0-9-]{0,127}$/u;

interface MessageIdentity {
  origin: string;
  source: unknown;
}

export function isTrustedPreviewMessage(
  event: MessageIdentity,
  expectedOrigin: string,
  expectedSource?: unknown,
): boolean {
  return event.origin === expectedOrigin
    && (expectedSource === undefined || event.source === expectedSource);
}

export function resolveTrustedPreviewBundleUrl(
  raw: string | undefined,
  pageUrl: string,
): string | null {
  const value = raw?.trim();
  if (!value || value.includes('?') || value.includes('#')) return null;

  try {
    const page = new URL(pageUrl);
    const bundle = new URL(value, page);
    if (
      (bundle.protocol !== 'http:' && bundle.protocol !== 'https:')
      || bundle.username
      || bundle.password
      || bundle.origin !== page.origin
      || !bundle.pathname.endsWith('.web.js')
    ) {
      return null;
    }
    return bundle.toString();
  } catch {
    return null;
  }
}

export function resolveDemoMessagesUrl(
  raw: string | null,
  pageUrl: string,
): string | null {
  const demoId = raw?.trim();
  if (!demoId || !SAFE_DEMO_ID.test(demoId)) return null;

  try {
    return new URL(`./demos/${demoId}.json`, pageUrl).toString();
  } catch {
    return null;
  }
}
