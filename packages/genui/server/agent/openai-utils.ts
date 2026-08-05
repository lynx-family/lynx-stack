// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export function isOfficialOpenAIBaseURL(baseURL: string): boolean {
  try {
    return new URL(baseURL).hostname === 'api.openai.com';
  } catch {
    return false;
  }
}

export function isAIDPChatEndpoint(baseURL: string): boolean {
  try {
    const url = new URL(baseURL);
    return url.hostname === 'aidp.bytedance.net'
      && /^\/api\/modelhub\/online\/v2\/crawl\/?$/u.test(url.pathname);
  } catch {
    return false;
  }
}

export function defaultOpenAIAPIStyle(
  baseURL: string,
): 'chat' | 'responses' {
  return isOfficialOpenAIBaseURL(baseURL) ? 'responses' : 'chat';
}

export function rewriteAIDPChatURL(
  requestURL: string,
  baseURL: string,
  apiKey: string,
): string {
  if (!isAIDPChatEndpoint(baseURL)) {
    return requestURL;
  }
  const endpointURL = baseURL.replace(/\/+$/u, '');
  if (requestURL !== `${endpointURL}/chat/completions`) {
    return requestURL;
  }
  const targetURL = new URL(endpointURL);
  targetURL.searchParams.set('ak', apiKey);
  return targetURL.href;
}
