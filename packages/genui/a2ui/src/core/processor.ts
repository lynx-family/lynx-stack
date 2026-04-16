import * as v0_9 from '@a2ui/web_core/v0_9';
import { type Surface, type ServerToClientMessage, type ComponentInstance } from './types';
import { SignalStore } from "../utils/SignalStore";
import { createResource } from "../utils/createResource";

export type A2UIEvent = {
  message: any;
  resolve: (response: any) => void;
};

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}

export class MessageProcessor {
  surfaces: Map<string, Surface>;
  private listener: ((event: A2UIEvent) => void) | null = null;
  private updateListener: ((data: any) => void) | null = null;

  constructor() {
    this.surfaces = new Map();
  }

  onUpdate(callback: (data: any) => void): void {
    this.updateListener = callback;
  }

  dispatch(message: any): Promise<any> {
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
    const context = dataContextPath || '';
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
    const cloned: ComponentInstance = JSON.parse(JSON.stringify(original));
    (cloned as unknown as any).id = newId;
    cloned.dataContextPath = dataContextPath;

    surface.components.set(newId, cloned);
    updates.push(cloned);

    if (!surface.resources.has(newId)) {
      surface.resources.set(newId, createResource(newId));
    }

    // Recursively clone the subtree below this component.
    const childIds: string[] = [];
    const anyCloned = cloned as any;

    if (Array.isArray(anyCloned.children)) {
      for (const childId of anyCloned.children) {
        if (typeof childId === 'string') {
          childIds.push(childId);
        }
      }
    }

    if (typeof anyCloned.child === 'string') {
      childIds.push(anyCloned.child);
    }

    if (Array.isArray(anyCloned.tabs)) {
      for (const tab of anyCloned.tabs) {
        if (tab && typeof tab.child === 'string') {
          childIds.push(tab.child);
        }
      }
    }

    if (typeof anyCloned.trigger === 'string') {
      childIds.push(anyCloned.trigger);
    }

    if (typeof anyCloned.content === 'string') {
      childIds.push(anyCloned.content);
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

    if (Array.isArray(anyCloned.children)) {
      anyCloned.children = newChildren;
    } else if (newChildren.length > 0) {
      anyCloned.children = newChildren;
    }

    return newId;
  }

  private flattenValue(value: unknown, basePath: string, updates: { path: string; value: any }[]) {
    const normalizedBase = basePath === '' ? '/' : basePath;

    const push = (path: string, v: unknown) => {
      updates.push({ path, value: v });
    };

    if (Array.isArray(value)) {
      push(normalizedBase, value);
      value.forEach((item, index) => {
        const childPath = normalizedBase === '/' ? `/${index}` : `${normalizedBase}/${index}`;
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
        const childPath = normalizedBase === '/' ? `/${key}` : `${normalizedBase}/${key}`;
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
        const { surfaceId, catalogId, theme, sendDataModel } = message.createSurface;
        const surface = this.getOrCreateSurface(surfaceId);
        surface.catalogId = catalogId;
        surface.theme = theme;
        surface.sendDataModel = sendDataModel;
      }

      if ('updateComponents' in message && message.updateComponents) {
        const { surfaceId, components } = message.updateComponents;
        const surface = this.getOrCreateSurface(surfaceId);

        const updatesMap = new Map<string, ComponentInstance>();

        for (const item of components as ComponentInstance[]) {
          if (!item.id) continue;
          const existing = surface.components.get(item.id);
          const dataContextPath = (existing as any)?.dataContextPath;
          const instance: ComponentInstance = {
            ...(item as any),
            dataContextPath,
          };

          const anyInstance = instance as any;
          if (
            anyInstance.children &&
            !Array.isArray(anyInstance.children) &&
            typeof anyInstance.children === 'object' &&
            typeof anyInstance.children.componentId === 'string' &&
            typeof anyInstance.children.path === 'string'
          ) {
            const templatePath = this.resolvePath(anyInstance.children.path, dataContextPath);
            instance.__template = {
              componentId: anyInstance.children.componentId,
              path: templatePath,
            };
          }

          // this.resolveComponentPaths(instance, dataContextPath);

          surface.components.set(instance.id as string, instance);
          updatesMap.set(instance.id as string, instance);

          if (!surface.resources.has(instance.id as string)) {
            surface.resources.set(instance.id as string, createResource(instance.id as string));
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
            if (!surface.resources.has(surface.rootComponentId!)) {
              surface.resources.set(surface.rootComponentId!, createResource(surface.rootComponentId!));
            }
            // Signal that rendering can begin for this surface.
            if (this.updateListener) {
              this.updateListener({
                type: 'beginRendering',
                surfaceId,
                messageId: (message as any).messageId,
              });
            }
          }
        }

        const updates = Array.from(updatesMap.values());
        if (updates.length > 0) {
          if (this.updateListener) {
            this.updateListener({
              type: 'surfaceUpdate',
              updates,
              surfaceId,
            });
          }
        }
      }

      if ('updateDataModel' in message && message.updateDataModel) {
        const { surfaceId, path, value } = message.updateDataModel as any;
        const surface = this.getOrCreateSurface(surfaceId);

        const updates: { path: string; value: any }[] = [];

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
          const anyComponent = component as any;
          const templateInfo = anyComponent.__template as
            | { componentId: v0_9.ComponentId; path: string }
            | undefined;

          if (!templateInfo) continue;

          const dataSignal = surface.store.getSignal(templateInfo.path);
          let data: unknown;
          try {
            data = dataSignal.value ? JSON.parse(dataSignal.value) : undefined;
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
            anyComponent.children = explicitChildren;
            componentUpdates.push(component);
            componentUpdates.push(...generatedUpdates);
          }
        }

        if (componentUpdates.length > 0) {
          if (this.updateListener) {
            this.updateListener({
              type: 'surfaceUpdate',
              updates: componentUpdates,
              surfaceId,
            });
          }
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
            messageId: (message as any).messageId,
          });
        }

        // Optionally clear local state for this surface.
        this.surfaces.delete(surfaceId);
      }
    }
  }
}

export const processor: MessageProcessor = new MessageProcessor();
