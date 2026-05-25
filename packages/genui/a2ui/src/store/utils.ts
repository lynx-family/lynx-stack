// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type * as v0_9 from '@a2ui/web_core/v0_9';

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isDataBinding(value: unknown): value is v0_9.DataBinding {
  return isObject(value) && 'path' in value;
}

export function isFunctionCall(value: unknown): value is v0_9.FunctionCall {
  return isObject(value) && 'call' in value;
}

export function isCallExpression(value: unknown): boolean {
  return isFunctionCall(value)
    && 'args' in value
    && 'returnType' in value;
}

export function isTemplateBinding(value: unknown): boolean {
  return isDataBinding(value) && 'componentId' in value;
}

export function isPlainDataBinding(value: unknown): boolean {
  return isDataBinding(value) && !('componentId' in value);
}
