// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// Compatible with upstream cardActionUtils; see THIRD_PARTY_NOTICES.md.
import { ACTION_STEPS, BuiltinActionType } from '@openuidev/lang-core';

import type { ActionLike } from '../catalog/Action/index.jsx';

export function withItemContext(
  action: ActionLike,
  values: Record<string, unknown>,
): ActionLike {
  const item = Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  );
  if ('steps' in action) {
    const suffix = `Selected item: ${JSON.stringify(item)}`;
    return {
      ...action,
      steps: action.steps.map(step => {
        if (step.type !== ACTION_STEPS.ToAssistant) return step;
        return {
          ...step,
          context: step.context == null
            ? suffix
            : `${
              typeof step.context === 'string'
                ? step.context
                : JSON.stringify(step.context)
            }\n${suffix}`,
        };
      }),
    };
  }
  return {
    type: action.type ?? String(BuiltinActionType.ContinueConversation),
    params: {
      ...action.params,
      ...(action.url ? { url: action.url } : {}),
      ...(action.context ? { context: action.context } : {}),
      ...item,
    },
  };
}
