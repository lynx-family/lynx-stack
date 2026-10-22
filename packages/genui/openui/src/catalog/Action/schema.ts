// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { tagSchemaId } from '@openuidev/lang-core';
import { z } from 'zod/v4';

const actionStepSchema = z.looseObject({
  type: z.string(),
});

const actionPlanSchema = z.object({
  steps: z.array(actionStepSchema),
});

const legacyActionSchema = z.object({
  type: z.string().optional(),
  params: z.record(z.string(), z.any()).optional(),
  url: z.string().optional(),
  context: z.string().optional(),
});

/** Shared action schema shown as `ActionExpression` in prompt signatures. */
export const actionPropSchema = z.union([
  actionPlanSchema,
  legacyActionSchema,
]);
tagSchemaId(actionPropSchema, 'ActionExpression');
