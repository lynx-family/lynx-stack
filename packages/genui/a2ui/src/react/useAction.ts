// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type * as v0_9 from '@a2ui/web_core/v0_9';

import { useCallback } from '@lynx-js/react';

import { useA2UIContext } from './useA2UIContext.js';
import { resolveDynamicValue } from '../store/resolveDynamic.js';
import { executeFunctionCall } from '../store/resolveFunctionCall.js';
import type { UserActionPayload } from '../store/types.js';

/**
 * Identifies the component and surface that emitted an A2UI action.
 */
export interface ActionProps {
  id: string;
  surfaceId: string;
  dataContext?: string | undefined;
}

/**
 * Create a `sendAction` callback that resolves dynamic action payload values
 * and dispatches user events or function calls through the current processor.
 */
export function useAction(
  props: ActionProps,
): { sendAction: (action: v0_9.Action) => Promise<unknown> } {
  const { id, surfaceId, dataContext } = props;
  const { catalog, processor } = useA2UIContext();

  const sendAction = useCallback(
    (action: v0_9.Action) => {
      if ('functionCall' in action && action.functionCall) {
        return Promise.resolve(executeFunctionCall(
          processor,
          action.functionCall,
          surfaceId,
          dataContext,
          { functions: catalog.functions },
        ));
      }

      let name = 'unknownAction';
      let context: Record<string, unknown> = {};

      if ('event' in action && action.event) {
        name = action.event.name;
        const ctx = action.event.context as Record<string, unknown> | undefined;
        if (ctx) {
          const resolvedContext: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(ctx)) {
            resolvedContext[key] = resolveDynamicValue(
              processor,
              value,
              surfaceId,
              dataContext,
              { functions: catalog.functions },
            );
          }
          context = resolvedContext;
        }
      }

      const userAction: UserActionPayload = {
        name,
        surfaceId,
        sourceComponentId: id,
        timestamp: new Date().toISOString(),
        context,
      };

      // Dispatch through the processor — `<A2UI>` listens via
      // `processor.onEvent` and forwards the action to its `onAction`
      // prop, which the developer wires to their agent.
      return processor.dispatch({ userAction });
    },
    [id, surfaceId, dataContext, processor, catalog.functions],
  );

  return { sendAction };
}
