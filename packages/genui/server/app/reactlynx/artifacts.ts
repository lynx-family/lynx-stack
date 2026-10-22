// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ReactLynxBuildAsset } from '@lynx-js/genui-reactlynx';

import {
  buildTosObjectUrl,
  buildTosStoragePath,
  createTosClient,
  resolveTosStorageConfig,
  tosStoragePrefix,
  uploadTosObject,
} from '../common/tos-storage.js';

function contentType(name: string): string {
  if (name.endsWith('.css')) return 'text/css';
  if (name.endsWith('.json')) return 'application/json';
  // Both entry files are binary templates despite their conventional suffix.
  return name.endsWith('.lynx.js') || name.endsWith('.web.js')
    ? 'application/octet-stream'
    : 'text/javascript';
}

export async function publishReactLynxBuild(
  assets: ReactLynxBuildAsset[],
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const config = resolveTosStorageConfig();
  if (!config) {
    throw new Error(
      'ReactLynx artifact publishing requires Volcengine TOS configuration',
    );
  }

  const id = crypto.randomUUID();
  const client = createTosClient(config);
  for (const asset of assets) {
    signal.throwIfAborted();
    await uploadTosObject(
      client,
      config,
      buildTosStoragePath(
        tosStoragePrefix(config, 'reactlynx'),
        'preview',
        id,
        asset.name,
      ),
      asset.data,
      contentType(asset.name),
    );
  }
  signal.throwIfAborted();

  const artifactUrl = (name: string) =>
    buildTosObjectUrl(
      buildTosStoragePath(
        tosStoragePrefix(config, 'reactlynx'),
        'preview',
        id,
        name,
      ),
      config,
    );

  return {
    id,
    webUrl: artifactUrl('main.web.js'),
    nativeUrl: artifactUrl('main.lynx.js'),
  };
}
