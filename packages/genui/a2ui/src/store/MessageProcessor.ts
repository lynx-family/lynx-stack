// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Signal } from '@lynx-js/react-signals';
import { signal } from '@lynx-js/react-signals';

import { expandMessage } from './protocol.js';
import { resolveBindingPath } from './resolveDynamic.js';
import { createResource } from './Resource.js';
import { SignalStore } from './SignalStore.js';
import type {
  ComponentInstance,
  FunctionResponse,
  ProtocolFunctionCall,
  RendererToAgentMessage,
  ServerToClientMessage,
  Surface,
} from './types.js';
import { isObject } from './utils.js';
import type { Catalog } from '../catalog/defineCatalog.js';

/**
 * Event envelope emitted by `MessageProcessor.dispatch`.
 */
export interface A2UIEvent {
  message: Record<string, unknown>;
  resolve: (response: unknown) => void;
}

/**
 * `null` / `undefined` / empty array / empty object → `false`.
 * Used by `dispatch()` to decide whether a listener's response should
 * win over later responses from other listeners.
 */
function isMeaningfulResponse(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return true;
}

/**
 * Stateful A2UI protocol processor that turns v1.0 messages into
 * renderable surfaces, resources, data-model signals, and user-action events.
 */
export class MessageProcessor {
  surfaces: Map<string, Surface>;
  private catalogs = new Map<string, Catalog>();
  private functionValues = new Map<string, Signal<unknown>>();
  private nextFunctionCallId = 0;
  private pendingCalls = new Map<
    string,
    {
      surfaceId: string;
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  /** Register a trusted catalog for qualified v1.0 function resolution. */
  registerCatalog(catalogId: string, catalog: Catalog): void {
    this.catalogs.set(catalogId, catalog);
  }

  /** Resolve a catalog by its exact wire identifier. */
  getCatalog(catalogId: string | undefined): Catalog | undefined {
    return catalogId === undefined ? undefined : this.catalogs.get(catalogId);
  }

  /** Send a v1.0 event through the host transport. */
  sendMessage(message: RendererToAgentMessage): Promise<unknown> {
    return this.dispatch(message);
  }

  /** Metadata accompanying renderer events for opted-in surfaces. */
  getDataModelMetadata(): Record<string, unknown> {
    return {
      a2uiRendererDataModel: {
        version: 'v1.0',
        surfaces: Object.fromEntries(
          [...this.surfaces].filter(([, surface]) => surface.sendDataModel).map(
            ([id, surface]) => [id, surface.store.getDataModel() ?? {}],
          ),
        ),
      },
    };
  }

  /** Invoke an agent function and correlate its streamed response. */
  callAgentFunction(
    surfaceId: string,
    callFunction: ProtocolFunctionCall,
  ): Promise<unknown> {
    const functionCallId = `renderer-${++this.nextFunctionCallId}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCalls.delete(functionCallId);
        reject(new Error('Agent function response timed out'));
      }, 30_000);
      this.pendingCalls.set(functionCallId, {
        surfaceId,
        resolve,
        reject,
        timer,
      });
      void this.sendMessage({
        version: 'v1.0',
        callAgentFunction: { surfaceId, functionCallId, callFunction },
      });
    });
  }

  /** Read an asynchronous agent expression; undefined represents pending or failed. */
  resolveAgentFunction(
    surfaceId: string,
    callFunction: ProtocolFunctionCall,
  ): unknown {
    const key = JSON.stringify([surfaceId, callFunction]);
    let result = this.functionValues.get(key);
    if (!result) {
      result = signal<unknown>(undefined);
      this.functionValues.set(key, result);
      const target = result;
      void this.callAgentFunction(surfaceId, callFunction).then(value => {
        target.value = value;
      }, error => {
        console.warn('[a2ui] Agent function failed:', error);
      });
    }
    return result.value;
  }

  private completeFunctionCall(response: FunctionResponse): void {
    const pending = this.pendingCalls.get(response.functionCallId);
    if (!pending) return;
    this.pendingCalls.delete(response.functionCallId);
    clearTimeout(pending.timer);
    if (response.error) pending.reject(new Error(response.error.message));
    else pending.resolve(response.value);
  }

  private cancelFunctionCalls(surfaceId?: string): void {
    for (const [functionCallId, pending] of this.pendingCalls) {
      if (surfaceId === undefined || pending.surfaceId === surfaceId) {
        this.completeFunctionCall({
          functionCallId,
          error: { code: 'CANCELLED', message: 'Surface was removed' },
        });
      }
    }
  }

  private async callRendererFunction(
    request: {
      functionCallId: string;
      callFunction: ProtocolFunctionCall & { catalogId: string };
    },
  ): Promise<void> {
    const { functionCallId, callFunction } = request;
    const entry = this.getCatalog(callFunction.catalogId)?.functions.find(fn =>
      fn.name === callFunction.call
    );
    if (
      !entry
      || !['agentOnly', 'rendererOrAgent'].includes(
        entry.definition?.allowedCallers ?? 'rendererOnly',
      )
    ) {
      await this.sendMessage({
        version: 'v1.0',
        error: {
          code: 'INVALID_FUNCTION_CALL',
          message:
            `Function "${callFunction.call}" is not callable by the agent`,
          functionCallId,
        },
      });
      return;
    }
    let response: FunctionResponse;
    try {
      response = {
        functionCallId,
        value: (await entry.impl(callFunction.args ?? {})) ?? null,
      };
    } catch (error) {
      response = {
        functionCallId,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
    await this.sendMessage({
      version: 'v1.0',
      rendererFunctionResponse: response,
    });
  }

  private eventListeners: Set<(event: A2UIEvent) => void> = new Set();
  private updateListeners: Set<(data: Record<string, unknown>) => void> =
    new Set();

  constructor() {
    this.surfaces = new Map();
  }

  onUpdate(callback: (data: Record<string, unknown>) => void): () => void {
    this.updateListeners.add(callback);
    return () => {
      this.updateListeners.delete(callback);
    };
  }

  private emitUpdate(data: Record<string, unknown>): void {
    for (const cb of this.updateListeners) cb(data);
  }

  dispatch(message: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve) => {
      if (this.eventListeners.size === 0) {
        resolve([]);
        return;
      }
      // Each listener gets its own one-shot resolver so multiple
      // subscribers don't race on the shared outer `resolve` (which
      // would let whoever calls it first decide the dispatch result and
      // silently drop responses from the rest). We resolve with the
      // first non-empty response, falling back to an empty array if
      // every listener yielded nothing.
      const total = this.eventListeners.size;
      let settled = 0;
      let firstResponse: unknown;
      let hasResponse = false;
      const tryResolve = () => {
        settled += 1;
        if (settled >= total) {
          resolve(hasResponse ? firstResponse : []);
        }
      };
      for (const cb of this.eventListeners) {
        let called = false;
        cb({
          message,
          resolve: (value) => {
            if (called) return;
            called = true;
            // Only treat the first **meaningful** response as the result.
            // Listeners that resolve `[]` / `null` / `{}` (the no-op
            // pattern from `<A2UI>`'s internal listener) shouldn't
            // shadow a real response from another subscriber.
            if (!hasResponse && isMeaningfulResponse(value)) {
              hasResponse = true;
              firstResponse = value;
            }
            tryResolve();
          },
        });
      }
    });
  }

  onEvent(callback: (event: A2UIEvent) => void): () => void {
    this.eventListeners.add(callback);
    return () => {
      this.eventListeners.delete(callback);
    };
  }

  getSurfaces(): ReadonlyMap<string, Surface> {
    return this.surfaces;
  }

  clearSurfaces(): void {
    this.cancelFunctionCalls();
    this.functionValues.clear();
    this.surfaces.clear();
  }

  getOrCreateSurface(surfaceId: string): Surface {
    let surface = this.surfaces.get(surfaceId);
    if (!surface) {
      surface = {
        surfaceId,
        rootComponentId: null,
        components: new Map<string, ComponentInstance>(),
        resources: new Map(),
        store: new SignalStore(),
      };
      this.surfaces.set(surfaceId, surface);
    } else if (!surface.store) {
      surface.store = new SignalStore();
    }
    return surface;
  }

  /**
   * Resolve a JSON Pointer taking into account the current data context.
   *
   * - Absolute paths (starting with '/') are returned as-is.
   * - Relative paths are resolved against the provided dataContextPath.
   */
  resolvePath(path: string, dataContextPath?: string): string {
    const context = dataContextPath?.endsWith('/')
      ? dataContextPath.slice(0, -1)
      : dataContextPath;
    if (path.startsWith('./')) {
      return resolveBindingPath(path.substring(2), context);
    }
    return resolveBindingPath(path, context);
  }

  private cloneComponentTree(
    originalId: string,
    newIdSuffix: string,
    dataContextPath: string,
    surface: Surface,
    updates: ComponentInstance[],
  ): string | null {
    const original = surface.components.get(originalId);
    if (!original) return null;

    const newId = `${originalId}${newIdSuffix}`;
    const cloned = JSON.parse(JSON.stringify(original)) as ComponentInstance;
    (cloned as unknown as Record<string, unknown>)['id'] = newId;
    cloned.dataContextPath = dataContextPath;

    surface.components.set(newId, cloned);
    updates.push(cloned);

    if (!surface.resources.has(newId)) {
      surface.resources.set(newId, createResource(newId));
    }

    const anyCloned = cloned as unknown as Record<string, unknown>;
    const clonedRefs = new Map<string, string | null>();

    const cloneReference = (childId: string): string | null => {
      if (clonedRefs.has(childId)) return clonedRefs.get(childId) ?? null;
      const newChildId = this.cloneComponentTree(
        childId,
        newIdSuffix,
        dataContextPath,
        surface,
        updates,
      );
      clonedRefs.set(childId, newChildId);
      return newChildId;
    };

    const cloneStringField = (field: string) => {
      const childId = anyCloned[field];
      if (typeof childId !== 'string') return;
      const newChildId = cloneReference(childId);
      if (newChildId) {
        anyCloned[field] = newChildId;
      }
    };

    if (Array.isArray(anyCloned['children'])) {
      const newChildren: string[] = [];
      for (const childId of anyCloned['children']) {
        if (typeof childId !== 'string') continue;
        const newChildId = cloneReference(childId);
        if (newChildId) newChildren.push(newChildId);
      }
      anyCloned['children'] = newChildren;
    }

    cloneStringField('child');

    if (Array.isArray(anyCloned['tabs'])) {
      anyCloned['tabs'] = (anyCloned['tabs'] as unknown[]).map((tab) => {
        if (!tab || typeof tab !== 'object') return tab;
        const tabObject = tab as Record<string, unknown>;
        const childId = tabObject['child'];
        if (typeof childId !== 'string') return tab;
        const newChildId = cloneReference(childId);
        if (!newChildId) return tab;
        return { ...tabObject, child: newChildId };
      });
    }

    cloneStringField('trigger');
    cloneStringField('content');
    cloneStringField('entryPointChild');
    cloneStringField('contentChild');

    return newId;
  }

  processMessages(messages: ServerToClientMessage[]): void {
    for (const message of messages) {
      if (message.version !== 'v1.0') {
        void this.sendMessage({
          version: 'v1.0',
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Only A2UI v1.0 is supported',
          },
        });
        continue;
      }
      if (
        'createSurface' in message
        && this.surfaces.has(message.createSurface.surfaceId)
      ) {
        void this.sendMessage({
          version: 'v1.0',
          error: {
            code: 'VALIDATION_FAILED',
            surfaceId: message.createSurface.surfaceId,
            message: 'Surface already exists',
          },
        });
        continue;
      }
      this.processExpandedMessages(expandMessage(message));
    }
  }

  private processExpandedMessages(messages: ServerToClientMessage[]): void {
    for (const message of messages) {
      if ('callRendererFunction' in message) {
        void this.callRendererFunction(message.callRendererFunction);
        continue;
      }
      if ('agentFunctionResponse' in message) {
        this.completeFunctionCall(message.agentFunctionResponse);
        continue;
      }
      const payload = Object.values(message).find((
        value,
      ): value is { surfaceId: string } =>
        value !== null && typeof value === 'object' && 'surfaceId' in value
      );
      if (
        payload && !('createSurface' in message)
        && !this.surfaces.has(payload.surfaceId)
      ) {
        void this.sendMessage({
          version: 'v1.0',
          error: {
            code: 'VALIDATION_FAILED',
            surfaceId: payload.surfaceId,
            message: 'Surface must be created exactly once before updates',
          },
        });
        continue;
      }
      if ('createSurface' in message && message.createSurface) {
        const createSurface = (message as unknown as Record<string, unknown>)[
          'createSurface'
        ] as Record<string, unknown>;
        const surfaceId = createSurface['surfaceId'] as string;
        const surface = this.getOrCreateSurface(surfaceId);
        const catId = createSurface['catalogId'];
        if (catId !== undefined) surface.catalogId = catId as string;
        const sData = createSurface['sendDataModel'];
        if (sData !== undefined) surface.sendDataModel = sData as boolean;
      }

      if ('updateComponents' in message && message.updateComponents) {
        const { surfaceId, components } = message.updateComponents;
        const surface = this.getOrCreateSurface(surfaceId);

        const updatesMap = new Map<string, ComponentInstance>();

        for (const item of components as ComponentInstance[]) {
          if (!item.id) continue;
          const existing = surface.components.get(item.id);
          const dataContextPath = existing?.dataContextPath;
          const instance = { ...item } as ComponentInstance;
          if (dataContextPath !== undefined) {
            instance.dataContextPath = dataContextPath;
          }

          const anyInstance = instance as unknown as Record<string, unknown>;
          if (
            anyInstance['children']
            && !Array.isArray(anyInstance['children'])
            && typeof anyInstance['children'] === 'object'
            && anyInstance['children'] !== null
            && typeof (anyInstance['children'] as Record<string, unknown>)[
                'componentId'
              ] === 'string'
            && typeof (anyInstance['children'] as Record<string, unknown>)[
                'path'
              ] === 'string'
          ) {
            const templatePath = this.resolvePath(
              (anyInstance['children'] as Record<string, unknown>)[
                'path'
              ] as string,
              dataContextPath,
            );
            instance.__template = {
              componentId: (anyInstance['children'] as Record<string, unknown>)[
                'componentId'
              ] as string,
              path: templatePath,
            };
          }

          surface.components.set(instance.id!, instance);
          updatesMap.set(instance.id!, instance);

          if (!surface.resources.has(instance.id!)) {
            surface.resources.set(instance.id!, createResource(instance.id!));
          }
        }

        if (!surface.rootComponentId) {
          if (surface.components.has('root')) {
            surface.rootComponentId = 'root';
          }

          if (surface.rootComponentId) {
            if (!surface.resources.has(surface.rootComponentId)) {
              surface.resources.set(
                surface.rootComponentId,
                createResource(surface.rootComponentId),
              );
            }
            // Fall back to a surface-derived id so consumers that key
            // resources by `messageId` still get a non-empty key when the
            // protocol message lacks one (the v1.0 stream does not require
            // `messageId` on every message).
            const messageId = (message as { messageId?: string }).messageId
              ?? `surface:${surfaceId}`;
            this.emitUpdate({
              type: 'beginRendering',
              surfaceId,
              messageId,
            });
          }
        }

        const updates = Array.from(updatesMap.values());
        if (updates.length > 0) {
          this.emitUpdate({
            type: 'surfaceUpdate',
            updates,
            surfaceId,
          });
        }
        this.processMessages([{
          version: 'v1.0',
          updateDataModel: { surfaceId, value: surface.store.getDataModel() },
        }]);
      }

      if ('updateDataModel' in message && message.updateDataModel) {
        const { surfaceId, path, value } = message.updateDataModel as {
          surfaceId: string;
          path?: string;
          value?: unknown;
        };
        const surface = this.getOrCreateSurface(surfaceId);

        surface.store.update(path === '' ? '/' : path ?? '/', value);

        const componentUpdates: ComponentInstance[] = [];

        for (const component of surface.components.values()) {
          const anyComponent = component as unknown as Record<string, unknown>;
          const templateInfo = anyComponent['__template'] as
            | { componentId: string; path: string }
            | undefined;

          if (!templateInfo) continue;

          const dataSignal = surface.store.getSignal(templateInfo.path);
          const rawData = dataSignal.value;
          let data: unknown;
          if (typeof rawData === 'string') {
            try {
              data = rawData ? JSON.parse(rawData) : undefined;
            } catch {
              data = undefined;
            }
          } else {
            data = rawData;
          }

          const explicitChildren: string[] = [];
          const generatedUpdates: ComponentInstance[] = [];

          if (Array.isArray(data)) {
            data.forEach((_, index) => {
              const suffix = `:${index}`;
              const ctx = `${templateInfo.path}/${index}`;
              const newId = this.cloneComponentTree(
                templateInfo.componentId,
                suffix,
                ctx,
                surface,
                generatedUpdates,
              );
              if (newId) {
                explicitChildren.push(newId);
              }
            });
          } else if (isObject(data)) {
            for (const key of Object.keys(data)) {
              const suffix = `:${key}`;
              const ctx = `${templateInfo.path}/${key}`;
              const newId = this.cloneComponentTree(
                templateInfo.componentId,
                suffix,
                ctx,
                surface,
                generatedUpdates,
              );
              if (newId) {
                explicitChildren.push(newId);
              }
            }
          }

          anyComponent['children'] = explicitChildren;
          componentUpdates.push(component);
          componentUpdates.push(...generatedUpdates);
        }

        if (componentUpdates.length > 0) {
          this.emitUpdate({
            type: 'surfaceUpdate',
            updates: componentUpdates,
            surfaceId,
          });
        }
      }

      if ('deleteSurface' in message && message.deleteSurface) {
        const { surfaceId } = message.deleteSurface;
        const surface = this.surfaces.get(surfaceId);

        // Same fallback as the synthesized `beginRendering` event so
        // consumers that key lifecycle state by `messageId` always see
        // a non-empty key when the protocol message lacks one.
        const messageId = (message as { messageId?: string }).messageId
          ?? `surface:${surfaceId}`;
        this.emitUpdate({
          type: 'deleteSurface',
          surfaceId,
          targetId: surface?.rootComponentId ?? surfaceId,
          messageId,
        });

        this.cancelFunctionCalls(surfaceId);
        for (const key of this.functionValues.keys()) {
          if ((JSON.parse(key) as unknown[])[0] === surfaceId) {
            this.functionValues.delete(key);
          }
        }
        this.surfaces.delete(surfaceId);
      }
    }
  }
}
