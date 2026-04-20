// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type * as v0_9 from '@a2ui/web_core/v0_9';

import { processor } from './processor.js';
import type { MessageProcessor } from './processor.js';
import type {
  A2UIClientEventMessage,
  Resource,
  ServerToClientMessage,
  UserActionPayload,
} from './types.js';
import { createResource } from '../utils/createResource.js';

const MESSAGE_PROCESS_DELAY = 300;

function randomId(prefix = '') {
  return prefix + Date.now().toString(36)
    + Math.random().toString(36).slice(2, 10);
}

function buildSseParams(
  message: A2UIClientEventMessage,
  messageId: string,
): Record<string, string> {
  const params: Record<string, string> = { messageId };
  const anyMessage: Record<string, unknown> = message as Record<
    string,
    unknown
  >;

  if (typeof message === 'string') {
    params['text'] = message;
  } else if (anyMessage) {
    if (typeof anyMessage['text'] === 'string') {
      params['text'] = anyMessage['text'];
    } else if (anyMessage['text']) {
      params['text'] = JSON.stringify(anyMessage['text']);
    } else if (anyMessage['userAction']) {
      const userAction = anyMessage['userAction'] as {
        name: string;
        context?: Record<string, unknown>;
      };
      const actionName = userAction.name || 'unknownAction';
      const context = userAction.context ?? {};
      params['text'] = `USER_ACTION: ${actionName}, Context: ${
        JSON.stringify(context)
      }`;
    } else {
      params['text'] = JSON.stringify(message);
    }

    if (typeof anyMessage['sessionId'] === 'string') {
      params['sessionId'] = anyMessage['sessionId'];
    } else if (anyMessage['sessionId']) {
      params['sessionId'] = JSON.stringify(anyMessage['sessionId']);
    }
  }

  return params;
}

function createFallbackMessagesFromPlainText(text: string) {
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
  ];
}

function createTextCardMessages(text: string) {
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
  ];
}

function normalizePayloadToMessages(payload: unknown): ServerToClientMessage[] {
  const messages: ServerToClientMessage[] = [];

  const add = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const item of value) {
        add(item);
      }
    } else {
      messages.push(value as ServerToClientMessage);
    }
  };

  const handle = (value: unknown): void => {
    if (value === null || value === undefined) return;

    if (Array.isArray(value)) {
      for (const item of value) {
        handle(item);
      }
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

function prepareMessagesForProcessing(
  rawMessages: ServerToClientMessage[],
  messageId: string,
  activeSurfaceIds: Set<string>,
) {
  let hasComponentUpdate = false;
  const messages = rawMessages.filter((msg: ServerToClientMessage) => {
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

export class BaseClient {
  protected processor: MessageProcessor;
  protected resources: Map<string, Resource>;
  protected resolves: Map<string, (value: unknown) => void>;
  protected baseUrl: string;
  public onResponseComplete?: (
    messageId: string,
    info: { hasBeginRendering: boolean },
  ) => void;
  public onResourceCreated?: (resource: Resource, messageId: string) => void;

  constructor(baseUrl: string) {
    this.processor = processor as unknown as MessageProcessor;
    this.resources = new Map();
    this.resolves = new Map();
    this.baseUrl = baseUrl;

    this.processor.onUpdate((data) => {
      const { type, surfaceId, messageId, updates = [] } = data as {
        surfaceId: string;
        type: string;
        messageId: string;
        updates?: v0_9.AnyComponent[];
        targetId?: string;
      };

      const surface = this.processor.getOrCreateSurface(surfaceId);

      if (type === 'beginRendering') {
        const resource = this.resources.get(messageId);
        resource?.complete({ type: 'beginRendering', surfaceId, surface });
      } else if (type === 'surfaceUpdate') {
        (updates || []).forEach((update) => {
          if (!update.id) return;
          const resource = surface.resources.get(update.id);
          resource?.complete({
            type: 'surfaceUpdate',
            surfaceId,
            surface,
            component: update as import('./types.js').ComponentInstance,
          });
        });
      } else if (type === 'deleteSurface') {
        const { targetId } = data as { targetId?: string };
        const target = targetId ?? surface.rootComponentId;
        if (target && surface.resources.has(target)) {
          const resource = surface.resources.get(target)!;
          resource.complete({ type: 'deleteSurface', surfaceId, surface });
        }
      }

      const resolve = this.resolves.get(messageId);
      if (resolve) {
        resolve({ type, surfaceId, surface });
        this.resolves.delete(messageId);
      }
    });

    this.processor.onEvent(
      ({ message, resolve }: import('./processor.js').A2UIEvent) => {
        void (async () => {
          if (
            typeof message === 'object' && message !== null
            && 'userAction' in message
            && (message as { userAction: unknown }).userAction
          ) {
            try {
              const response = await this.processUserAction(
                (message as { userAction: unknown })
                  .userAction as UserActionPayload,
              );
              resolve(response);
            } catch (e) {
              console.error('Error processing userAction', e);
              resolve([]);
            }
          } else {
            resolve([]);
          }
        })();
      },
    );
  }

  async processUserAction(userAction: UserActionPayload): Promise<unknown> {
    const response = await this.send({ userAction } as A2UIClientEventMessage);
    const { messageId, resource, startStreaming, promise } = response;
    this.resources.set(messageId, resource);
    if (this.onResourceCreated) {
      this.onResourceCreated(resource, messageId);
    }
    startStreaming();
    return promise;
  }

  async makeRequest(
    request: string,
  ): Promise<
    { messageId: string; resource: Resource; promise: Promise<unknown> }
  > {
    const response = await this.send(
      request as unknown as A2UIClientEventMessage,
    );
    const { messageId, resource, startStreaming, promise } = response;
    this.resources.set(messageId, resource);
    startStreaming();
    return { messageId, resource, promise };
  }

  async send(
    message: A2UIClientEventMessage,
    id?: string,
  ): Promise<{
    messageId: string;
    resource: Resource;
    startStreaming: () => void;
    promise: Promise<unknown>;
  }> {
    const messageId = id ?? randomId('task_');
    const promise = new Promise((resolve) => {
      this.resolves.set(messageId, resolve);
    });

    const resource = createResource(messageId) as unknown as Resource;

    const startStreaming = () => {
      void (async () => {
        const params = new URLSearchParams(buildSseParams(message, messageId));

        interface TypedEventSource {
          addEventListener(
            type: string,
            listener: (
              event: { data?: unknown; target?: unknown; type?: string },
            ) => void,
          ): void;
          close(): void;
          readyState: number;
        }
        const g = globalThis as Record<string, unknown>;
        const tsKey = 'Event' + 'Source';
        const NativeES = g[tsKey] as
          | (new(url: string) => TypedEventSource)
          | undefined;
        const EventSourceImpl = NativeES
          ?? (lynx.EventSource as unknown as new(
            url: string,
          ) => TypedEventSource);

        const url = `${this.baseUrl}?${params.toString()}`;

        console.info('[BaseClient v0.9] streaming answer message', message);

        if (url.includes('localhost') && typeof lynx !== 'undefined') {
          console.warn(
            '[BaseClient v0.9] You are using \'localhost\' in Lynx environment. This may not work on a physical device. Please use your computer\'s IP address.',
          );
        }

        if (url.length > 2048) {
          console.warn(
            `[BaseClient v0.9] URL is too long (${url.length} chars), request might fail. Consider using POST or shortening the payload.`,
          );
        }

        console.info(
          '[BaseClient v0.9] Using EventSource implementation:',
          EventSourceImpl === NativeES
            ? 'Native EventSource'
            : 'Custom/Lynx EventSource',
        );

        const eventSource = new EventSourceImpl(url);

        console.info(
          '[BaseClient v0.9] EventSource created, readyState:',
          (eventSource as unknown as { readyState: number }).readyState,
        );

        let isCompleted = false;
        let hasBeginRendering = false;
        let hasReceivedProcessedPayload = false;
        const activeSurfaceIds = new Set(this.processor.getSurfaces().keys());

        const messageQueue: ServerToClientMessage[][] = [];
        let isProcessingQueue = false;

        const processQueue = async () => {
          if (isProcessingQueue) return;
          isProcessingQueue = true;
          while (messageQueue.length > 0) {
            const msgs = messageQueue.shift();
            if (msgs && msgs.length > 0) {
              this.processor.processMessages(msgs);
            }
            await new Promise((resolve) =>
              setTimeout(resolve, MESSAGE_PROCESS_DELAY)
            );
          }
          isProcessingQueue = false;
        };

        eventSource.addEventListener(
          'open',
          (event: { data?: unknown; target?: unknown; type?: string }) => {
            console.info('[BaseClient v0.9] SSE connection opened', event);
          },
        );

        eventSource.addEventListener(
          'update',
          (event: { data?: unknown; target?: unknown; type?: string }) => {
            console.info(
              '[BaseClient v0.9] SSE update event',
              event.data,
              event,
            );
          },
        );

        eventSource.addEventListener(
          'delta',
          (event: { data?: unknown; target?: unknown; type?: string }) => {
            console.info(
              '[BaseClient v0.9] SSE delta event',
              event.data,
              event,
            );
            try {
              let payload = event.data;
              if (typeof payload === 'string') {
                try {
                  payload = JSON.parse(payload);
                } catch {
                  // ignore
                }
              }

              if (typeof payload === 'string') {
                try {
                  payload = JSON.parse(payload);
                } catch {
                  // ignore
                }
              }

              const messages = normalizePayloadToMessages(payload);
              console.info(
                '[BaseClient v0.9] Normalized delta messages',
                messages,
              );
              const prepared = prepareMessagesForProcessing(
                messages,
                messageId,
                activeSurfaceIds,
              );
              if (prepared.hasComponentUpdate) {
                hasBeginRendering = true;
              }

              if (prepared.messages.length > 0) {
                hasReceivedProcessedPayload = true;
                messageQueue.push(prepared.messages);

                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                processQueue();
              }
            } catch (e) {
              console.error('Error processing delta', e);
            }
          },
        );

        eventSource.addEventListener(
          'complete',
          (event: { data?: unknown; target?: unknown; type?: string }) => {
            console.info(
              '[BaseClient v0.9] SSE complete event',
              event.data,
              event,
            );
            if (isCompleted) return;
            isCompleted = true;

            try {
              let payload = event.data;
              if (typeof payload === 'string') {
                try {
                  payload = JSON.parse(payload);
                } catch {
                  // ignore
                }
              }

              const messages = normalizePayloadToMessages(payload);
              console.info(
                '[BaseClient v0.9] Normalized complete messages',
                messages,
              );

              if (!hasReceivedProcessedPayload && messages.length > 0) {
                const prepared = prepareMessagesForProcessing(
                  messages,
                  messageId,
                  activeSurfaceIds,
                );
                if (prepared.hasComponentUpdate) {
                  hasBeginRendering = true;
                }

                if (prepared.messages.length > 0) {
                  messageQueue.push(prepared.messages);

                  // eslint-disable-next-line @typescript-eslint/no-floating-promises
                  processQueue();
                }
              }
            } catch (e) {
              console.error(
                '[BaseClient v0.9] Error processing complete payload',
                e,
              );
            }

            eventSource.close();

            if (this.onResponseComplete) {
              this.onResponseComplete(messageId, { hasBeginRendering });
            }
          },
        );

        eventSource.addEventListener(
          'error',
          (event: { data?: unknown; target?: unknown; type?: string }) => {
            console.error('[BaseClient v0.9] SSE error details:', event);
            if (
              event && typeof event === 'object' && 'target' in event
              && event.target && typeof event.target === 'object'
              && 'readyState' in event.target
              && typeof (event.target as Record<string, unknown>)['readyState']
                !== 'undefined'
            ) {
              const target = event.target as Record<string, unknown>;
              console.error(
                '[BaseClient v0.9] SSE readyState:',
                target['readyState'],
              );
            }
            eventSource.close();
          },
        );
      })();
    };

    return { messageId, resource, startStreaming, promise };
  }
}
