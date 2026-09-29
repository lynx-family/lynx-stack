// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ElementTemplateSerializableValue } from './protocol.js';
import { ElementTemplateRuntime } from './runtime.js';
import type {
  CreateElementTemplateRequest,
  ElementTemplateHandle,
  InsertElementTemplateNodeRequest,
  NativeElementTemplateApi,
  RemoveElementTemplateNodeRequest,
} from './runtime.js';

export const ELEMENT_TEMPLATE_COMMIT_EVENT = 'Lynx.ElementTemplate.commit';

export type ElementTemplateBridgeCommand =
  | {
    type: 'createTemplate';
    request: CreateElementTemplateRequest<number>;
  }
  | {
    type: 'setAttribute';
    target: number;
    attributeSlotIndex: number;
    value: ElementTemplateSerializableValue;
  }
  | {
    type: 'insertNode';
    request: InsertElementTemplateNodeRequest<number>;
  }
  | {
    type: 'removeNode';
    request: RemoveElementTemplateNodeRequest<number>;
  };

export interface ElementTemplateBridgeCommit {
  commands: ElementTemplateBridgeCommand[];
}

export interface ElementTemplateBridgeProtocol {
  mainToBackground: Record<never, never>;
  backgroundToMain: {
    [ELEMENT_TEMPLATE_COMMIT_EVENT]: ElementTemplateBridgeCommit;
  };
}

export interface BackgroundElementTemplateChannel {
  dispatchToRemote(
    type: typeof ELEMENT_TEMPLATE_COMMIT_EVENT,
    data: ElementTemplateBridgeCommit,
  ): void;
  onDispose(listener: () => void): () => void;
}

export interface MainElementTemplateChannel {
  onRemote(
    type: typeof ELEMENT_TEMPLATE_COMMIT_EVENT,
    listener: (commit: ElementTemplateBridgeCommit) => void,
  ): () => void;
  onDispose(listener: () => void): () => void;
}

export class RemoteElementTemplateApi
  implements NativeElementTemplateApi<number>
{
  readonly #channel: BackgroundElementTemplateChannel;
  readonly #commands: ElementTemplateBridgeCommand[] = [];
  #batchDepth = 0;
  #disposed = false;

  public constructor(channel: BackgroundElementTemplateChannel) {
    this.#channel = channel;
    channel.onDispose(() => {
      this.#disposed = true;
      this.#commands.length = 0;
    });
  }

  public createTemplate(
    request: CreateElementTemplateRequest<number>,
  ): number {
    this.#enqueue({ type: 'createTemplate', request });
    return request.handleId;
  }

  public setAttribute(
    target: number,
    attributeSlotIndex: number,
    value: ElementTemplateSerializableValue,
  ): void {
    const pendingCreate = this.#findPendingCreate(target);
    if (pendingCreate !== undefined) {
      const attributeSlots = pendingCreate.request.attributeSlots ?? [];
      while (attributeSlots.length <= attributeSlotIndex) {
        attributeSlots.push(null);
      }
      attributeSlots[attributeSlotIndex] = value;
      pendingCreate.request.attributeSlots = attributeSlots;
      return;
    }

    this.#enqueue({
      type: 'setAttribute',
      target,
      attributeSlotIndex,
      value,
    });
  }

  public insertNode(request: InsertElementTemplateNodeRequest<number>): void {
    this.#enqueue({ type: 'insertNode', request });
  }

  public removeNode(request: RemoveElementTemplateNodeRequest<number>): void {
    this.#enqueue({ type: 'removeNode', request });
  }

  public batch<Result>(callback: () => Result): Result {
    this.#assertActive();
    const commandCount = this.#commands.length;
    this.#batchDepth += 1;

    try {
      const result = callback();
      this.#batchDepth -= 1;
      if (this.#batchDepth === 0) {
        this.flush();
      }
      return result;
    } catch (error) {
      this.#batchDepth -= 1;
      this.#commands.splice(commandCount);
      throw error;
    }
  }

  public flush(): void {
    this.#assertActive();
    if (this.#commands.length === 0) {
      return;
    }

    const commands = this.#commands.splice(0);
    this.#channel.dispatchToRemote(ELEMENT_TEMPLATE_COMMIT_EVENT, {
      commands,
    });
  }

  #enqueue(command: ElementTemplateBridgeCommand): void {
    this.#assertActive();
    this.#commands.push(command);
    if (this.#batchDepth === 0) {
      this.flush();
    }
  }

  #findPendingCreate(
    handleId: number,
  ):
    | Extract<ElementTemplateBridgeCommand, { type: 'createTemplate' }>
    | undefined
  {
    for (let index = this.#commands.length - 1; index >= 0; index -= 1) {
      const command = this.#commands[index];
      if (
        command?.type === 'createTemplate'
        && command.request.handleId === handleId
      ) {
        return command;
      }
    }
    return undefined;
  }

  #assertActive(): void {
    if (this.#disposed) {
      throw new Error('The remote Element Template API has been disposed.');
    }
  }
}

export interface RemoteElementTemplateRuntime {
  api: RemoteElementTemplateApi;
  runtime: ElementTemplateRuntime<number>;
  root: ElementTemplateHandle<number>;
}

export function createRemoteElementTemplateRuntime(
  channel: BackgroundElementTemplateChannel,
  rootHandleId = 0,
): RemoteElementTemplateRuntime {
  const api = new RemoteElementTemplateApi(channel);
  const runtime = new ElementTemplateRuntime(api);
  const root = runtime.registerRoot(rootHandleId, rootHandleId);
  return { api, runtime, root };
}

interface ParentLocation {
  childSlotIndex: number;
  parentId: number;
}

export class ElementTemplateCommandReceiver<NativeHandle> {
  readonly #api: NativeElementTemplateApi<NativeHandle>;
  readonly #handles = new Map<number, NativeHandle>();
  readonly #childSlots = new Map<
    number,
    Array<number[] | null | undefined>
  >();
  readonly #parents = new Map<number, ParentLocation>();
  readonly #removeCommitListener: () => void;
  readonly #removeDisposeListener: () => void;
  #disposed = false;

  public constructor(
    channel: MainElementTemplateChannel,
    api: NativeElementTemplateApi<NativeHandle>,
    rootNativeHandle: NativeHandle,
    rootHandleId = 0,
  ) {
    this.#api = api;
    this.#handles.set(rootHandleId, rootNativeHandle);
    this.#removeCommitListener = channel.onRemote(
      ELEMENT_TEMPLATE_COMMIT_EVENT,
      commit => {
        this.apply(commit.commands);
      },
    );
    this.#removeDisposeListener = channel.onDispose(() => {
      this.dispose();
    });
  }

  public apply(commands: readonly ElementTemplateBridgeCommand[]): void {
    this.#assertActive();

    for (const command of commands) {
      switch (command.type) {
        case 'createTemplate':
          this.#createTemplate(command.request);
          break;
        case 'setAttribute':
          this.#api.setAttribute(
            this.#getHandle(command.target),
            command.attributeSlotIndex,
            command.value,
          );
          break;
        case 'insertNode':
          this.#insertNode(command.request);
          break;
        case 'removeNode':
          this.#removeNode(command.request);
          break;
      }
    }

    this.#api.flush?.();
  }

  public getNativeHandle(handleId: number): NativeHandle | undefined {
    return this.#handles.get(handleId);
  }

  public dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#removeCommitListener();
    this.#removeDisposeListener();
    this.#handles.clear();
    this.#childSlots.clear();
    this.#parents.clear();
  }

  #createTemplate(request: CreateElementTemplateRequest<number>): void {
    if (this.#handles.has(request.handleId)) {
      throw new Error(
        `Element Template handle ${request.handleId} is already registered on the main thread.`,
      );
    }

    const nativeHandle = this.#api.createTemplate({
      ...request,
      childSlots: request.childSlots?.map(slot =>
        slot?.map(handleId =>
          this.#getHandle(handleId)
        )
      ) ?? null,
    });
    if (nativeHandle == null) {
      throw new Error(
        `Failed to create Element Template "${request.templateKey}" on the main thread.`,
      );
    }

    this.#handles.set(request.handleId, nativeHandle);
    const childSlots = request.childSlots?.map(slot => slot?.slice()) ?? [];
    this.#childSlots.set(request.handleId, childSlots);
    childSlots.forEach((slot, childSlotIndex) => {
      slot?.forEach(childId => {
        this.#parents.set(childId, {
          parentId: request.handleId,
          childSlotIndex,
        });
      });
    });
  }

  #insertNode(request: InsertElementTemplateNodeRequest<number>): void {
    this.#api.insertNode({
      parent: this.#getHandle(request.parent),
      childSlotIndex: request.childSlotIndex,
      child: this.#getHandle(request.child),
      before: request.before === null
        ? null
        : this.#getHandle(request.before),
    });

    this.#detach(request.child);
    const slots = this.#childSlots.get(request.parent) ?? [];
    const children = slots[request.childSlotIndex] ?? [];
    const beforeIndex = request.before === null
      ? -1
      : children.indexOf(request.before);
    if (beforeIndex < 0) {
      children.push(request.child);
    } else {
      children.splice(beforeIndex, 0, request.child);
    }
    slots[request.childSlotIndex] = children;
    this.#childSlots.set(request.parent, slots);
    this.#parents.set(request.child, {
      parentId: request.parent,
      childSlotIndex: request.childSlotIndex,
    });
  }

  #removeNode(request: RemoveElementTemplateNodeRequest<number>): void {
    this.#api.removeNode({
      parent: this.#getHandle(request.parent),
      childSlotIndex: request.childSlotIndex,
      child: this.#getHandle(request.child),
    });
    this.#detach(request.child);
    this.#releaseSubtree(request.child);
  }

  #detach(childId: number): void {
    const location = this.#parents.get(childId);
    if (location === undefined) {
      return;
    }

    const children = this.#childSlots.get(location.parentId)
      ?.[location.childSlotIndex];
    const childIndex = children?.indexOf(childId) ?? -1;
    if (childIndex >= 0) {
      children?.splice(childIndex, 1);
    }
    this.#parents.delete(childId);
  }

  #releaseSubtree(handleId: number): void {
    this.#childSlots.get(handleId)?.forEach(slot => {
      slot?.forEach(childId => {
        this.#releaseSubtree(childId);
      });
    });
    this.#childSlots.delete(handleId);
    this.#parents.delete(handleId);
    this.#handles.delete(handleId);
  }

  #getHandle(handleId: number): NativeHandle {
    const handle = this.#handles.get(handleId);
    if (handle === undefined) {
      throw new Error(
        `Element Template handle ${handleId} is not registered on the main thread.`,
      );
    }
    return handle;
  }

  #assertActive(): void {
    if (this.#disposed) {
      throw new Error(
        'The Element Template command receiver has been disposed.',
      );
    }
  }
}
