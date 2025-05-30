// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { PluginVueLynxOptions } from './pluginVueLynx.js'

/**
 * Validate the plugin options
 */
export function validateConfig(options: Required<PluginVueLynxOptions>): void {
  // Validate firstScreenSyncTiming
  if (
    options.firstScreenSyncTiming !== 'immediately' &&
    options.firstScreenSyncTiming !== 'jsReady'
  ) {
    throw new Error(
      `Invalid firstScreenSyncTiming: ${options.firstScreenSyncTiming}. ` +
      'Expected "immediately" or "jsReady".',
    )
  }

  // Validate targetSdkVersion if provided
  if (options.targetSdkVersion && typeof options.targetSdkVersion !== 'string') {
    throw new Error(
      `Invalid targetSdkVersion: ${options.targetSdkVersion}. ` +
      'Expected a string.',
    )
  }

  // Validate pipelineSchedulerConfig if provided
  if (
    options.pipelineSchedulerConfig !== undefined &&
    typeof options.pipelineSchedulerConfig !== 'number'
  ) {
    throw new Error(
      `Invalid pipelineSchedulerConfig: ${options.pipelineSchedulerConfig}. ` +
      'Expected a number.',
    )
  }
} 
