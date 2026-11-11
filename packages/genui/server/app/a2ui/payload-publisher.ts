// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  buildTosObjectUrl,
  buildTosStoragePath,
  createTosClient,
  resolveTosStorageConfig,
  tosStoragePrefix,
  uploadTosJson,
} from '../common/tos-storage.js';
import type { TosStorageMethod } from '../common/tos-storage.js';

export type A2UIStorageLocation =
  | { method: 'a2ui'; type: 'preview' }
  | { method: TosStorageMethod; type: 'conversation' };

const A2UI_PREVIEW_LOCATION: A2UIStorageLocation = {
  method: 'a2ui',
  type: 'preview',
};

export interface A2UIPublishedPayload {
  messagesUrl: string;
  actionMocksUrl?: string;
}

export async function publishA2UIPayload(
  messages: unknown,
  actionMocks?: unknown,
  location: A2UIStorageLocation = A2UI_PREVIEW_LOCATION,
): Promise<A2UIPublishedPayload | undefined> {
  if (messages === undefined) return undefined;

  try {
    const config = resolveTosStorageConfig();
    if (!config) {
      console.warn(
        '[a2ui:payload-publisher] Volcengine TOS is not configured',
      );
      return undefined;
    }
    const client = createTosClient(config);
    const id = crypto.randomUUID();
    const messagesPath = buildTosStoragePath(
      tosStoragePrefix(config, location.method),
      location.type,
      id,
      'messages.json',
    );
    await uploadTosJson(client, config, messagesPath, messages);
    const messagesUrl = buildTosObjectUrl(messagesPath, config);

    if (actionMocks !== undefined) {
      const actionMocksPath = buildTosStoragePath(
        tosStoragePrefix(config, location.method),
        location.type,
        id,
        'actionMocks.json',
      );
      await uploadTosJson(client, config, actionMocksPath, actionMocks);
      const actionMocksUrl = buildTosObjectUrl(actionMocksPath, config);
      return { messagesUrl, actionMocksUrl };
    }

    return { messagesUrl };
  } catch (err) {
    console.warn(
      '[a2ui:payload-publisher] Volcengine TOS upload failed',
      err,
    );
    return undefined;
  }
}
