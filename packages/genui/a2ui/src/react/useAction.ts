// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback } from '@lynx-js/react';

import { useA2UIContext } from './useA2UIContext.js';
import type { CatalogFunctionEntry } from '../catalog/defineCatalog.js';
import type { MessageProcessor } from '../store/MessageProcessor.js';
import { resolveDynamicValue } from '../store/resolveDynamic.js';
import { executeFunctionCall } from '../store/resolveFunctionCall.js';
import type { A2UIAction, UserActionPayload } from '../store/types.js';

/**
 * Identifies the component and surface that emitted an A2UI action.
 */
export interface ActionProps {
  id: string;
  surfaceId: string;
  dataContext?: string | undefined;
}

/** @internal Wrap an action payload in the v1.0 renderer-to-agent envelope. */
export function createActionMessage(
  payload: UserActionPayload,
): { version: 'v1.0'; action: UserActionPayload } {
  return { version: 'v1.0', action: payload };
}

/** @internal Build the renderer-to-host action payload without React state. */
export function createUserActionPayload(
  action: A2UIAction,
  props: ActionProps,
  processor: MessageProcessor,
  functions: readonly CatalogFunctionEntry[],
  timestamp = new Date().toISOString(),
): UserActionPayload | null {
  if (!('event' in action) || !action.event) return null;

  const { id, surfaceId, dataContext } = props;
  const context: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(action.event.context ?? {})) {
    context[key] = resolveDynamicValue(
      processor,
      value,
      surfaceId,
      dataContext,
      { functions, resolveFunctionCall: executeFunctionCall },
    );
  }

  const payload: UserActionPayload = {
    name: action.event.name,
    surfaceId,
    sourceComponentId: id,
    timestamp,
    context,
  };
  if (action.event.userMessage !== undefined) {
    const resolvedUserMessage = resolveDynamicValue(
      processor,
      action.event.userMessage,
      surfaceId,
      dataContext,
      { functions, resolveFunctionCall: executeFunctionCall },
    );
    if (typeof resolvedUserMessage === 'string') {
      payload.userMessage = resolvedUserMessage;
    }
  }
  return payload;
}

/**
 * Create a `sendAction` callback that resolves dynamic action payload values
 * and dispatches user events or function calls through the current processor.
 */
export function useAction(
  props: ActionProps,
): { sendAction: (action: A2UIAction) => Promise<unknown> } {
  const { id, surfaceId, dataContext } = props;
  const { catalog, processor } = useA2UIContext();

  const sendAction = useCallback(
    (action: A2UIAction) => {
      if ('functionCall' in action && action.functionCall) {
        return Promise.resolve(executeFunctionCall(
          processor,
          action.functionCall,
          surfaceId,
          dataContext,
          { functions: catalog.functions },
        ));
      }

      const actionPayload = createUserActionPayload(
        action,
        { id, surfaceId, dataContext },
        processor,
        catalog.functions,
      );
      if (!actionPayload) return Promise.resolve(undefined);

      // Dispatch through the processor — `<A2UI>` listens via
      // `processor.onEvent` and forwards the action to its `onAction`
      // prop, which the developer wires to their agent.
      return processor.dispatch(createActionMessage(actionPayload));
    },
    [id, surfaceId, dataContext, processor, catalog.functions],
  );

  return { sendAction };
}
