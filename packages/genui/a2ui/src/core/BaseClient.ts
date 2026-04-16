import * as v0_9 from '@a2ui/web_core/v0_9';
import { createResource } from '../utils/createResource';
import type { Resource, A2UIClientEventMessage } from "./types";
import { type MessageProcessor, processor } from "./processor";

const MESSAGE_PROCESS_DELAY = 300;


function randomId(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function buildSseParams(message: A2UIClientEventMessage, messageId: string): Record<string, string> {
  const params: Record<string, string> = { messageId };
  const anyMessage: any = message as any;

  if (typeof message === 'string') {
    params['text'] = message;
  } else if (anyMessage) {
    if (anyMessage.text) {
      params['text'] = String(anyMessage.text);
    } else if (anyMessage.userAction) {
      const userAction = anyMessage.userAction as { name: string; context?: Record<string, unknown> };
      const actionName = userAction.name || 'unknownAction';
      const context = userAction.context ?? {};
      params['text'] = `USER_ACTION: ${actionName}, Context: ${JSON.stringify(context)}`;
    } else {
      params['text'] = JSON.stringify(message);
    }

    if (anyMessage.sessionId) {
      params['sessionId'] = String(anyMessage.sessionId);
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

function normalizePayloadToMessages(payload: unknown): any[] {
  const messages: any[] = [];

  const add = (value: any) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(add);
    } else {
      messages.push(value);
    }
  };

  const handle = (value: any): void => {
    if (value === null || value === undefined) return;

    if (Array.isArray(value)) {
      value.forEach(handle);
      return;
    }

    if (typeof value === 'string') {
      add(createFallbackMessagesFromPlainText(value));
      return;
    }

    if (typeof value === 'object') {
      const v: any = value;

      if (v.createSurface || v.updateComponents || v.updateDataModel || v.deleteSurface) {
        add(v);
        return;
      }

      if ('kind' in v && 'data' in v) {
        if (v.kind === 'data') {
          handle(v.data);
        } else if (v.kind === 'text') {
          add(createTextCardMessages(typeof v.data === 'string' ? v.data : String(v.data)));
        }
        return;
      }

      if (Array.isArray(v.messages)) {
        handle(v.messages);
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
  rawMessages: any[],
  messageId: string,
  activeSurfaceIds: Set<string>,
) {
  let hasComponentUpdate = false;
  const messages = rawMessages.filter((msg: any) => {
    const deletedSurfaceId = msg.deleteSurface?.surfaceId;
    if (typeof deletedSurfaceId === 'string') {
      activeSurfaceIds.delete(deletedSurfaceId);
    }

    const createdSurfaceId = msg.createSurface?.surfaceId;
    if (typeof createdSurfaceId === 'string') {
      if (activeSurfaceIds.has(createdSurfaceId)) {
        return false;
      }
      activeSurfaceIds.add(createdSurfaceId);
    }

    if (msg.updateComponents && Array.isArray(msg.updateComponents.components)) {
      if (msg.updateComponents.components.length > 0) {
        hasComponentUpdate = true;
      }
    }

    if (!msg.messageId) {
      msg.messageId = messageId;
    }

    return true;
  });

  return { messages, hasComponentUpdate };
}


export class BaseClient {
  protected processor: MessageProcessor;
  protected resources: Map<string, Resource>;
  protected resolves: Map<string, (value: any) => void>;
  protected baseUrl: string;
  public onResponseComplete?: (messageId: string, info: { hasBeginRendering: boolean }) => void;
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

      const surface = this.processor.getOrCreateSurface(surfaceId as any);

      if (type === 'beginRendering') {
        const resource = this.resources.get(messageId);
        resource?.complete({ type: 'beginRendering', surfaceId, surface });
      } else if (type === 'surfaceUpdate') {
        (updates || []).forEach((update) => {
          if (!update.id) return;
          const resource = surface.resources.get(update.id as string);
          resource?.complete({
            type: 'surfaceUpdate',
            surfaceId,
            surface,
            component: update as any,
          });
        });
      } else if (type === 'deleteSurface') {
        const { targetId } = data as any;
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

    this.processor.onEvent(async ({ message, resolve }) => {
      if (message.userAction) {
        try {
          const response = await this.processUserAction(message.userAction);
          resolve(response);
        } catch (e) {
          console.error('Error processing userAction', e);
          resolve([]);
        }
      } else {
        resolve([]);
      }
    });
  }

  async processUserAction(userAction: any): Promise<any> {
    const response = await this.send({ userAction } as A2UIClientEventMessage);
    const { messageId, resource, startStreaming, promise } = response;
    this.resources.set(messageId, resource);
    if (this.onResourceCreated) {
      this.onResourceCreated(resource, messageId);
    }
    startStreaming();
    return promise;
  }

  async makeRequest(request: string): Promise<any> {
    const response = await this.send(request as A2UIClientEventMessage);
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
    const messageId = id || randomId('task_');
    const promise = new Promise((resolve) => {
      this.resolves.set(messageId, resolve);
    });

    const resource = createResource(messageId);
    const that = this;

    function startStreaming() {
      (async () => {
        const params = new URLSearchParams(buildSseParams(message, messageId));

        const EventSourceImpl =
          typeof EventSource !== 'undefined' ? EventSource : lynx.EventSource;

        const url = `${that.baseUrl}?${params.toString()}`;

        console.info('[BaseClient v0.9] streaming answer message', message);

        if (url.includes('localhost') && typeof lynx !== 'undefined') {
          console.warn(
            "[BaseClient v0.9] You are using 'localhost' in Lynx environment. This may not work on a physical device. Please use your computer's IP address.",
          );
        }

        if (url.length > 2048) {
          console.warn(
            `[BaseClient v0.9] URL is too long (${url.length} chars), request might fail. Consider using POST or shortening the payload.`,
          );
        }

        console.info(
          '[BaseClient v0.9] Using EventSource implementation:',
          EventSourceImpl === (typeof EventSource !== 'undefined' ? EventSource : undefined)
            ? 'Native EventSource'
            : 'Custom/Lynx EventSource',
        );

        const eventSource = new EventSourceImpl(url);

        console.info(
          '[BaseClient v0.9] EventSource created, readyState:',
          (eventSource as any).readyState,
        );

        let isCompleted = false;
        let hasBeginRendering = false;
        let hasReceivedProcessedPayload = false;
        const activeSurfaceIds = new Set(that.processor.getSurfaces().keys());

        const messageQueue: any[][] = [];
        let isProcessingQueue = false;

        const processQueue = async () => {
          if (isProcessingQueue) return;
          isProcessingQueue = true;
          while (messageQueue.length > 0) {
            const msgs = messageQueue.shift();
            if (msgs && msgs.length > 0) {
              (that.processor as any).processMessages(msgs);
            }
            await new Promise((resolve) => setTimeout(resolve, MESSAGE_PROCESS_DELAY));
          }
          isProcessingQueue = false;
        };

        eventSource.addEventListener('open', (event: any) => {
          console.info('[BaseClient v0.9] SSE connection opened', event);
        });

        eventSource.addEventListener('update', (event: any) => {
          console.info('[BaseClient v0.9] SSE update event', event.data, event);
        });

        eventSource.addEventListener('delta', (event: any) => {
          console.info('[BaseClient v0.9] SSE delta event', event.data, event);
          try {
            let payload: any = event.data;
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
            console.info('[BaseClient v0.9] Normalized delta messages', messages);
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
              processQueue();
            }
          } catch (e) {
            console.error('Error processing delta', e);
          }
        });

        eventSource.addEventListener('complete', (event: any) => {
          console.info('[BaseClient v0.9] SSE complete event', event.data, event);
          if (isCompleted) return;
          isCompleted = true;

          try {
            let payload: any = event.data;
            if (typeof payload === 'string') {
              try {
                payload = JSON.parse(payload);
              } catch {
                // ignore
              }
            }

            const messages = normalizePayloadToMessages(payload);
            console.info('[BaseClient v0.9] Normalized complete messages', messages);

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
                processQueue();
              }
            }
          } catch (e) {
            console.error('[BaseClient v0.9] Error processing complete payload', e);
          }

          eventSource.close();

          if (that.onResponseComplete) {
            that.onResponseComplete(messageId, { hasBeginRendering });
          }
        });

        eventSource.addEventListener('error', (event: any) => {
          console.error('[BaseClient v0.9] SSE error details:', event);
          if (event && event.target && typeof event.target.readyState !== 'undefined') {
            console.error('[BaseClient v0.9] SSE readyState:', event.target.readyState);
          }
          eventSource.close();
        });
      })();
    }

    return { messageId, resource, startStreaming, promise };
  }
}
