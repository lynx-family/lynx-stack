// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { A2UIMessage } from './a2ui-validator';

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

function isLoadableImageSource(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const src = value.trim();
  if (!src) return false;
  if (/^(?:https?:|data:image\/|blob:|file:)/iu.test(src)) return true;
  if (/^(?:\/|\.\/|\.\.\/)/u.test(src)) return true;
  return /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/iu.test(src);
}

function isStreamRenderableComponent(
  component: Record<string, unknown>,
): boolean {
  if (component.component !== 'Image') return true;
  const url = component.url;
  if (isRecord(url) && typeof url.path === 'string') return true;
  return isLoadableImageSource(url);
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

function createPlaceholderComponent(
  id: string,
  expectedComponent?: string,
): ComponentRecord {
  if (expectedComponent === 'Image') {
    return {
      id: placeholderId(id),
      component: 'Image',
      url: '',
      variant: 'mediumFeature',
    };
  }

  return {
    id: placeholderId(id),
    component: 'Text',
    text: 'Loading...',
    variant: 'caption',
  };
}

function expectedPlaceholderComponent(
  childId: string,
  seen: Map<string, ComponentRecord>,
): string | undefined {
  const component = seen.get(childId);
  if (component) return component.component;
  if (
    /image|photo|picture|thumbnail|avatar|cover|poster|hero/iu.test(childId)
  ) {
    return 'Image';
  }
  return undefined;
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
    const placeholder = createPlaceholderComponent(
      id,
      expectedPlaceholderComponent(id, seen),
    );
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
): ComponentRecord[] {
  const root = seen.get(ROOT_COMPONENT_ID) ?? seen.values().next().value;
  if (!root) return [];

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
    components.push(replaceMissingChildRefs(component, seen, placeholders));
  }
  components.push(...placeholders.values());
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
          if (isA2UIMessage(parsed) && !isUpdateComponentsMessage(parsed)) {
            messages.push(parsed);
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
    if (!isStreamRenderableComponent(parsed)) return;

    const surfaceId = sniffUpdateComponentsSurfaceId(
      this.buffer.slice(0, start),
    );
    if (!surfaceId) return;
    const seen = this.seenComponentsBySurface.get(surfaceId)
      ?? new Map<string, ComponentRecord>();
    seen.set(parsed.id, parsed as ComponentRecord);
    this.seenComponentsBySurface.set(surfaceId, seen);

    const components = buildReachableComponentSnapshot(seen);
    if (components.length === 0) return;

    messages.push({
      version: 'v0.9',
      updateComponents: {
        surfaceId,
        components,
      },
    });
  }
}

export function splitA2UIProtocolMessages(
  messages: A2UIMessage[],
): A2UIMessage[] {
  const parser = new A2UIProtocolMessageStreamParser();
  const replayMessages = parser.push(JSON.stringify(messages));
  return replayMessages.length > 0 ? replayMessages : messages;
}
