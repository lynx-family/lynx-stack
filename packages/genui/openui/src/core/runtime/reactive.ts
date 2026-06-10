// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { StateField } from '@openuidev/lang-core';
import { markReactive } from '@openuidev/lang-core';
import type { z } from 'zod/v4';

export { isReactiveSchema } from '@openuidev/lang-core';

/**
 * Mark a schema prop as reactive so runtime evaluation can preserve $bindings.
 */
export function reactive<T extends z.ZodType>(
  schema: T,
): z.ZodType<StateField<z.infer<T>>> {
  markReactive(schema);
  return schema as unknown as z.ZodType<StateField<z.infer<T>>>;
}
