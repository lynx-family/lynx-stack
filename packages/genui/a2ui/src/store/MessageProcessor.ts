// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type * as v0_9 from '@a2ui/web_core/v0_9';

import { createResource } from './Resource.js';
import { SignalStore } from './SignalStore.js';
import type {
  ComponentInstance,
  ServerToClientMessage,
  Surface,
} from './types.js';

export interface A2UIEvent {
  message: Record<string, unknown>;
  resolve: (response: unknown) => void;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

export class MessageProcessor {
  surfaces: Map<string, Surface>;
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
    if (!path) return path;
    if (path.startsWith('/')) {
      return path;
    }
    const context = dataContextPath ?? '';
    const cleanContext = context.endsWith('/') ? context.slice(0, -1) : context;

    if (path.startsWith('./')) {
      const rest = path.substring(2);
      if (!cleanContext) {
        return `/${rest}`;
      }
      return `${cleanContext}/${rest}`;
    }

    if (!cleanContext) {
      return `/${path}`;
    }
    return `${cleanContext}/${path}`;
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
    const clonedChildIds = new Map<string, string>();

    const cloneChild = (childId: string): string | null => {
      const existing = clonedChildIds.get(childId);
      if (existing) return existing;
      const newChildId = this.cloneComponentTree(
        childId,
        newIdSuffix,
        dataContextPath,
        surface,
        updates,
      );
      if (newChildId) {
        clonedChildIds.set(childId, newChildId);
      }
      return newChildId;
    };

    if (Array.isArray(anyCloned['children'])) {
      const newChildren: string[] = [];
      for (const childId of anyCloned['children']) {
        if (typeof childId !== 'string') continue;
        const newChildId = cloneChild(childId);
        if (newChildId) newChildren.push(newChildId);
      }
      anyCloned['children'] = newChildren;
    }

    if (typeof anyCloned['child'] === 'string') {
      const newChildId = cloneChild(anyCloned['child']);
      if (newChildId) anyCloned['child'] = newChildId;
    }

    if (Array.isArray(anyCloned['tabs'])) {
      anyCloned['tabs'] = (anyCloned['tabs'] as unknown[]).map((tab) => {
        if (
          !tab || typeof tab !== 'object' || !('child' in tab)
          || typeof (tab as Record<string, unknown>)['child'] !== 'string'
        ) {
          return tab;
        }

        const tabRecord = tab as Record<string, unknown>;
        const newChildId = cloneChild(tabRecord['child'] as string);
        if (!newChildId) return tab;
        return {
          ...tabRecord,
          child: newChildId,
        };
      });
    }

    if (typeof anyCloned['trigger'] === 'string') {
      const newChildId = cloneChild(anyCloned['trigger']);
      if (newChildId) anyCloned['trigger'] = newChildId;
    }

    if (typeof anyCloned['content'] === 'string') {
      const newChildId = cloneChild(anyCloned['content']);
      if (newChildId) anyCloned['content'] = newChildId;
    }

    return newId;
  }

  private flattenValue(
    value: unknown,
    basePath: string,
    updates: { path: string; value: unknown }[],
  ) {
    const normalizedBase = basePath === '' ? '/' : basePath;

    const push = (path: string, v: unknown) => {
      updates.push({ path, value: v });
    };

    if (Array.isArray(value)) {
      push(normalizedBase, value);
      value.forEach((item, index) => {
        const childPath = normalizedBase === '/'
          ? `/${index}`
          : `${normalizedBase}/${index}`;
        if (isObject(item) || Array.isArray(item)) {
          push(childPath, item);
          this.flattenValue(item, childPath, updates);
        } else {
          updates.push({ path: childPath, value: String(item) });
        }
      });
      return;
    }

    if (isObject(value)) {
      push(normalizedBase, value);
      for (const [key, v] of Object.entries(value)) {
        const childPath = normalizedBase === '/'
          ? `/${key}`
          : `${normalizedBase}/${key}`;
        if (isObject(v) || Array.isArray(v)) {
          push(childPath, v);
          this.flattenValue(v, childPath, updates);
        } else {
          updates.push({ path: childPath, value: String(v) });
        }
      }
      return;
    }

    updates.push({ path: normalizedBase, value: String(value) });
  }

  processMessages(messages: ServerToClientMessage[]): void {
    for (const message of messages) {
      if ('createSurface' in message && message.createSurface) {
        const createSurface = (message as unknown as Record<string, unknown>)[
          'createSurface'
        ] as Record<string, unknown>;
        const surfaceId = createSurface['surfaceId'] as string;
        const surface = this.getOrCreateSurface(surfaceId);
        const catId = createSurface['catalogId'];
        if (catId !== undefined) surface.catalogId = catId as string;
        const t = createSurface['theme'];
        if (t !== undefined) {
          surface.theme = t as Readonly<Record<string, unknown>>;
        }
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
          } else if (updatesMap.size > 0) {
            surface.rootComponentId = updatesMap.keys().next().value ?? null;
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
            // protocol message lacks one (the v0.9 stream does not require
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
      }

      if ('updateDataModel' in message && message.updateDataModel) {
        const { surfaceId, path, value } = message.updateDataModel as {
          surfaceId: string;
          path?: string;
          value?: unknown;
        };
        const surface = this.getOrCreateSurface(surfaceId);

        const updates: { path: string; value: unknown }[] = [];

        if (value !== undefined) {
          const basePath = path && path !== '' ? path : '/';
          this.flattenValue(value, basePath, updates);
        } else if (path) {
          updates.push({ path, value: '' });
        }

        if (updates.length > 0) {
          surface.store.updateBatch(updates);
        }

        const componentUpdates: ComponentInstance[] = [];

        for (const component of surface.components.values()) {
          const anyComponent = component as unknown as Record<string, unknown>;
          const templateInfo = anyComponent['__template'] as
            | { componentId: v0_9.ComponentId; path: string }
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

        this.surfaces.delete(surfaceId);
      }
    }
  }
}
