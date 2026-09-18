// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createA2UISourcePolicy } from './a2ui-source-policy.js';

interface A2UIURLSourceMessage {
  role: unknown;
  content: unknown;
}

function normalizeHTTPURL(source: string): string | undefined {
  try {
    const url = new URL(source.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

export function createA2UIOpenURLPolicy(
  providedValues: readonly unknown[],
  dynamicSources: () => readonly string[] = () => [],
): (source: string) => boolean {
  return createA2UISourcePolicy(
    providedValues,
    normalizeHTTPURL,
    dynamicSources,
  );
}

export function userProvidedA2UIURLSources(
  ...messageCollections: readonly (
    | readonly A2UIURLSourceMessage[]
    | undefined
  )[]
): string[] {
  return messageCollections.flatMap((messages) =>
    (messages ?? []).flatMap((message) =>
      message.role === 'user' && typeof message.content === 'string'
        ? [message.content]
        : []
    )
  );
}
