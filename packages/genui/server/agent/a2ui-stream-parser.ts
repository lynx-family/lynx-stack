// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { A2UIMessage } from './a2ui-validator';
import { isLoadableImageSource } from './image-resolver';

type A2UIUpdateComponentsMessage = Extract<
  A2UIMessage,
  { updateComponents: unknown }
>;
type A2UIComponent = A2UIUpdateComponentsMessage['updateComponents'][
  'components'
][number];
type ComponentRecord = A2UIComponent & Record<string, unknown>;

const ROOT_COMPONENT_ID = 'root';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (isRecord(value)) {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

function hasRecordKey(
  value: Record<string, unknown>,
  key: string,
): value is Record<string, Record<string, unknown>> {
  return isRecord(value[key]);
}

function isA2UIMessage(value: unknown): value is A2UIMessage {
  if (!isRecord(value) || value.version !== 'v0.9') return false;

  if (hasRecordKey(value, 'createSurface')) {
    const createSurface = value.createSurface;
    return typeof createSurface.surfaceId === 'string'
      && typeof createSurface.catalogId === 'string';
  }

  if (hasRecordKey(value, 'updateComponents')) {
    const updateComponents = value.updateComponents;
    return typeof updateComponents.surfaceId === 'string'
      && Array.isArray(updateComponents.components);
  }

  if (hasRecordKey(value, 'updateDataModel')) {
    const updateDataModel = value.updateDataModel;
    return typeof updateDataModel.surfaceId === 'string';
  }

  if (hasRecordKey(value, 'deleteSurface')) {
    return typeof value.deleteSurface.surfaceId === 'string';
  }

  return false;
}

function isUpdateComponentsMessage(
  message: A2UIMessage,
): message is A2UIUpdateComponentsMessage {
  return 'updateComponents' in message && Boolean(message.updateComponents);
}

function isA2UIComponent(value: unknown): value is Record<string, unknown> & {
  id: string;
  component: string;
} {
  return isRecord(value)
    && typeof value.id === 'string'
    && value.id.length > 0
    && typeof value.component === 'string'
    && value.component.length > 0;
}

function toStreamRenderableComponent(
  component: Record<string, unknown> & { id: string; component: string },
  pendingImagePaths?: Set<string>,
): Record<string, unknown> & { id: string; component: string } {
  if (component.component !== 'Image') return component;
  const url = component.url;
  if (isRecord(url) && typeof url.path === 'string') {
    if (!pendingImagePaths?.has(normalizePointer(url.path))) {
      return component;
    }
  } else if (isLoadableImageSource(url)) return component;
  return {
    id: component.id,
    component: 'Loading',
    variant: 'block',
  };
}

function sniffUpdateComponentsSurfaceId(buffer: string): string | null {
  const updateIndex = buffer.lastIndexOf('"updateComponents"');
  if (updateIndex === -1) return null;
  const fragment = buffer.slice(updateIndex);
  const match = /"surfaceId"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/u.exec(
    fragment,
  );
  if (!match) return null;
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return null;
  }
}

function placeholderId(id: string): string {
  return `loading_${id}`;
}

function normalizePointer(path: string): string {
  if (!path || path === '/') return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

function appendPointer(path: string, segment: string): string {
  const encoded = segment.replace(/~/gu, '~0').replace(/\//gu, '~1');
  return path === '/' ? `/${encoded}` : `${path}/${encoded}`;
}

function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/gu, '/').replace(/~0/gu, '~');
}

function lastPointerSegment(path: string): string {
  const parts = normalizePointer(path).split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  return last ? decodePointerSegment(last) : '';
}

function isImageLikeKey(key: string): boolean {
  return /(?:^|[-_])(?:image|photo|picture|avatar|cover|poster|artwork|thumbnail)(?:$|[-_])/iu
    .test(key);
}

function updatePendingImagePathsFromData(
  value: unknown,
  path: string,
  pendingImagePaths: Set<string>,
): void {
  const normalizedPath = normalizePointer(path);
  const key = lastPointerSegment(normalizedPath);
  if (typeof value === 'string' && isImageLikeKey(key)) {
    if (isLoadableImageSource(value)) {
      pendingImagePaths.delete(normalizedPath);
    } else {
      pendingImagePaths.add(normalizedPath);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      updatePendingImagePathsFromData(
        item,
        appendPointer(normalizedPath, String(index)),
        pendingImagePaths,
      )
    );
    return;
  }

  if (!isRecord(value)) return;
  for (const [childKey, child] of Object.entries(value)) {
    updatePendingImagePathsFromData(
      child,
      appendPointer(normalizedPath, childKey),
      pendingImagePaths,
    );
  }
}

function createPlaceholderComponent(id: string): ComponentRecord {
  return {
    id: placeholderId(id),
    component: 'Loading',
    variant: 'block',
  };
}

function createSurfaceLoadingMessage(surfaceId: string): A2UIMessage {
  return {
    version: 'v0.9',
    updateComponents: {
      surfaceId,
      components: [
        {
          id: ROOT_COMPONENT_ID,
          component: 'Loading',
          variant: 'block',
        },
      ],
    },
  };
}

function collectChildRefs(component: ComponentRecord): string[] {
  const refs: string[] = [];
  const child = component.child;
  if (typeof child === 'string') refs.push(child);

  const trigger = component.trigger;
  if (typeof trigger === 'string') refs.push(trigger);

  const content = component.content;
  if (typeof content === 'string') refs.push(content);

  const children = component.children;
  if (Array.isArray(children)) {
    for (const item of children) {
      if (typeof item === 'string') refs.push(item);
    }
  } else if (isRecord(children)) {
    const componentId = children.componentId;
    if (typeof componentId === 'string') refs.push(componentId);
    const template = children.template;
    if (isRecord(template) && typeof template.componentId === 'string') {
      refs.push(template.componentId);
    }
  }

  const tabs = component.tabs;
  if (Array.isArray(tabs)) {
    for (const tab of tabs) {
      if (isRecord(tab) && typeof tab.child === 'string') {
        refs.push(tab.child);
      }
    }
  }

  return refs;
}

function replaceMissingChildRefs(
  component: ComponentRecord,
  seen: Map<string, ComponentRecord>,
  placeholders: Map<string, ComponentRecord>,
): ComponentRecord {
  const next = { ...component };

  const replaceRef = (id: string) => {
    if (seen.has(id)) return id;
    const placeholder = createPlaceholderComponent(id);
    placeholders.set(placeholder.id, placeholder);
    return placeholder.id;
  };

  if (typeof next.child === 'string') {
    next.child = replaceRef(next.child);
  }
  if (typeof next.trigger === 'string') {
    next.trigger = replaceRef(next.trigger);
  }
  if (typeof next.content === 'string') {
    next.content = replaceRef(next.content);
  }
  if (Array.isArray(next.children)) {
    const children = next.children as unknown[];
    next.children = children.map((item) =>
      typeof item === 'string' ? replaceRef(item) : item
    );
  } else if (isRecord(next.children)) {
    const children = { ...next.children };
    if (typeof children.componentId === 'string') {
      children.componentId = replaceRef(children.componentId);
    }
    const template = children.template;
    if (isRecord(template) && typeof template.componentId === 'string') {
      children.template = {
        ...template,
        componentId: replaceRef(template.componentId),
      };
    }
    next.children = children;
  }
  if (Array.isArray(next.tabs)) {
    const tabs = next.tabs as unknown[];
    next.tabs = tabs.map((tab) => {
      if (!isRecord(tab) || typeof tab.child !== 'string') return tab;
      return { ...tab, child: replaceRef(tab.child) };
    });
  }

  return next;
}

function buildReachableComponentSnapshot(
  seen: Map<string, ComponentRecord>,
  options: { placeholders: boolean },
): ComponentRecord[] {
  const root = seen.get(ROOT_COMPONENT_ID);
  if (!root) return [...seen.values()];

  const reachableIds = new Set<string>();
  const visit = (id: string) => {
    if (reachableIds.has(id)) return;
    const component = seen.get(id);
    if (!component) return;
    reachableIds.add(id);
    for (const childId of collectChildRefs(component)) {
      visit(childId);
    }
  };
  visit(root.id);

  const placeholders = new Map<string, ComponentRecord>();
  const components: ComponentRecord[] = [];
  for (const component of seen.values()) {
    if (!reachableIds.has(component.id)) continue;
    components.push(
      options.placeholders
        ? replaceMissingChildRefs(component, seen, placeholders)
        : component,
    );
  }
  if (options.placeholders) components.push(...placeholders.values());
  return components;
}

export class A2UIProtocolMessageStreamParser {
  private buffer = '';
  private cursor = 0;
  private depth = 0;
  private inArray = false;
  private inString = false;
  private escaped = false;
  private itemStart = -1;
  private objectStack: number[] = [];
  private seenComponentsBySurface = new Map<
    string,
    Map<string, ComponentRecord>
  >();
  private yieldedComponentContentBySurface = new Map<
    string,
    Map<string, string>
  >();
  private pendingImagePathsBySurface = new Map<string, Set<string>>();
  private createdSurfaceIds = new Set<string>();

  public push(chunk: string): A2UIMessage[] {
    this.buffer += chunk;
    const messages: A2UIMessage[] = [];

    for (let i = this.cursor; i < this.buffer.length; i++) {
      const ch = this.buffer[i];

      if (this.inString) {
        if (this.escaped) {
          this.escaped = false;
        } else if (ch === '\\') {
          this.escaped = true;
        } else if (ch === '"') {
          this.inString = false;
        }
        continue;
      }

      if (ch === '"') {
        this.inString = true;
        continue;
      }

      if (!this.inArray) {
        if (ch === '[') {
          this.inArray = true;
          this.depth = 1;
        }
        continue;
      }

      if (ch === '{' || ch === '[') {
        this.depth++;
        if (this.depth === 2 && ch === '{') {
          this.itemStart = i;
        }
        if (ch === '{') {
          this.objectStack.push(i);
        }
        continue;
      }

      if (ch !== '}' && ch !== ']') continue;

      const objectStart = ch === '}' ? this.objectStack.pop() : undefined;
      if (objectStart !== undefined) {
        this.pushComponentMessage(objectStart, i, messages);
      }

      if (this.depth === 2 && ch === '}' && this.itemStart !== -1) {
        const candidate = this.buffer.slice(this.itemStart, i + 1);
        try {
          const parsed = JSON.parse(candidate) as unknown;
          if (isA2UIMessage(parsed)) {
            if ('createSurface' in parsed && parsed.createSurface) {
              this.createdSurfaceIds.add(parsed.createSurface.surfaceId);
              messages.push(parsed);
              messages.push(
                createSurfaceLoadingMessage(parsed.createSurface.surfaceId),
              );
            } else if ('updateDataModel' in parsed && parsed.updateDataModel) {
              this.updatePendingImagePaths(parsed);
              messages.push(parsed);
            } else if (!isUpdateComponentsMessage(parsed)) {
              messages.push(parsed);
            }
          }
        } catch {
          // Keep scanning. Final validation still owns complete-response errors.
        }
        this.itemStart = -1;
      }

      this.depth--;
      if (this.depth <= 0) {
        this.inArray = false;
        this.depth = 0;
        this.objectStack = [];
      }
    }

    this.cursor = this.buffer.length;
    return messages;
  }

  private pushComponentMessage(
    start: number,
    end: number,
    messages: A2UIMessage[],
  ): void {
    const componentsIndex = this.buffer.lastIndexOf('"components"', start);
    if (componentsIndex === -1) return;
    const updateIndex = this.buffer.lastIndexOf(
      '"updateComponents"',
      componentsIndex,
    );
    if (updateIndex === -1) return;

    const between = this.buffer.slice(componentsIndex, start);
    if (!between.includes('[')) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(this.buffer.slice(start, end + 1)) as unknown;
    } catch {
      return;
    }
    if (!isA2UIComponent(parsed)) return;

    const surfaceId = sniffUpdateComponentsSurfaceId(
      this.buffer.slice(0, start),
    );
    if (!surfaceId) return;
    const renderable = toStreamRenderableComponent(
      parsed,
      this.pendingImagePathsBySurface.get(surfaceId),
    );
    const seen = this.seenComponentsBySurface.get(surfaceId)
      ?? new Map<string, ComponentRecord>();
    seen.set(renderable.id, renderable);
    this.seenComponentsBySurface.set(surfaceId, seen);

    const components = buildReachableComponentSnapshot(seen, {
      placeholders: this.createdSurfaceIds.has(surfaceId),
    });
    if (components.length === 0) return;

    const yielded = this.yieldedComponentContentBySurface.get(surfaceId)
      ?? new Map<string, string>();
    const changedComponents = components.filter((component) => {
      const content = stableStringify(component);
      return yielded.get(component.id) !== content;
    });
    if (changedComponents.length === 0) return;

    for (const component of changedComponents) {
      yielded.set(component.id, stableStringify(component));
    }
    this.yieldedComponentContentBySurface.set(surfaceId, yielded);

    messages.push({
      version: 'v0.9',
      updateComponents: {
        surfaceId,
        components: changedComponents,
      },
    });
  }

  private updatePendingImagePaths(
    message: Extract<
      A2UIMessage,
      { updateDataModel: unknown }
    >,
  ): void {
    const dataModel = message.updateDataModel as {
      surfaceId: string;
      path?: string;
      value?: unknown;
    };
    if (!('value' in dataModel)) return;
    const pendingImagePaths = this.pendingImagePathsBySurface.get(
      dataModel.surfaceId,
    ) ?? new Set<string>();
    updatePendingImagePathsFromData(
      dataModel.value,
      dataModel.path ?? '/',
      pendingImagePaths,
    );
    this.pendingImagePathsBySurface.set(dataModel.surfaceId, pendingImagePaths);
  }
}

export function splitA2UIProtocolMessages(
  messages: A2UIMessage[],
): A2UIMessage[] {
  const parser = new A2UIProtocolMessageStreamParser();
  return parser.push(JSON.stringify(messages));
}
