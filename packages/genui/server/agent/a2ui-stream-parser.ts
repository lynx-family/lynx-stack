// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { A2UIMessageSchema, isLoadableImageSource } from './a2ui-validator.js';
import type { A2UIMessage } from './a2ui-validator.js';

type A2UIUpdateComponentsMessage = Extract<
  A2UIMessage,
  { updateComponents: unknown }
>;
type A2UICreateSurfaceMessage = Extract<
  A2UIMessage,
  { createSurface: unknown }
>;
type A2UIComponent = A2UIUpdateComponentsMessage['updateComponents'][
  'components'
][number];
type ComponentRecord = A2UIComponent & Record<string, unknown>;

const ROOT_COMPONENT_ID = 'root';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isUpdateComponentsMessage(
  message: A2UIMessage,
): message is A2UIUpdateComponentsMessage {
  return 'updateComponents' in message && Boolean(message.updateComponents);
}

function toStreamRenderableComponent(
  component: Record<string, unknown> & { id: string; component: string },
  hasLoadingComponent: boolean,
  isImageSourceAllowed?: (source: string) => boolean,
  isOpenUrlAllowed?: (source: string) => boolean,
): (Record<string, unknown> & { id: string; component: string }) | null {
  if (
    isOpenUrlAllowed
    && containsUntrustedOpenURL(component, isOpenUrlAllowed)
  ) {
    return hasLoadingComponent ? loadingComponent(component.id) : null;
  }
  if (component.component !== 'Image') return component;
  if (
    isLoadableImageSource(component.url)
    && (!isImageSourceAllowed || isImageSourceAllowed(component.url))
  ) {
    return component;
  }
  return hasLoadingComponent ? loadingComponent(component.id) : null;
}

function loadingComponent(
  id: string,
): Record<string, unknown> & { id: string; component: string } {
  return { id, component: 'Loading', variant: 'block' };
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

function createSurfaceLoadingMessage(surfaceId: string): A2UIMessage {
  return {
    version: 'v1.0',
    updateComponents: {
      surfaceId,
      components: [loadingComponent(ROOT_COMPONENT_ID)],
    },
  };
}

export class A2UIProtocolMessageStreamParser {
  private buffer = '';
  private cursor = 0;
  private depth = 0;
  private inArray = false;
  private inString = false;
  private escaped = false;
  private itemStart = -1;

  public constructor(
    private readonly options: {
      hasLoadingComponent?: boolean | undefined;
      isImageSourceAllowed?: ((source: string) => boolean) | undefined;
      isOpenUrlAllowed?: ((source: string) => boolean) | undefined;
    } = {},
  ) {}

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
        continue;
      }

      if (ch !== '}' && ch !== ']') continue;

      if (this.depth === 2 && ch === '}' && this.itemStart !== -1) {
        const candidate = this.buffer.slice(this.itemStart, i + 1);
        try {
          const parsed = A2UIMessageSchema.safeParse(JSON.parse(candidate));
          if (parsed.success) {
            if ('createSurface' in parsed.data && parsed.data.createSurface) {
              messages.push(...this.prepareCreateSurfaceMessage(parsed.data));
            } else if (isUpdateComponentsMessage(parsed.data)) {
              const prepared = this.prepareUpdateComponentsMessage(
                parsed.data,
              );
              if (prepared) messages.push(prepared);
            } else {
              messages.push(parsed.data);
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
      }
    }

    this.cursor = this.buffer.length;
    return messages;
  }

  private prepareCreateSurfaceMessage(
    message: A2UICreateSurfaceMessage,
  ): A2UIMessage[] {
    const { components: rawComponents, ...surface } = message.createSurface;
    const components = this.sanitizeComponents(rawComponents ?? []) ?? [];
    const surfaceId = surface.surfaceId;

    const createSurface: A2UICreateSurfaceMessage = {
      ...message,
      createSurface: components.length > 0
        ? { ...surface, components }
        : surface,
    } as A2UICreateSurfaceMessage;

    return components.some((component) => component.id === ROOT_COMPONENT_ID)
        || !this.options.hasLoadingComponent
      ? [createSurface]
      : [createSurface, createSurfaceLoadingMessage(surfaceId)];
  }

  private prepareUpdateComponentsMessage(
    message: A2UIUpdateComponentsMessage,
  ): A2UIMessage | null {
    const components = this.sanitizeComponents(
      message.updateComponents.components,
    );
    if (!components) return null;
    return {
      ...message,
      updateComponents: {
        ...message.updateComponents,
        components,
      },
    };
  }

  private sanitizeComponents(
    components: A2UIComponent[],
  ): ComponentRecord[] | null {
    const sanitized: ComponentRecord[] = [];
    for (const component of components) {
      const next = toStreamRenderableComponent(
        component,
        this.options.hasLoadingComponent === true,
        this.options.isImageSourceAllowed,
        this.options.isOpenUrlAllowed,
      );
      if (!next) return null;
      sanitized.push(next as ComponentRecord);
    }
    return sanitized;
  }
}
