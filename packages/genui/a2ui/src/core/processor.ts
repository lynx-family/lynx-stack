// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type * as v0_9 from '@a2ui/web_core/v0_9';

import type {
  ComponentInstance,
  ServerToClientMessage,
  Surface,
} from './types.js';
import { createResource } from '../utils/createResource.js';
import { SignalStore } from '../utils/SignalStore.js';

export interface A2UIEvent {
  message: Record<string, unknown>;
  resolve: (response: unknown) => void;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export class MessageProcessor {
  surfaces: Map<string, Surface>;
  private listener: ((event: A2UIEvent) => void) | null = null;
  private updateListener: ((data: Record<string, unknown>) => void) | null =
    null;

  constructor() {
    this.surfaces = new Map();
  }

  onUpdate(callback: (data: Record<string, unknown>) => void): void {
    this.updateListener = callback;
  }

  dispatch(message: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve) => {
      if (this.listener) {
        this.listener({ message, resolve });
      } else {
        console.warn('No host listener attached!');
        resolve([]);
      }
    });
  }

  onEvent(callback: (event: A2UIEvent) => void): () => void {
    this.listener = callback;
    return () => {
      this.listener = null;
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

    // Recursively clone the subtree below this component.
    const childIds: string[] = [];
    const anyCloned = cloned as unknown as Record<string, unknown>;

    if (Array.isArray(anyCloned['children'])) {
      for (const childId of anyCloned['children']) {
        if (typeof childId === 'string') {
          childIds.push(childId);
        }
      }
    }

    if (typeof anyCloned['child'] === 'string') {
      childIds.push(anyCloned['child']);
    }

    if (Array.isArray(anyCloned['tabs'])) {
      for (const tab of anyCloned['tabs'] as unknown[]) {
        if (
          tab && typeof tab === 'object' && 'child' in tab
          && typeof (tab as Record<string, unknown>)['child'] === 'string'
        ) {
          childIds.push((tab as Record<string, unknown>)['child'] as string);
        }
      }
    }

    if (typeof anyCloned['trigger'] === 'string') {
      childIds.push(anyCloned['trigger']);
    }

    if (typeof anyCloned['content'] === 'string') {
      childIds.push(anyCloned['content']);
    }

    const newChildren: string[] = [];
    for (const childId of childIds) {
      const newChildId = this.cloneComponentTree(
        childId,
        newIdSuffix,
        dataContextPath,
        surface,
        updates,
      );
      if (newChildId) {
        newChildren.push(newChildId);
      }
    }

    if (Array.isArray(anyCloned['children'])) {
      anyCloned['children'] = newChildren;
    } else if (newChildren.length > 0) {
      anyCloned['children'] = newChildren;
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

    // Primitive at the base path.
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

          // this.resolveComponentPaths(instance, dataContextPath);

          surface.components.set(instance.id!, instance);
          updatesMap.set(instance.id!, instance);

          if (!surface.resources.has(instance.id!)) {
            surface.resources.set(instance.id!, createResource(instance.id!));
          }
        }

        // Determine the root component if not already set.
        if (!surface.rootComponentId) {
          if (surface.components.has('root')) {
            surface.rootComponentId = 'root';
          } else if (updatesMap.size > 0) {
            // Fallback: use the first updated component as root if not specified
            surface.rootComponentId = updatesMap.keys().next().value ?? null;
          }

          if (surface.rootComponentId) {
            if (!surface.resources.has(surface.rootComponentId)) {
              surface.resources.set(
                surface.rootComponentId,
                createResource(surface.rootComponentId),
              );
            }
            // Signal that rendering can begin for this surface.
            if (this.updateListener) {
              this.updateListener({
                type: 'beginRendering',
                surfaceId,
                messageId: (message as { messageId?: string }).messageId,
              });
            }
          }
        }

        const updates = Array.from(updatesMap.values());
        if (updates.length > 0 && this.updateListener) {
          this.updateListener({
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
          // Deletion semantics: we simply clear the value at the path.
          updates.push({ path, value: '' });
        }

        if (updates.length > 0) {
          surface.store.updateBatch(updates);
        }

        // Re-expand any templated containers based on the updated data model.
        const componentUpdates: ComponentInstance[] = [];

        for (const component of surface.components.values()) {
          const anyComponent = component as unknown as Record<string, unknown>;
          const templateInfo = anyComponent['__template'] as
            | { componentId: v0_9.ComponentId; path: string }
            | undefined;

          if (!templateInfo) continue;

          const dataSignal = surface.store.getSignal(templateInfo.path);
          let data: unknown;
          try {
            data = dataSignal.value
              ? JSON.parse(dataSignal.value as string)
              : undefined;
          } catch {
            data = undefined;
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

          if (explicitChildren.length > 0) {
            anyComponent['children'] = explicitChildren;
            componentUpdates.push(component);
            componentUpdates.push(...generatedUpdates);
          }
        }

        if (componentUpdates.length > 0 && this.updateListener) {
          this.updateListener({
            type: 'surfaceUpdate',
            updates: componentUpdates,
            surfaceId,
          });
        }
      }

      if ('deleteSurface' in message && message.deleteSurface) {
        const { surfaceId } = message.deleteSurface;
        const surface = this.surfaces.get(surfaceId);

        if (this.updateListener) {
          this.updateListener({
            type: 'deleteSurface',
            surfaceId,
            targetId: surface?.rootComponentId ?? surfaceId,
            messageId: (message as { messageId?: string }).messageId,
          });
        }

        // Optionally clear local state for this surface.
        this.surfaces.delete(surfaceId);
      }
    }
  }
}

export const processor: MessageProcessor = new MessageProcessor();
