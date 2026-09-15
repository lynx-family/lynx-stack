// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const ALLOWED_CUSTOM_PROVIDER_BASE_URLS = [
  'https://api.openai.com/v1',
  'https://generativelanguage.googleapis.com/v1beta/openai',
  'https://openrouter.ai/api/v1',
] as const;

const ALLOWED_CUSTOM_PROVIDER_BASE_URL_SET = new Set<string>(
  ALLOWED_CUSTOM_PROVIDER_BASE_URLS,
);

function providerPolicyError(): NodeJS.ErrnoException {
  const error = new Error(
    'Custom provider baseURL must be one of the supported provider URLs: '
      + ALLOWED_CUSTOM_PROVIDER_BASE_URLS.join(', '),
  ) as NodeJS.ErrnoException;
  error.code = 'ERR_GENUI_UNSUPPORTED_CUSTOM_PROVIDER_URL';
  return error;
}

export function assertAllowedCustomProviderBaseURL(
  value: string | URL,
): string {
  const serialized = typeof value === 'string' ? value : value.href;
  const normalized = serialized.replace(/\/$/u, '');
  if (!ALLOWED_CUSTOM_PROVIDER_BASE_URL_SET.has(normalized)) {
    throw providerPolicyError();
  }
  return normalized;
}

export function createCustomProviderFetch(
  fetchImpl: typeof fetch = fetch,
): typeof fetch {
  return (input, init) =>
    fetchImpl(input, {
      ...init,
      redirect: 'error',
    });
}
