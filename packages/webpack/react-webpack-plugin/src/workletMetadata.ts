// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const WORKLET_USAGE_BUILD_INFO_KEY = 'lynxHasWorklet';
const WORKLET_REGISTER_INTERNAL_RE = /\bregisterWorkletInternal\s*\(/;

interface ModuleWithBuildInfo {
  buildInfo?: Record<string, unknown>;
}

interface LoaderContextWithModule {
  _module?: ModuleWithBuildInfo;
}

function detectWorkletUsage(transformedCode: string): boolean {
  return WORKLET_REGISTER_INTERNAL_RE.test(transformedCode);
}

function setModuleWorkletUsage(
  loaderContext: unknown,
  hasWorklet: boolean,
): void {
  const module = (loaderContext as LoaderContextWithModule)._module;
  if (!module) {
    return;
  }

  module.buildInfo ??= {};
  module.buildInfo[WORKLET_USAGE_BUILD_INFO_KEY] = hasWorklet;
}

function moduleHasWorkletUsage(module: unknown): boolean {
  const buildInfo = (module as ModuleWithBuildInfo)?.buildInfo;
  return buildInfo?.[WORKLET_USAGE_BUILD_INFO_KEY] === true;
}

export { detectWorkletUsage, moduleHasWorkletUsage, setModuleWorkletUsage };
