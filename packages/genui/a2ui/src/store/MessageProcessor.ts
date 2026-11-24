// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Signal } from '@lynx-js/react-signals';
import { signal } from '@lynx-js/react-signals';

import {
  collectComponentReferences,
  compositionErrors,
  describeComponentReferences,
} from './composition.js';
import { expandMessage, replaceDataModel } from './protocol.js';
import { reconcileDataModel } from './reconcile.js';
import { resolveBindingPath } from './resolveDynamic.js';
import { executeFunctionCall } from './resolveFunctionCall.js';
import { createResource } from './Resource.js';
import { SignalStore } from './SignalStore.js';
import {
  adoptSurfaceState,
  indexReferences,
  surfaceState,
  templateChildren,
} from './surfaceState.js';
import {
  affectsParent,
  expandTemplates,
  templatesAreStale,
} from './templates.js';
import type { TemplateHost } from './templates.js';
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

const SURFACE_PAYLOADS = [
  'createSurface',
  'updateComponents',
  'updateDataModel',
  'deleteSurface',
] as const;

/**
 * Where a surface message is too malformed to apply, as a JSON Pointer, or
 * `undefined` when its envelope has the shape the handlers rely on.
 */
function malformedAt(
  message: Record<string, unknown>,
): { path: string; surfaceId?: string } | undefined {
  for (const kind of SURFACE_PAYLOADS) {
    if (!(kind in message)) continue;
    const payload = message[kind];
    if (!isObject(payload) || Array.isArray(payload)) {
      return { path: `/${kind}` };
    }
    const surfaceId = payload['surfaceId'];
    if (typeof surfaceId !== 'string') return { path: `/${kind}/surfaceId` };
    const components = payload['components'];
    if (
      kind === 'updateComponents'
        ? !Array.isArray(components)
        : (kind === 'createSurface' && components !== undefined
          && !Array.isArray(components))
    ) {
      return { path: `/${kind}/components`, surfaceId };
    }
    const path = payload['path'];
    if (
      kind === 'updateDataModel' && path !== undefined
      && typeof path !== 'string'
    ) {
      return { path: `/${kind}/path`, surfaceId };
    }
  }
  return undefined;
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
  private defaultCatalogId: string | undefined;
  private warnedCatalogs = new Set<string>();
  /** Set on the scratch processor a replacement is validated in. */
  private quiet = false;
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

  /**
   * Register a trusted catalog for qualified v1.0 function resolution.
   *
   * With `default`, the catalog also serves surfaces and components that
   * name no catalog, which the v1.0 schema allows.
   */
  registerCatalog(
    catalogId: string,
    catalog: Catalog,
    options: { default?: boolean } = {},
  ): void {
    this.catalogs.set(catalogId, catalog);
    if (options.default) this.defaultCatalogId = catalogId;
  }

  /**
   * The identifier a catalog lookup uses: the given one, or the default
   * catalog's when none is given.
   *
   * @internal
   */
  resolveCatalogId(catalogId: string | undefined): string | undefined {
    return catalogId ?? this.defaultCatalogId;
  }

  /**
   * Resolve a catalog by its exact wire identifier. An omitted identifier
   * resolves to the default catalog when one is registered.
   */
  getCatalog(catalogId: string | undefined): Catalog | undefined {
    const id = this.resolveCatalogId(catalogId);
    return id === undefined ? undefined : this.catalogs.get(id);
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
    const catalogId = this.resolveCatalogId(
      callFunction.catalogId ?? this.surfaces.get(surfaceId)?.catalogId,
    );
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
    // A broken expression fails again every time it is evaluated. The agent
    // needs to hear about it once per state it produced, not once per render.
    if (
      code === 'EXPRESSION_ERROR'
      && !(error instanceof Error && 'functionCallId' in error)
    ) {
      const surface = this.surfaces.get(surfaceId);
      if (surface) {
        const reported = surfaceState(surface).reportedErrors;
        const text = error instanceof Error ? error.message : String(error);
        if (reported.has(text)) return;
        reported.add(text);
      }
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
    target.defaultCatalogId = this.defaultCatalogId;
    target.quiet = true;
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
        // Local input changes which items exist, so the snapshot's template
        // instances have to follow the data that will actually be shown.
        desired.store.update('/', nextData);
        target.syncTemplates(desired);
      }
      const desiredState = surfaceState(desired);

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
          || (membershipChanged
            && (id === desired.rootComponentId
              || desiredState.dynamicReferrers.has(id)));
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
      // The snapshot's bookkeeping describes exactly the components that
      // were just committed, under the same ids.
      adoptSurfaceState(surface, desired);
      if (!existing || catalogChanged) this.checkCatalog(surface);
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

  private readonly templateHost: TemplateHost = {
    resolvePath: (path, dataContextPath) =>
      this.resolvePath(path, dataContextPath),
    index: (surface, id, instance) =>
      this.indexComponent(surface, id, instance),
  };

  /** Keep the reference index in step with a stored or removed component. */
  private indexComponent(
    surface: Surface,
    id: string,
    instance: ComponentInstance | undefined,
  ): void {
    const state = surfaceState(surface);
    if (!instance) {
      indexReferences(state, id, undefined);
      return;
    }
    const schema = this.getCatalog(instance['@catalogId'] ?? surface.catalogId)
      ?.components.find(entry => entry.name === instance.component)?.schema;
    indexReferences(state, id, describeComponentReferences(instance, schema));
  }

  /** Tell the agent, once, that a surface names a catalog nobody registered. */
  private checkCatalog(surface: Surface): void {
    const catalogId = surface.catalogId;
    // A bare processor has no notion of the catalogs a host supports.
    if (
      this.quiet || this.defaultCatalogId === undefined
      || catalogId === undefined || this.catalogs.has(catalogId)
    ) {
      return;
    }
    if (!this.warnedCatalogs.has(catalogId)) {
      this.warnedCatalogs.add(catalogId);
      console.warn(
        `[a2ui] Surface "${surface.surfaceId}" uses catalog "${catalogId}", `
          + 'which is not registered. Its components render as unsupported.',
      );
    }
    this.reportProtocolError({
      code: 'VALIDATION_FAILED',
      surfaceId: surface.surfaceId,
      path: '/createSurface/catalogId',
      message: `Unknown catalog "${catalogId}"`,
    });
  }

  private reportProtocolError(
    error: { code: string; message: string; surfaceId?: string; path?: string },
  ): void {
    void this.sendMessage({ version: '1.0', error }).catch(failure => {
      console.warn('[a2ui] Error reporting failed:', failure);
    });
  }

  /**
   * Apply messages in order. A message that cannot be applied is reported
   * and skipped; the messages after it are still applied.
   */
  processMessages(messages: readonly ServerToClientMessage[]): void {
    for (const message of messages) {
      try {
        this.processMessage(message);
      } catch (error) {
        console.error('[a2ui] Failed to process message:', error);
      }
    }
  }

  private processMessage(message: ServerToClientMessage): void {
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
        return;
      }
      this.reportProtocolError({
        code: 'UNSUPPORTED_VERSION',
        ...location,
        message: 'Only A2UI v1.0 is supported',
      });
      return;
    }
    const malformed = malformedAt(message as Record<string, unknown>);
    if (malformed) {
      if (malformed.surfaceId === undefined) {
        console.warn('[a2ui] Ignoring a malformed message at', malformed.path);
        return;
      }
      this.reportProtocolError({
        code: 'VALIDATION_FAILED',
        surfaceId: malformed.surfaceId,
        path: malformed.path,
        message: 'Malformed message',
      });
      return;
    }
    if (
      'createSurface' in message
      && this.surfaces.has(message.createSurface.surfaceId)
    ) {
      this.reportProtocolError({
        code: 'VALIDATION_FAILED',
        surfaceId: message.createSurface.surfaceId,
        path: '/createSurface/surfaceId',
        message: 'Surface already exists',
      });
      return;
    }
    for (const part of expandMessage(message)) this.applyMessage(part);
  }

  private applyMessage(message: ServerToClientMessage): void {
    if ('callRendererFunction' in message) {
      void this.callRendererFunction(message.callRendererFunction).catch(
        error => {
          console.warn('[a2ui] RPC response delivery failed:', error);
        },
      );
      return;
    }
    if ('agentFunctionResponse' in message) {
      this.completeFunctionCall(message.agentFunctionResponse);
      return;
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
      this.reportProtocolError({
        code: 'VALIDATION_FAILED',
        surfaceId: payload.surfaceId,
        path: '/',
        message: 'Surface must be created exactly once before updates',
      });
      return;
    }
    if ('createSurface' in message && message.createSurface) {
      this.createSurface(message.createSurface);
    }
    if ('updateComponents' in message && message.updateComponents) {
      this.updateComponents(
        message.updateComponents.surfaceId,
        message.updateComponents.components,
        (message as { messageId?: string }).messageId,
      );
    }
    if ('updateDataModel' in message && message.updateDataModel) {
      this.updateDataModel(message.updateDataModel);
    }
    if ('deleteSurface' in message && message.deleteSurface) {
      this.deleteSurface(
        message.deleteSurface.surfaceId,
        (message as { messageId?: string }).messageId,
      );
    }
  }

  private createSurface(
    createSurface: {
      surfaceId: string;
      catalogId?: string;
      sendDataModel?: boolean;
      metadata?: { extensions?: Record<string, unknown> };
    },
  ): void {
    const surface = this.getOrCreateSurface(createSurface.surfaceId);
    this.serverDataModels.set(createSurface.surfaceId, {});
    if (createSurface.catalogId !== undefined) {
      surface.catalogId = createSurface.catalogId;
    }
    if (createSurface.sendDataModel !== undefined) {
      surface.sendDataModel = createSurface.sendDataModel;
    }
    if (createSurface.metadata) surface.metadata = createSurface.metadata;
    this.checkCatalog(surface);
  }

  private updateComponents(
    surfaceId: string,
    components: readonly ComponentInstance[],
    messageId: string | undefined,
  ): void {
    const surface = this.getOrCreateSurface(surfaceId);
    const state = surfaceState(surface);
    state.reportedErrors.clear();

    // A definition identical to the one already held is a resend. Applying
    // it would re-render its component for nothing.
    const isResend = (item: ComponentInstance) => {
      const source = state.sources.get(item.id);
      return source !== undefined && !state.generated.has(item.id)
        && (source === item || equalJsonValues(source, item));
    };
    const pending = components.filter(item =>
      isObject(item) && typeof item.id === 'string' && item.id !== ''
      && !isResend(item)
    );
    if (pending.length === 0) return;

    const proposed = new Map(surface.components);
    for (const component of pending) proposed.set(component.id, component);
    const violations = compositionErrors(
      proposed,
      surface.catalogId,
      id => this.getCatalog(id),
    );
    if (violations.length > 0) {
      for (const error of violations) {
        this.reportProtocolError({ ...error, surfaceId });
      }
      return;
    }

    const changed = new Map<string, ComponentInstance>();
    const parentsToNotify = new Set<string>();
    let membershipChanged = false;
    let templatesChanged = false;
    for (const item of pending) {
      const existing = surface.components.get(item.id);
      const instance: ComponentInstance = { ...item };
      if (existing?.dataContextPath !== undefined) {
        instance.dataContextPath = existing.dataContextPath;
      }
      const template = templateChildren(instance);
      if (template) {
        instance.__template = {
          componentId: template.componentId,
          path: this.resolvePath(template.path, instance.dataContextPath),
        };
        // An unchanged template keeps its instances; expansion below then
        // has nothing to report for it.
        const previous = existing?.__template;
        if (
          previous?.componentId === instance.__template.componentId
          && previous.path === instance.__template.path
          && Array.isArray(existing?.['children'])
        ) {
          instance['children'] = existing['children'];
        }
      }
      if (
        template || state.templates.has(item.id)
        || state.templateSources.has(item.id)
      ) {
        templatesChanged = true;
      }
      if (!existing) membershipChanged = true;
      if (affectsParent(existing, instance)) parentsToNotify.add(item.id);

      surface.components.set(item.id, instance);
      state.sources.set(item.id, item);
      state.generated.delete(item.id);
      if (!surface.resources.has(item.id)) {
        surface.resources.set(item.id, createResource(item.id));
      }
      this.indexComponent(surface, item.id, instance);
      changed.set(item.id, instance);
    }

    if (!surface.rootComponentId && surface.components.has('root')) {
      surface.rootComponentId = 'root';
      // Fall back to a surface-derived id so consumers that key
      // resources by `messageId` still get a non-empty key when the
      // protocol message lacks one (the v1.0 stream does not require
      // `messageId` on every message).
      this.emitUpdate({
        type: 'beginRendering',
        surfaceId,
        messageId: messageId ?? `surface:${surfaceId}`,
      });
    }

    // A component renders its own changes. Its parents render again only
    // when they could not have rendered it before, or lay it out by a prop
    // that changed. This is what makes a child that arrives in a later
    // message appear.
    const updates = new Map(changed);
    const notify = (id: string) => {
      const instance = surface.components.get(id);
      if (instance && !updates.has(id)) updates.set(id, instance);
    };
    for (const id of parentsToNotify) {
      for (const parentId of state.referrers.get(id) ?? []) notify(parentId);
    }
    if (membershipChanged) {
      // A child slot bound to data may now resolve to a component that exists.
      for (const id of state.dynamicReferrers) notify(id);
    }
    this.emitUpdate({
      type: 'surfaceUpdate',
      updates: [...updates.values()],
      surfaceId,
    });

    if (templatesChanged) this.syncTemplates(surface);
  }

  private updateDataModel(
    update: { surfaceId: string; path?: string; value?: unknown },
  ): void {
    const surface = this.getOrCreateSurface(update.surfaceId);
    const state = surfaceState(surface);
    state.reportedErrors.clear();
    const path = update.path === '' ? '/' : update.path ?? '/';
    this.serverDataModels.set(
      update.surfaceId,
      replaceDataModel(
        this.serverDataModels.get(update.surfaceId),
        path,
        update.value,
      ),
    );
    surface.store.update(path, update.value);
    if (templatesAreStale(surface, state)) this.syncTemplates(surface);
  }

  private deleteSurface(
    surfaceId: string,
    messageId: string | undefined,
  ): void {
    const surface = this.surfaces.get(surfaceId);
    // Same fallback as the synthesized `beginRendering` event so
    // consumers that key lifecycle state by `messageId` always see
    // a non-empty key when the protocol message lacks one.
    this.emitUpdate({
      type: 'deleteSurface',
      surfaceId,
      targetId: surface?.rootComponentId ?? surfaceId,
      messageId: messageId ?? `surface:${surfaceId}`,
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

  /** Re-expand templates and announce the instances that changed. */
  private syncTemplates(surface: Surface): void {
    const updates = expandTemplates(
      surface,
      surfaceState(surface),
      this.templateHost,
    );
    if (updates.length > 0) {
      this.emitUpdate({
        type: 'surfaceUpdate',
        surfaceId: surface.surfaceId,
        updates,
      });
    }
  }
}
