// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { MessageProcessor } from '../store/MessageProcessor.js';
import { createResource } from '../store/Resource.js';
import type {
  Resource,
  ResourceInfo,
  ServerToClientMessage,
} from '../store/types.js';

/**
 * Mutable rendering state owned by one mounted `<A2UI>` session.
 *
 * @internal
 */
export interface A2UISessionState {
  processor: MessageProcessor;
  resources: Map<string, Resource>;
  activeMessageId: string | null;
  /** Changes only when replacement state switches or clears the active surface. */
  replacementRevision: number;
  /** How many messages from the buffer have been processed so far. */
  processedCount: number;
  replacement: readonly ServerToClientMessage[] | undefined;
  reset: readonly ServerToClientMessage[] | undefined;
}

/**
 * Create the state backing one mounted `<A2UI>` session.
 *
 * @internal
 */
export function createA2UISessionState(): A2UISessionState {
  return {
    processor: new MessageProcessor(),
    resources: new Map(),
    activeMessageId: null,
    replacementRevision: 0,
    processedCount: 0,
    replacement: undefined,
    reset: undefined,
  };
}

function applyReplacementUpdate(
  session: A2UISessionState,
  desiredSurfaceId: string | null,
  surfaceIds: readonly string[],
): boolean {
  const proc = session.processor;
  const retainedSurfaceIds = new Set(surfaceIds);
  for (const [messageId, resource] of session.resources) {
    const surface = resource.value?.surface;
    if (
      !surface || !retainedSurfaceIds.has(surface.surfaceId)
      || proc.getSurfaces().get(surface.surfaceId) !== surface
    ) {
      session.resources.delete(messageId);
    }
  }

  const desiredSurface = desiredSurfaceId
    ? proc.getSurfaces().get(desiredSurfaceId)
    : undefined;
  let activeMessageId: string | null = null;
  if (desiredSurface) {
    for (const [messageId, resource] of session.resources) {
      if (resource.value?.surface === desiredSurface) {
        activeMessageId = messageId;
      }
    }
    // A shared messageId may have reused the wrapper for another surface.
    if (activeMessageId === null) {
      const base = `surface:${desiredSurface.surfaceId}`;
      let messageId = base;
      let suffix = 0;
      while (session.resources.has(messageId)) {
        messageId = `${base}:${++suffix}`;
      }
      const resource = createResource<ResourceInfo>(messageId);
      resource.complete({
        type: 'beginRendering',
        surfaceId: desiredSurface.surfaceId,
        surface: desiredSurface,
      });
      session.resources.set(messageId, resource);
      activeMessageId = messageId;
    }
  }

  if (session.activeMessageId === activeMessageId) return false;
  session.activeMessageId = activeMessageId;
  return true;
}

/**
 * Apply one processor update to the React-facing session resources.
 * Returns whether the `<A2UI>` shell must re-render.
 *
 * @internal
 */
export function applyProcessorUpdate(
  session: A2UISessionState,
  data: Record<string, unknown>,
): boolean {
  if (data['type'] === 'replace') {
    return applyReplacementUpdate(
      session,
      data['surfaceId'] as string | null,
      data['surfaceIds'] as string[],
    );
  }

  const { type, surfaceId, messageId } = data as {
    type: string;
    surfaceId: string;
    messageId: string;
    targetId?: string;
  };
  const surface = session.processor.getOrCreateSurface(surfaceId);

  if (type === 'beginRendering') {
    let resource = session.resources.get(messageId);
    if (!resource) {
      resource = createResource<ResourceInfo>(messageId);
      session.resources.set(messageId, resource);
    }
    resource.complete({ type: 'beginRendering', surfaceId, surface });
    session.activeMessageId = messageId;
    return true;
  }

  if (type === 'surfaceUpdate') {
    const updates =
      (data as { updates?: ReadonlyArray<{ id?: string }> }).updates ?? [];
    for (const update of updates) {
      if (!update.id) continue;
      const resource = surface.resources.get(update.id);
      resource?.complete({
        type: 'surfaceUpdate',
        surfaceId,
        surface,
        component: update as ResourceInfo['component'] & object,
      } as ResourceInfo);
    }
    return false;
  }

  if (type === 'deleteSurface') {
    const targetId = (data as { targetId?: string }).targetId
      ?? surface.rootComponentId;
    if (targetId && surface.resources.has(targetId)) {
      surface.resources.get(targetId)!.complete({
        type: 'deleteSurface',
        surfaceId,
        surface,
      });
    }
    return true;
  }

  return false;
}
