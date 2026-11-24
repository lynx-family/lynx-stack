// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Signal } from '@lynx-js/react-signals';
import { signal } from '@lynx-js/react-signals';

import {
  collectComponentReferences,
  compositionErrors,
} from './composition.js';
import { expandMessage, replaceDataModel } from './protocol.js';
import { reconcileDataModel } from './reconcile.js';
import { resolveBindingPath } from './resolveDynamic.js';
import { executeFunctionCall } from './resolveFunctionCall.js';
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
import { equalJsonValues, isObject } from './utils.js';
import type { Catalog } from '../catalog/defineCatalog.js';

/**
 * Event envelope emitted by `MessageProcessor.dispatch`.
 */
export interface A2UIEvent {
  message: Record<string, unknown>;
  resolve: (response: unknown) => void;
  reject: (error: unknown) => void;
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
  private serverDataModels = new Map<string, unknown>();
  private renderedSurfaceIds: string[] = [];
  private catalogs = new Map<string, Catalog>();
  private functionValues = new Map<string, Signal<unknown>>();
  private functionFailures = new Map<string, Error>();
  private reportedExpressionErrors = new WeakSet<object>();
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
        version: '1.0',
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
    const catalogId = callFunction.catalogId
      ?? this.surfaces.get(surfaceId)?.catalogId;
    if (!catalogId) {
      return Promise.reject(new Error('Function call requires a catalog'));
    }
    callFunction = { ...callFunction, catalogId };
    const functionCallId = `renderer-${++this.nextFunctionCallId}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCalls.delete(functionCallId);
        reject(
          Object.assign(new Error('Agent function response timed out'), {
            functionCallId,
          }),
        );
      }, 30_000);
      this.pendingCalls.set(functionCallId, {
        surfaceId,
        resolve,
        reject,
        timer,
      });
      void this.sendMessage({
        version: '1.0',
        callAgentFunction: { surfaceId, functionCallId, callFunction },
      }).catch(error => {
        this.completeFunctionCall({
          functionCallId,
          error: { code: 'TRANSPORT_ERROR', message: String(error) },
        });
      });
    });
  }

  /** Read an asynchronous agent expression; undefined represents pending or failed. */
  resolveAgentFunction(
    surfaceId: string,
    callFunction: ProtocolFunctionCall,
    throwOnError = false,
  ): unknown {
    const key = JSON.stringify([surfaceId, callFunction]);
    if (throwOnError && this.functionFailures.has(key)) {
      throw this.functionFailures.get(key);
    }
    let result = this.functionValues.get(key);
    if (!result) {
      result = signal<unknown>(undefined);
      this.functionValues.set(key, result);
      const target = result;
      void this.callAgentFunction(surfaceId, callFunction).then(value => {
        target.value = value;
      }, error => {
        if (!this.functionValues.has(key)) return;
        this.functionFailures.set(
          key,
          error instanceof Error ? error : new Error(String(error)),
        );
        this.reportExpressionError(error, surfaceId);
        target.value = null;
      });
    }
    return result.value;
  }

  private completeFunctionCall(response: FunctionResponse): void {
    const pending = this.pendingCalls.get(response.functionCallId);
    if (!pending) return;
    this.pendingCalls.delete(response.functionCallId);
    clearTimeout(pending.timer);
    if (response.error) {
      pending.reject(
        Object.assign(new Error(response.error.message), {
          functionCallId: response.functionCallId,
        }),
      );
    } else pending.resolve(response.value);
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

  /** Report local evaluation failures without discarding the surface. */
  reportExpressionError(
    error: unknown,
    surfaceId: string,
    code = 'EXPRESSION_ERROR',
  ): void {
    if (error && typeof error === 'object') {
      if (this.reportedExpressionErrors.has(error)) return;
      this.reportedExpressionErrors.add(error);
    }
    void this.sendMessage({
      version: '1.0',
      error: {
        ...(error instanceof Error && 'functionCallId' in error
          ? {
            code: 'EXPRESSION_ERROR',
            functionCallId: String(error.functionCallId),
          }
          : { code, surfaceId }),
        message: error instanceof Error ? error.message : String(error),
      },
    }).catch(error => {
      console.warn('[a2ui] Error reporting failed:', error);
    });
  }

  getAsyncFunctionValue(
    key: string,
    throwOnError = false,
  ): { value: unknown } | undefined {
    if (throwOnError && this.functionFailures.has(key)) {
      throw this.functionFailures.get(key);
    }
    return this.functionValues.get(key);
  }

  /** Cache an asynchronous expression result and notify reactive consumers. */
  resolveAsyncFunction(
    key: string,
    surfaceId: string,
    invoke: () => Promise<unknown>,
  ): unknown {
    let result = this.functionValues.get(key);
    if (!result) {
      result = signal<unknown>(undefined);
      this.functionValues.set(key, result);
      const target = result;
      void invoke().then(value => {
        target.value = value;
      }, error => {
        if (!this.functionValues.has(key)) return;
        this.functionFailures.set(
          key,
          error instanceof Error ? error : new Error(String(error)),
        );
        this.reportExpressionError(error, surfaceId);
        target.value = null;
      });
    }
    return result.value;
  }

  private async callRendererFunction(request: {
    surfaceId?: string;
    functionCallId: string;
    callFunction: ProtocolFunctionCall & { catalogId: string };
  }): Promise<void> {
    const { functionCallId, callFunction, surfaceId } = request;
    let response: FunctionResponse;
    const entry = this.getCatalog(callFunction.catalogId)?.functions.find(fn =>
      fn.name === callFunction['@call']
    );
    if (
      !entry?.impl
      || (entry.definition?.allowedCallers ?? 'rendererOnly') === 'rendererOnly'
      || entry.definition?.requiresUserActivation
      || (surfaceId !== undefined && !this.surfaces.has(surfaceId))
    ) {
      response = {
        functionCallId,
        error: {
          code: 'INVALID_FUNCTION_CALL',
          message: 'Invalid function, catalog, caller, or surface context',
        },
      };
    } else {
      // An omitted surface must never borrow data from an existing surface.
      const evaluator = surfaceId === undefined ? new MessageProcessor() : this;
      if (surfaceId === undefined) {
        for (const [id, catalog] of this.catalogs) {
          evaluator.registerCatalog(id, catalog);
        }
      }
      const contextId = surfaceId ?? '';
      try {
        const value = await executeFunctionCall(
          evaluator,
          callFunction,
          contextId,
          undefined,
          {
            caller: 'agent',
            awaitResult: true,
            throwOnError: true,
          },
        );
        response = { functionCallId, value: value ?? null };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        response = {
          functionCallId,
          error: {
            code: message.startsWith('Invalid function')
              ? 'INVALID_FUNCTION_CALL'
              : 'EXECUTION_ERROR',
            message,
          },
        };
      } finally {
        if (evaluator !== this) evaluator.clearSurfaces();
      }
    }
    await this.sendMessage({
      version: '1.0',
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
    if (data['type'] === 'beginRendering' || data['type'] === 'deleteSurface') {
      const id = data['surfaceId'] as string;
      this.renderedSurfaceIds = this.renderedSurfaceIds.filter(value =>
        value !== id
      );
      if (data['type'] === 'beginRendering') {
        this.renderedSurfaceIds.push(id);
      }
    }
    for (const cb of this.updateListeners) cb(data);
  }

  dispatch(message: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
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
          reject: (error) => {
            if (!called) {
              called = true;
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
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
    this.functionFailures.clear();
    this.surfaces.clear();
    this.serverDataModels.clear();
    this.renderedSurfaceIds = [];
  }

  /**
   * Reconcile a complete message history or state snapshot with live surfaces.
   * Reuses unchanged component resources and preserves local input wherever
   * server data is unchanged. Missing state is removed. RPC envelopes are not
   * replayed. Protocol errors leave the live state unchanged.
   *
   * @returns Whether the replacement was accepted. A rejected replacement
   * reports protocol errors without changing the live state.
   */
  replaceMessages(messages: readonly ServerToClientMessage[]): boolean {
    const target = new MessageProcessor();
    target.catalogs = this.catalogs;
    const errors: RendererToAgentMessage[] = [];
    target.onEvent(({ message, resolve }) => {
      errors.push(message as RendererToAgentMessage);
      resolve([]);
    });
    target.processMessages(messages.filter(message =>
      message.version !== '1.0'
      || !('callRendererFunction' in message
        || 'agentFunctionResponse' in message)
    ));
    if (
      errors.length === 0 && messages.some(message => message.version !== '1.0')
    ) {
      errors.push({
        version: '1.0',
        error: {
          code: 'UNSUPPORTED_VERSION',
          message: 'Only A2UI v1.0 is supported',
        },
      });
    }
    if (errors.length > 0) {
      for (const error of errors) {
        void this.sendMessage(error).catch(() => undefined);
      }
      return false;
    }

    const desiredActive =
      target.renderedSurfaceIds[target.renderedSurfaceIds.length - 1] ?? null;
    for (const surfaceId of [...this.surfaces.keys()]) {
      if (!target.surfaces.has(surfaceId)) {
        this.processMessages([{
          version: '1.0',
          deleteSurface: { surfaceId },
        }]);
      }
    }

    for (const [surfaceId, desired] of target.surfaces) {
      const existing = this.surfaces.get(surfaceId);
      const nextServerData = target.serverDataModels.get(surfaceId);
      const nextData = existing
        ? reconcileDataModel(
          this.serverDataModels.get(surfaceId),
          nextServerData,
          existing.store.getDataModel(),
        )
        : nextServerData;
      this.serverDataModels.set(surfaceId, nextServerData);
      if (!equalJsonValues(desired.store.getDataModel(), nextData)) {
        for (const [id, component] of desired.components) {
          if (component.dataContextPath !== undefined) {
            desired.components.delete(id);
            desired.resources.delete(id);
          }
        }
        desired.store.update('/', nextData);
        target.expandTemplates(desired);
      }

      const surface = this.getOrCreateSurface(surfaceId);
      const catalogChanged = surface.catalogId !== desired.catalogId;
      const previousRoot = surface.rootComponentId;
      if (desired.catalogId === undefined) delete surface.catalogId;
      else surface.catalogId = desired.catalogId;
      surface.sendDataModel = desired.sendDataModel;
      if (desired.metadata === undefined) delete surface.metadata;
      else surface.metadata = desired.metadata;
      const previousComponents = surface.components;
      const changedIds = new Set<string>();
      for (const [id, component] of desired.components) {
        if (!equalJsonValues(previousComponents.get(id), component)) {
          changedIds.add(id);
        }
      }
      for (const id of previousComponents.keys()) {
        if (!desired.components.has(id)) changedIds.add(id);
      }
      const membershipChanged = [...changedIds].some(id =>
        previousComponents.has(id) !== desired.components.has(id)
      );
      const updates: ComponentInstance[] = [];
      const nextComponents = new Map<string, ComponentInstance>();
      for (const [id, component] of desired.components) {
        const previous = previousComponents.get(id);
        const instance = previous && !changedIds.has(id) ? previous : component;
        nextComponents.set(id, instance);
        if (!surface.resources.has(id)) {
          surface.resources.set(id, createResource(id));
        }
        let needsUpdate = catalogChanged || changedIds.has(id)
          // Dynamic child references may resolve from data or functions.
          || (membershipChanged && id === desired.rootComponentId);
        // Parents may read child props (for example weight) while rendering.
        if (!needsUpdate && changedIds.size > 0) {
          const schema = this.getCatalog(
            instance['@catalogId'] ?? surface.catalogId,
          )?.components.find(entry => entry.name === instance.component)
            ?.schema;
          needsUpdate = [...collectComponentReferences(instance, schema)]
            .some(childId => changedIds.has(childId));
        }
        if (needsUpdate) updates.push(instance);
      }
      if (changedIds.size > 0) surface.components = nextComponents;
      for (const id of surface.resources.keys()) {
        if (!surface.components.has(id)) {
          surface.resources.delete(id);
        }
      }
      surface.rootComponentId = desired.rootComponentId ?? null;
      if (!equalJsonValues(surface.store.getDataModel(), nextData)) {
        surface.store.update('/', nextData);
      }
      if (previousRoot && !surface.rootComponentId) {
        this.emitUpdate({
          type: 'deleteSurface',
          surfaceId,
          targetId: previousRoot,
          messageId: `surface:${surfaceId}`,
        });
      } else if (!previousRoot && surface.rootComponentId) {
        this.emitUpdate({
          type: 'beginRendering',
          surfaceId,
          messageId: `surface:${surfaceId}`,
        });
      }
      if (updates.length > 0) {
        this.emitUpdate({ type: 'surfaceUpdate', surfaceId, updates });
      }
    }
    this.renderedSurfaceIds = target.renderedSurfaceIds;
    // A push deletion intentionally leaves the renderer pointing at an empty
    // resource, so its active pointer cannot be inferred from live surfaces.
    this.emitUpdate({
      type: 'replace',
      surfaceId: desiredActive,
      surfaceIds: target.renderedSurfaceIds,
    });
    return true;
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

    return newId;
  }

  processMessages(messages: ServerToClientMessage[]): void {
    for (const message of messages) {
      if (message.version !== '1.0') {
        const source = Object.values(message).find((
          value,
        ): value is Record<string, unknown> =>
          value !== null && typeof value === 'object'
          && ('surfaceId' in value || 'functionCallId' in value)
        );
        const location = typeof source?.['surfaceId'] === 'string'
          ? { surfaceId: source['surfaceId'] }
          : (typeof source?.['functionCallId'] === 'string'
            ? { functionCallId: source['functionCallId'] }
            : undefined);
        if (!location) {
          console.warn('[a2ui] Only A2UI v1.0 is supported', message.version);
          continue;
        }
        void this.sendMessage({
          version: '1.0',
          error: {
            code: 'UNSUPPORTED_VERSION',
            ...location,
            message: 'Only A2UI v1.0 is supported',
          },
        }).catch(error => {
          console.warn('[a2ui] Error reporting failed:', error);
        });
        continue;
      }
      if (
        'createSurface' in message
        && this.surfaces.has(message.createSurface.surfaceId)
      ) {
        void this.sendMessage({
          version: '1.0',
          error: {
            code: 'VALIDATION_FAILED',
            surfaceId: message.createSurface.surfaceId,
            path: '/createSurface/surfaceId',
            message: 'Surface already exists',
          },
        }).catch(error => {
          console.warn('[a2ui] Error reporting failed:', error);
        });
        continue;
      }
      this.processExpandedMessages(expandMessage(message));
    }
  }

  private processExpandedMessages(messages: ServerToClientMessage[]): void {
    for (const message of messages) {
      if ('callRendererFunction' in message) {
        void this.callRendererFunction(message.callRendererFunction).catch(
          error => {
            console.warn('[a2ui] RPC response delivery failed:', error);
          },
        );
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
          version: '1.0',
          error: {
            code: 'VALIDATION_FAILED',
            surfaceId: payload.surfaceId,
            path: '/',
            message: 'Surface must be created exactly once before updates',
          },
        }).catch(error => {
          console.warn('[a2ui] Error reporting failed:', error);
        });
        continue;
      }
      if ('createSurface' in message && message.createSurface) {
        const createSurface = (message as unknown as Record<string, unknown>)[
          'createSurface'
        ] as Record<string, unknown>;
        const surfaceId = createSurface['surfaceId'] as string;
        const surface = this.getOrCreateSurface(surfaceId);
        this.serverDataModels.set(surfaceId, {});
        const catId = createSurface['catalogId'];
        if (catId !== undefined) surface.catalogId = catId as string;
        const sData = createSurface['sendDataModel'];
        if (sData !== undefined) surface.sendDataModel = sData as boolean;
        if (createSurface['metadata']) {
          surface.metadata = createSurface['metadata'] as NonNullable<
            Surface['metadata']
          >;
        }
      }

      if ('updateComponents' in message && message.updateComponents) {
        const { surfaceId, components } = message.updateComponents;
        const surface = this.getOrCreateSurface(surfaceId);

        const proposed = new Map(surface.components);
        for (const component of components) {
          proposed.set(component.id, component);
        }
        const violations = compositionErrors(
          proposed,
          surface.catalogId,
          id => this.getCatalog(id),
        );
        if (violations.length > 0) {
          for (const error of violations) {
            void this.sendMessage({
              version: '1.0',
              error: { ...error, surfaceId },
            }).catch(() => undefined);
          }
          continue;
        }

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
        this.expandTemplates(surface);
      }

      if ('updateDataModel' in message && message.updateDataModel) {
        const { surfaceId, path, value } = message.updateDataModel as {
          surfaceId: string;
          path?: string;
          value?: unknown;
        };
        const surface = this.getOrCreateSurface(surfaceId);

        const resolvedPath = path === '' ? '/' : path ?? '/';
        this.serverDataModels.set(
          surfaceId,
          replaceDataModel(
            this.serverDataModels.get(surfaceId),
            resolvedPath,
            value,
          ),
        );
        surface.store.update(resolvedPath, value);
        this.expandTemplates(surface);
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
            this.functionFailures.delete(key);
          }
        }
        this.surfaces.delete(surfaceId);
        this.serverDataModels.delete(surfaceId);
      }
    }
  }

  private expandTemplates(surface: Surface): void {
    const updates: ComponentInstance[] = [];
    for (const component of surface.components.values()) {
      const template = component.__template;
      if (!template) continue;
      const raw = surface.store.getSignal(template.path).value;
      let data: unknown = raw;
      if (typeof raw === 'string') {
        try {
          data = raw ? JSON.parse(raw) : undefined;
        } catch {
          data = undefined;
        }
      }
      const children: string[] = [];
      const generatedUpdates: ComponentInstance[] = [];
      const clone = (key: string | number) => {
        const id = this.cloneComponentTree(
          template.componentId,
          `:${key}`,
          `${template.path}/${key}`,
          surface,
          generatedUpdates,
        );
        if (id) children.push(id);
      };
      if (Array.isArray(data)) data.forEach((_, index) => clone(index));
      else if (isObject(data)) Object.keys(data).forEach(key => clone(key));
      component['children'] = children;
      updates.push(component);
      updates.push(...generatedUpdates);
    }
    if (updates.length > 0) {
      this.emitUpdate({
        type: 'surfaceUpdate',
        surfaceId: surface.surfaceId,
        updates,
      });
    }
  }
}
