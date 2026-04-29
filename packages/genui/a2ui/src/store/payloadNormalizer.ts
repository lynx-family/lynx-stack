// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ServerToClientMessage } from './types.js';

function randomId(prefix = '') {
  return prefix + Date.now().toString(36)
    + Math.random().toString(36).slice(2, 10);
}

/**
 * Build a single-Text fallback message stream from a plain string. Used by
 * transports / `Session.ingest` callers that receive free-form text from
 * the agent instead of structured protocol messages.
 */
export function createFallbackMessagesFromPlainText(
  text: string,
): ServerToClientMessage[] {
  const surfaceId = 'default';
  const rootId = 'root-text';

  return [
    {
      createSurface: {
        surfaceId,
        catalogId: 'inline-text',
      },
    },
    {
      updateComponents: {
        surfaceId,
        components: [
          {
            id: rootId,
            component: 'Text',
            text,
          },
        ],
      },
    },
  ] as ServerToClientMessage[];
}

/**
 * Build a Card-wrapped Text fallback message stream from a plain string.
 * Used when the agent emits text payloads with `kind: 'text'`.
 */
export function createTextCardMessages(
  text: string,
): ServerToClientMessage[] {
  const surfaceId = randomId('text_surface_');
  const rootId = 'root';
  const textId = 'text';

  return [
    {
      createSurface: {
        surfaceId,
        catalogId: 'inline-text',
      },
    },
    {
      updateComponents: {
        surfaceId,
        components: [
          {
            id: rootId,
            component: 'Card',
            child: textId,
          },
          {
            id: textId,
            component: 'Text',
            text,
            variant: 'body',
          },
        ],
      },
    },
  ] as ServerToClientMessage[];
}

/**
 * Normalize an arbitrary payload (string, array, object) into a flat list of
 * `ServerToClientMessage` records. Pass-through for already-structured
 * messages; falls back to wrapping plain text in a Text/Card surface.
 */
export function normalizePayloadToMessages(
  payload: unknown,
): ServerToClientMessage[] {
  const messages: ServerToClientMessage[] = [];

  const add = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const item of value) add(item);
    } else {
      messages.push(value as ServerToClientMessage);
    }
  };

  const handle = (value: unknown): void => {
    if (value === null || value === undefined) return;

    if (Array.isArray(value)) {
      for (const item of value) handle(item);
      return;
    }

    if (typeof value === 'string') {
      add(createFallbackMessagesFromPlainText(value));
      return;
    }

    if (typeof value === 'object') {
      const v = value as Record<string, unknown>;

      if (
        v['createSurface'] || v['updateComponents'] || v['updateDataModel']
        || v['deleteSurface']
      ) {
        add(v);
        return;
      }

      if ('kind' in v && 'data' in v) {
        if (v['kind'] === 'data') {
          handle(v['data']);
        } else if (v['kind'] === 'text') {
          add(
            createTextCardMessages(
              typeof v['data'] === 'string' ? v['data'] : String(v['data']),
            ),
          );
        }
        return;
      }

      if (Array.isArray(v['messages'])) {
        handle(v['messages']);
        return;
      }

      add(createFallbackMessagesFromPlainText(JSON.stringify(v)));
      return;
    }
  };

  handle(payload);
  return messages;
}

/**
 * Tag messages with the given messageId and report whether any of them
 * carries a non-empty `updateComponents`. Also dedupes `createSurface`
 * messages against the set of currently-active surfaces.
 */
export function prepareMessagesForProcessing(
  rawMessages: ServerToClientMessage[],
  messageId: string,
  activeSurfaceIds: Set<string>,
): { messages: ServerToClientMessage[]; hasComponentUpdate: boolean } {
  let hasComponentUpdate = false;
  const messages = rawMessages.filter((msg) => {
    const deletedSurfaceId = (msg as { deleteSurface?: { surfaceId?: string } })
      .deleteSurface?.surfaceId;
    if (typeof deletedSurfaceId === 'string') {
      activeSurfaceIds.delete(deletedSurfaceId);
    }

    const createdSurfaceId = (msg as { createSurface?: { surfaceId?: string } })
      .createSurface?.surfaceId;
    if (typeof createdSurfaceId === 'string') {
      if (activeSurfaceIds.has(createdSurfaceId)) {
        return false;
      }
      activeSurfaceIds.add(createdSurfaceId);
    }

    if (
      ((msg as { updateComponents?: { components?: unknown[] } })
        .updateComponents
        && Array.isArray(
          (msg as { updateComponents?: { components?: unknown[] } })
            .updateComponents?.components,
        )
        && (((msg as { updateComponents?: { components: unknown[] } })
          .updateComponents?.components ?? []).length > 0))
    ) {
      hasComponentUpdate = true;
    }

    msg.messageId ??= messageId;

    return true;
  });

  return { messages, hasComponentUpdate };
}
