// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { MessageProcessor } from '../store/MessageProcessor.js';
import { createMessageReader } from '../store/MessageStore.js';
import type {
  MessageReader,
  MessageRun,
  MessageStore,
} from '../store/MessageStore.js';
import { createResource } from '../store/Resource.js';
import type { Resource, ResourceInfo, Surface } from '../store/types.js';

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
  /** Position in the store currently feeding this session. */
  reader: MessageReader | undefined;
  /** Whether the processor may already hold state from an earlier store. */
  attached: boolean;
  /** Generation whose snapshot was rejected; its appended tail is ignored. */
  rejected: object | undefined;
  /** Guards against a store mutation made while messages are being applied. */
  draining: boolean;
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
    reader: undefined,
    attached: false,
    rejected: undefined,
    draining: false,
  };
}

/**
 * Point the session at a store. A session that has already consumed another
 * store reconciles to the new store's contents instead of stacking them.
 *
 * @internal
 */
export function attachMessageStore(
  session: A2UISessionState,
  store: MessageStore,
): void {
  session.reader = createMessageReader(store, { adopt: session.attached });
  session.attached = true;
  session.rejected = undefined;
}

function activeSurface(session: A2UISessionState): Surface | undefined {
  return session.activeMessageId
    ? session.resources.get(session.activeMessageId)?.value?.surface
    : undefined;
}

function rootResource(surface: Surface | undefined): Resource | undefined {
  return surface?.rootComponentId
    ? surface.resources.get(surface.rootComponentId)
    : undefined;
}

function applyRun(session: A2UISessionState, run: MessageRun): boolean {
  if (run.kind === 'append') {
    // The tail of a rejected snapshot was written against state that never
    // existed, so it waits for a corrected `replace` or a `clear`.
    if (session.rejected === run.epoch) return false;
    session.processor.processMessages(run.messages);
    return false;
  }
  const previous = activeSurface(session);
  const previousRoot = rootResource(previous);
  if (!session.processor.replaceMessages(run.messages)) {
    session.rejected = run.epoch;
    console.warn(
      '[a2ui] Replacement rejected; keeping the previous rendering state. Correct the full snapshot with replace().',
    );
    return false;
  }
  session.rejected = undefined;
  const current = activeSurface(session);
  // Only an explicit replacement can change the renderer's identity.
  // Appended messages retain the historical unkeyed reconciliation.
  if (previous !== current || previousRoot !== rootResource(current)) {
    session.replacementRevision += 1;
    return true;
  }
  return false;
}

/**
 * Apply every message the session has not seen yet, in order. Returns whether
 * the `<A2UI>` shell must re-render.
 *
 * A message that throws is reported and skipped so that one malformed
 * message cannot discard the ones that follow it.
 *
 * @internal
 */
export function drainMessages(session: A2UISessionState): boolean {
  const reader = session.reader;
  // A mutation made from inside a processor callback lands in the same
  // buffer; the loop below picks it up once the current run is applied.
  if (!reader || session.draining) return false;
  session.draining = true;
  let rerender = false;
  try {
    for (let run = reader.read(); run; run = reader.read()) {
      try {
        if (applyRun(session, run)) rerender = true;
      } catch (error) {
        console.error('[a2ui] Failed to apply messages:', error);
      }
    }
  } finally {
    session.draining = false;
  }
  return rerender;
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
