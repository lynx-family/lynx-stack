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

export async function publishReactWebBuild(html: string, signal: AbortSignal) {
  signal.throwIfAborted();
  const config = resolveTosStorageConfig();
  if (!config) {
    throw new Error(
      'ReactWeb artifact publishing requires Volcengine TOS configuration',
    );
  }
  const id = crypto.randomUUID();
  const key = buildTosStoragePath(
    tosStoragePrefix(config, 'reactweb'),
    'preview',
    id,
    'index.html',
  );
  await uploadTosObject(
    createTosClient(config),
    config,
    key,
    html,
    'text/html; charset=utf-8',
  );
  signal.throwIfAborted();
  return { id, webUrl: buildTosObjectUrl(key, config) };
}
