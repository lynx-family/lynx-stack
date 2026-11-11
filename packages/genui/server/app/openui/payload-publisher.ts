// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  buildTosObjectUrl,
  buildTosStoragePath,
  createTosClient,
  resolveTosStorageConfig,
  tosStoragePrefix,
  uploadTosObject,
} from '../common/tos-storage.js';

export interface OpenUIPublishedPayload {
  rawTextUrl: string;
}

export async function publishOpenUIRawText(
  rawText: string,
): Promise<OpenUIPublishedPayload | undefined> {
  try {
    const config = resolveTosStorageConfig();
    if (!config) {
      console.warn(
        '[openui:payload-publisher] Volcengine TOS is not configured',
      );
      return undefined;
    }
    const client = createTosClient(config);
    const id = crypto.randomUUID();
    const rawTextPath = buildTosStoragePath(
      tosStoragePrefix(config, 'openui'),
      'preview',
      id,
      'raw.txt',
    );
    await uploadTosObject(
      client,
      config,
      rawTextPath,
      rawText,
      'text/plain; charset=utf-8',
    );
    return { rawTextUrl: buildTosObjectUrl(rawTextPath, config) };
  } catch (err) {
    console.warn(
      '[openui:payload-publisher] Volcengine TOS upload failed',
      err,
    );
    return undefined;
  }
}
