// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { tagSchemaId } from '@openuidev/lang-core';
import type { ActionEvent, ActionPlan } from '@openuidev/lang-core';
import { z } from 'zod/v4';

/** Shared action prop schema — shows as `ActionExpression` in prompt signatures. */
export interface LegacyActionConfig {
  type?: ActionEvent['type'];
  params?: Record<string, unknown>;
  url?: string;
  context?: string;
}

export type ActionLike = ActionPlan | LegacyActionConfig;

export const actionPropSchema = z.custom<ActionLike>(
  (value) => typeof value === 'object' && value !== null,
);
tagSchemaId(actionPropSchema, 'ActionExpression');
