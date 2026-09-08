// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { isLoadableImageSource } from './a2ui-validator.js';
import type { A2UIMessage } from './a2ui-validator.js';

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
  isImageSourceAllowed?: (source: string) => boolean,
  isOpenUrlAllowed?: (source: string) => boolean,
): Record<string, unknown> & { id: string; component: string } {
  if (
    isOpenUrlAllowed
    && containsUntrustedOpenURL(component, isOpenUrlAllowed)
  ) {
    return {
      id: component.id,
      component: 'Loading',
      variant: 'block',
    };
  }
  if (component.component !== 'Image') return component;
  if (
    isLoadableImageSource(component.url)
    && (!isImageSourceAllowed || isImageSourceAllowed(component.url))
  ) {
    return component;
  }
  return {
    id: component.id,
    component: 'Loading',
    variant: 'block',
  };
}

function containsUntrustedOpenURL(
  value: unknown,
  isOpenUrlAllowed: (source: string) => boolean,
): boolean {
  if (Array.isArray(value)) {
    return value.some((item) =>
      containsUntrustedOpenURL(item, isOpenUrlAllowed)
    );
  }
  if (!isRecord(value)) return false;
  if (value.call === 'openUrl') {
    if (!isRecord(value.args)) return true;
    const url = value.args.url;
    if (typeof url !== 'string' || !isOpenUrlAllowed(url)) return true;
  }
  return Object.values(value).some((item) =>
    containsUntrustedOpenURL(item, isOpenUrlAllowed)
  );
}

function createPlaceholderComponent(id: string): ComponentRecord {
  return { id, component: 'Loading', variant: 'block' };
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

interface JsonFrame {
  start: number;
  kind: 'array' | 'object';
  role:
    | 'messages'
    | 'message'
    | 'update'
    | 'components'
    | 'component'
    | 'other';
  key: string;
  expectingKey: boolean;
  surfaceId?: string;
}

function childFrameRole(
  frame: JsonFrame,
  kind: JsonFrame['kind'],
): JsonFrame['role'] {
  if (frame.role === 'messages' && kind === 'object') return 'message';
  if (
    frame.role === 'message' && frame.key === 'updateComponents'
    && kind === 'object'
  ) return 'update';
  if (
    frame.role === 'update' && frame.key === 'components' && kind === 'array'
  ) return 'components';
  if (frame.role === 'components' && kind === 'object') return 'component';
  return 'other';
}

interface SurfaceComponents {
  seen: Map<string, ComponentRecord>;
  dirty: Set<string>;
  reachable: Set<string>;
  yielded: Map<string, string>;
}

export class A2UIProtocolMessageStreamParser {
  private buffer = '';
  private cursor = 0;
  private inString = false;
  private escaped = false;
  private stringStart = 0;
  private frames: JsonFrame[] = [];
  private surfaces = new Map<string, SurfaceComponents>();
  private createdSurfaceIds = new Set<string>();

  public constructor(
    private readonly options: {
      isImageSourceAllowed?: ((source: string) => boolean) | undefined;
      isOpenUrlAllowed?: ((source: string) => boolean) | undefined;
    } = {},
  ) {}

  public push(chunk: string): A2UIMessage[] {
    this.buffer += chunk;
    const messages: A2UIMessage[] = [];
    for (let i = this.cursor; i < this.buffer.length; i++) {
      const ch = this.buffer[i];
      const frame = this.frames.at(-1);
      if (this.inString) {
        if (this.escaped) {
          this.escaped = false;
        } else if (ch === '\\') {
          this.escaped = true;
        } else if (ch === '"') {
          this.inString = false;
          if (frame?.kind === 'object') {
            if (frame.expectingKey) {
              frame.key = this.parse(this.stringStart, i) as string;
              frame.expectingKey = false;
            } else if (frame.role === 'update' && frame.key === 'surfaceId') {
              const value = this.parse(this.stringStart, i);
              if (typeof value === 'string') frame.surfaceId = value;
            }
          }
        }
        continue;
      }
      if (!frame) {
        if (ch === '[') this.openFrame(i, 'array', 'messages');
        continue;
      }
      if (ch === '"') {
        this.inString = true;
        this.stringStart = i;
      } else if (ch === ',' && frame.kind === 'object') {
        frame.expectingKey = true;
        frame.key = '';
      } else if (ch === '{' || ch === '[') {
        const kind = ch === '{' ? 'object' : 'array';
        const role = childFrameRole(frame, kind);
        this.openFrame(i, kind, role);
      } else if (ch === '}' || ch === ']') {
        this.frames.pop();
        if (frame.role === 'component') {
          const update = this.frames.at(-2);
          if (update?.surfaceId) {
            this.addComponent(update.surfaceId, this.parse(frame.start, i));
          }
        } else if (frame.role === 'message') {
          this.completeMessage(this.parse(frame.start, i), messages);
        }
      }
    }
    this.flushComponents(messages);

    // Retain only the unfinished message. Completed messages and tool phases
    // must not make later component parsing repeatedly scan the full response.
    const keepFrom =
      this.frames.find((frame) => frame.role === 'message')?.start
        ?? this.buffer.length;
    this.buffer = this.buffer.slice(keepFrom);
    for (const frame of this.frames) frame.start -= keepFrom;
    this.stringStart -= keepFrom;
    this.cursor = this.buffer.length;
    return messages;
  }

  private openFrame(
    start: number,
    kind: JsonFrame['kind'],
    role: JsonFrame['role'],
  ): void {
    this.frames.push({
      start,
      kind,
      role,
      key: '',
      expectingKey: kind === 'object',
    });
  }

  private parse(start: number, end: number): unknown {
    try {
      return JSON.parse(this.buffer.slice(start, end + 1)) as unknown;
    } catch {
      // Whole-response validation still owns malformed model output.
      return undefined;
    }
  }

  private completeMessage(value: unknown, messages: A2UIMessage[]): void {
    if (!isA2UIMessage(value)) return;
    if (isUpdateComponentsMessage(value)) {
      // Also handle legal JSON with surfaceId after components. A component is
      // only streamed early when its enclosing update has already identified it.
      for (const component of value.updateComponents.components) {
        this.addComponent(value.updateComponents.surfaceId, component);
      }
      this.flushComponents(messages);
      return;
    }
    // Preserve component/data-model ordering even when one model chunk contains
    // several protocol messages or suspended/resumed arrays.
    this.flushComponents(messages);
    if ('createSurface' in value && value.createSurface) {
      const id = value.createSurface.surfaceId;
      this.surfaces.delete(id);
      this.createdSurfaceIds.add(id);
      messages.push(value, createSurfaceLoadingMessage(id));
    } else {
      if ('deleteSurface' in value && value.deleteSurface) {
        const id = value.deleteSurface.surfaceId;
        this.surfaces.delete(id);
        this.createdSurfaceIds.delete(id);
      }
      messages.push(value);
    }
  }

  private addComponent(surfaceId: string, value: unknown): void {
    if (!isA2UIComponent(value)) return;
    const component = toStreamRenderableComponent(
      value,
      this.options.isImageSourceAllowed,
      this.options.isOpenUrlAllowed,
    ) as ComponentRecord;
    let state = this.surfaces.get(surfaceId);
    if (!state) {
      state = {
        seen: new Map(),
        dirty: new Set(),
        reachable: new Set(),
        yielded: new Map(),
      };
      this.surfaces.set(surfaceId, state);
    }
    state.seen.set(component.id, component);
    state.dirty.add(component.id);
  }

  private flushComponents(messages: A2UIMessage[]): void {
    for (const [surfaceId, state] of this.surfaces) {
      if (state.dirty.size === 0) continue;
      const reachable = new Set<string>();
      const pending = state.seen.has(ROOT_COMPONENT_ID)
        ? [ROOT_COMPONENT_ID]
        : [...state.seen.keys()];
      while (pending.length > 0) {
        const id = pending.pop()!;
        if (reachable.has(id)) continue;
        const component = state.seen.get(id);
        if (!component) continue;
        reachable.add(id);
        pending.push(...collectChildRefs(component));
      }
      for (const id of reachable) {
        if (!state.reachable.has(id)) state.dirty.add(id);
      }
      state.reachable = reachable;
      const placeholders = new Map<string, ComponentRecord>();
      const candidates: ComponentRecord[] = [];
      for (const id of state.dirty) {
        if (!reachable.has(id)) continue;
        const component = state.seen.get(id)!;
        candidates.push(component);
        if (this.createdSurfaceIds.has(surfaceId)) {
          for (const child of collectChildRefs(component)) {
            if (!state.seen.has(child)) {
              // Keep the real child id: its eventual definition replaces the
              // Loading resource without rewriting/resending its parent.
              placeholders.set(child, createPlaceholderComponent(child));
            }
          }
        }
      }
      state.dirty.clear();
      candidates.push(...placeholders.values());
      const changed: ComponentRecord[] = [];
      for (const component of candidates) {
        const content = stableStringify(component);
        if (state.yielded.get(component.id) === content) continue;
        state.yielded.set(component.id, content);
        changed.push(component);
      }
      if (changed.length > 0) {
        messages.push({
          version: 'v0.9',
          updateComponents: { surfaceId, components: changed },
        });
      }
    }
  }
}
