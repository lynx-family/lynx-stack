// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { zipSync } from 'fflate';

import type { ReactLynxBuildAsset } from '@lynx-js/genui-reactlynx';

import {
  buildTosObjectUrl,
  buildTosStoragePath,
  createTosClient,
  resolveTosStorageConfig,
  uploadTosObject,
} from '../../app/common/tos-storage.js';

const MAX_ARCHIVE_BYTES = 10 * 1024 * 1024;

export async function publishReactLynxBenchBuild(
  assets: ReactLynxBuildAsset[],
  signal: AbortSignal,
): Promise<{ id: string; zipUrl: string }> {
  signal.throwIfAborted();
  const config = resolveTosStorageConfig();
  if (!config) {
    throw new Error(
      'ReactLynx Bench publishing requires Volcengine TOS configuration',
    );
  }
  if (assets.length === 0 || assets.length > 100) {
    throw new Error('ReactLynx Bench ZIP requires 1–100 compiled assets');
  }
  const files = Object.create(null) as Record<string, Uint8Array>;
  let bytes = 0;
  for (const { name, data } of assets) {
    signal.throwIfAborted();
    if (
      name.length > 255 || name.split('/').length > 20
      || !/^[\w.-]+(?:\/[\w.-]+)*$/u.test(name)
      || name.split('/').some(part => part === '.' || part === '..')
      || name in files
    ) {
      throw new Error('Invalid ReactLynx Bench asset path');
    }
    bytes += data.byteLength;
    if (bytes > MAX_ARCHIVE_BYTES) {
      throw new Error('ReactLynx Bench ZIP exceeds the 10 MiB limit');
    }
    files[name] = data;
  }
  if ((files['main.lynx.js']?.length ?? 0) === 0) {
    throw new Error('ReactLynx Bench ZIP requires main.lynx.js');
  }
  // Stored entries respect UI Judge's archive ratio limit even for repetitive code.
  const archive = zipSync(files, { level: 0, mtime: new Date(1980, 0, 1) });
  if (archive.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error('ReactLynx Bench ZIP exceeds the 10 MiB limit');
  }
  signal.throwIfAborted();
  const id = crypto.randomUUID();
  const key = buildTosStoragePath(
    config.reactLynxBenchPrefix,
    'preview',
    id,
    'bundle.zip',
  );
  await uploadTosObject(
    createTosClient(config),
    config,
    key,
    archive,
    'application/zip',
  );
  signal.throwIfAborted();
  return { id, zipUrl: buildTosObjectUrl(key, config) };
}
