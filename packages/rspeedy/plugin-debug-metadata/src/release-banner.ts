// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const RELEASE_DEFINE = '__DEBUG_METADATA_RELEASE__'

/**
 * Prefix tagging the runtime release as debug-metadata-origin. Reverse-
 * resolution services route releases starting with this to the debug-metadata
 * container path (vs the legacy slardar source-map path) and strip it before
 * matching the bare chunk-hash `key` stored in `debug-metadata.json`.
 */
export const RELEASE_PREFIX = 'debugmetadata:'

export function getReleaseDefine(release: string): string {
  return `var ${RELEASE_DEFINE} = ${
    JSON.stringify(RELEASE_PREFIX + release)
  };\n`
}

export function getReleaseRuntime(): string {
  return `(function () {
  'use strict';
  try {
    throw new Error(${RELEASE_DEFINE});
  } catch (e) {
    e.name = 'LynxGetSourceMapReleaseError';
    if (typeof _SetSourceMapRelease === 'function') {
      _SetSourceMapRelease(e); // original filename from engine (e.g. 'lepus.js' or 'dynamic_component_name/main-thread.js')
      e.stack = '    at <eval> (file://[name].js:1:1)\\n';
      _SetSourceMapRelease(e); // engineVersion > 2.13 reports an empty filename, so set it to the Rspeedy filename
    } else if (
      typeof lynxCoreInject !== 'undefined' &&
      typeof lynxCoreInject.tt.setSourceMapRelease === 'function'
    ) {
      lynxCoreInject.tt.setSourceMapRelease(e);
    }
  }
  if (typeof lynx !== 'undefined' &&
      typeof lynx.performance !== 'undefined' &&
      typeof lynx.performance.profileMark !== 'undefined') {
    lynx.performance.profileMark('[pluginDebugMetadata] SetSourceMapInfo', {
      args: {
        release: ${RELEASE_DEFINE},
      }
    });
  }
})();
`
}
