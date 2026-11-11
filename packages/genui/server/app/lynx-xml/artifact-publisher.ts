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

export interface LynxXmlPublishedArtifact {
  sourceUrl: string;
}

export async function publishLynxXmlArtifact(
  source: string,
): Promise<LynxXmlPublishedArtifact | undefined> {
  try {
    const config = resolveTosStorageConfig();
    if (!config) {
      console.warn(
        '[lynx-xml:artifact-publisher] Volcengine TOS is not configured',
      );
      return undefined;
    }
    const client = createTosClient(config);
    const id = crypto.randomUUID();
    const sourcePath = buildTosStoragePath(
      tosStoragePrefix(config, 'lynx-xml'),
      'preview',
      id,
      'index.lynxml',
    );
    await uploadTosObject(
      client,
      config,
      sourcePath,
      source,
      'application/xml; charset=utf-8',
    );
    return { sourceUrl: buildTosObjectUrl(sourcePath, config) };
  } catch (err) {
    console.warn(
      '[lynx-xml:artifact-publisher] Volcengine TOS upload failed',
      err,
    );
    return undefined;
  }
}
