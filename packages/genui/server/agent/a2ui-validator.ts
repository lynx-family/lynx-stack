// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { z } from 'zod';

import type { A2UICatalog } from './a2ui-catalog';

const ChildTemplateSchema = z
  .object({
    template: z
      .object({
        path: z.string(),
        componentId: z.string(),
      })
      .passthrough(),
  })
  .passthrough();

void ChildTemplateSchema;

const ComponentBase = z
  .object({
    id: z.string().min(1),
    component: z.string().min(1),
  })
  .passthrough();
type A2UIComponent = z.infer<typeof ComponentBase> & {
  action?: unknown;
  child?: unknown;
  children?: unknown;
  content?: unknown;
  tabs?: unknown;
  trigger?: unknown;
};

const CreateSurfaceMessage = z.object({
  version: z.literal('v0.9'),
  createSurface: z
    .object({
      surfaceId: z.string().min(1),
      catalogId: z.string().min(1),
      theme: z.record(z.string(), z.any()).optional(),
      sendDataModel: z.boolean().optional(),
    })
    .passthrough(),
}).strict();

const UpdateComponentsMessage = z.object({
  version: z.literal('v0.9'),
  updateComponents: z
    .object({
      surfaceId: z.string().min(1),
      components: z.array(ComponentBase).min(1),
    })
    .passthrough(),
}).strict();

const UpdateDataModelMessage = z.object({
  version: z.literal('v0.9'),
  updateDataModel: z
    .object({
      surfaceId: z.string().min(1),
      path: z.string().optional(),
      value: z.any().optional(),
    })
    .passthrough(),
}).strict();

const DeleteSurfaceMessage = z.object({
  version: z.literal('v0.9'),
  deleteSurface: z
    .object({
      surfaceId: z.string().min(1),
    })
    .passthrough(),
}).strict();

const A2UIMessage = z.union([
  CreateSurfaceMessage,
  UpdateComponentsMessage,
  UpdateDataModelMessage,
  DeleteSurfaceMessage,
]);

export const A2UIMessageArray = z.array(A2UIMessage).min(1);
export type A2UIMessage = z.infer<typeof A2UIMessage>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function hasActionName(value: unknown): value is { name: string } {
  if (!isRecord(value)) return false;
  const candidate = value as { name?: unknown };
  return typeof candidate.name === 'string' && candidate.name.length > 0;
}

export interface ValidationResult {
  ok: boolean;
  messages: A2UIMessage[];
  errors: string[];
}

function stripCodeFenceWrapper(text: string): string {
  let body = text.trim();
  if (body.startsWith('```')) {
    const firstLineEnd = body.indexOf('\n');
    const lastFenceStart = body.lastIndexOf('```');
    if (firstLineEnd !== -1 && lastFenceStart > firstLineEnd) {
      body = body.slice(firstLineEnd + 1, lastFenceStart).trim();
    }
  }
  return body;
}

function unescapeInvalidBackticks(text: string): string {
  // Some models emit "\`" inside JSON strings, which is not a valid JSON escape.
  return text.replaceAll('\\`', '`');
}

function extractFirstBalancedJsonArray(text: string): string | null {
  const start = text.indexOf('[');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '[') {
      depth++;
      continue;
    }

    if (ch === ']') {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function normalizeCatalogId(catalogId: string): string {
  const trimmed = catalogId.trim();
  return trimmed.replace(/^`+/u, '').replace(/`+$/u, '').trim();
}

export function extractJsonArray(text: string): unknown {
  if (!text || typeof text !== 'string') return null;
  const body = unescapeInvalidBackticks(stripCodeFenceWrapper(text));
  const candidates = [body, extractFirstBalancedJsonArray(body)]
    .filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next candidate
    }
  }

  return null;
}

export function validateA2UIOutput(
  raw: string,
  catalog: A2UICatalog,
): ValidationResult {
  const errors: string[] = [];
  const parsed = extractJsonArray(raw);
  if (parsed === null) {
    return {
      ok: false,
      messages: [],
      errors: [
        'Response was not valid JSON. Output MUST be a raw JSON array of A2UI messages – no prose, no code fences.',
      ],
    };
  }
  const arr = A2UIMessageArray.safeParse(parsed);
  if (!arr.success) {
    for (const issue of arr.error.issues) {
      errors.push(
        `Schema violation at ${
          issue.path.join('.') || '<root>'
        }: ${issue.message}`,
      );
    }
    return { ok: false, messages: [], errors };
  }

  const messages = arr.data.map((message) => {
    if (!('createSurface' in message) || !message.createSurface) {
      return message;
    }

    return {
      ...message,
      createSurface: {
        ...message.createSurface,
        catalogId: normalizeCatalogId(message.createSurface.catalogId),
      },
    };
  });
  const knownComponents = new Set(catalog.components.map((c) => c.name));
  const requiresAction = new Set(
    catalog.components.filter((c) => c.requiresAction).map((c) => c.name),
  );

  // structural checks ----------------------------------------------------
  const firstMessage = messages[0];
  const firstIsCreate = firstMessage
    && 'createSurface' in firstMessage
    && firstMessage.createSurface;
  if (firstIsCreate) {
    const catalogId = firstMessage.createSurface.catalogId;
    if (catalogId !== catalog.id) {
      errors.push(
        `createSurface.catalogId must equal "${catalog.id}"; received "${catalogId}".`,
      );
    }
  } else {
    errors.push('The first message MUST be a createSurface.');
  }

  const surfaces = new Set<string>();
  const componentsBySurface = new Map<string, Map<string, A2UIComponent>>();
  const allPaths: { surfaceId: string; path: string }[] = [];
  const providedPaths: { surfaceId: string; path: string }[] = [];

  for (const msg of messages) {
    if ('createSurface' in msg && msg.createSurface) {
      surfaces.add(msg.createSurface.surfaceId);
    } else if ('updateComponents' in msg && msg.updateComponents) {
      const sId = msg.updateComponents.surfaceId;
      if (!surfaces.has(sId)) {
        errors.push(
          `updateComponents references surfaceId "${sId}" before createSurface.`,
        );
      }
      const bucket = componentsBySurface.get(sId)
        ?? new Map<string, A2UIComponent>();
      for (const rawComponent of msg.updateComponents.components) {
        const comp = rawComponent as A2UIComponent;
        if (!knownComponents.has(comp.component)) {
          errors.push(
            `Unknown component "${comp.component}" (id=${comp.id}). Allowed: ${
              [...knownComponents].join(', ')
            }.`,
          );
        }
        if (bucket.has(comp.id)) {
          errors.push(
            `Duplicate component id "${comp.id}" in surface "${sId}".`,
          );
        }
        bucket.set(comp.id, comp);
        if (requiresAction.has(comp.component)) {
          const action = comp.action;
          if (!hasActionName(action)) {
            errors.push(
              `${comp.component} (id=${comp.id}) MUST carry action.name.`,
            );
          }
        }
        const componentPaths: string[] = [];
        collectPaths(comp, componentPaths);
        for (const path of componentPaths) {
          allPaths.push({ surfaceId: sId, path });
        }
      }
      componentsBySurface.set(sId, bucket);
    } else if ('updateDataModel' in msg && msg.updateDataModel) {
      const sId = msg.updateDataModel.surfaceId;
      if (!surfaces.has(sId)) {
        errors.push(
          `updateDataModel references surfaceId "${sId}" before createSurface.`,
        );
      }
      const updateDataModel = msg.updateDataModel as
        & typeof msg.updateDataModel
        & { value?: unknown };
      if (
        !('value' in updateDataModel) || updateDataModel.value === undefined
      ) {
        errors.push(
          `updateDataModel for surface "${sId}" must include a defined value.`,
        );
        continue;
      }
      const basePath = updateDataModel.path ?? '/';
      for (
        const p of flattenProvidedPaths(
          basePath,
          updateDataModel.value,
        )
      ) {
        providedPaths.push({ surfaceId: sId, path: p });
      }
    } else if ('deleteSurface' in msg && msg.deleteSurface) {
      surfaces.delete(msg.deleteSurface.surfaceId);
    }
  }

  // root existence -------------------------------------------------------
  for (const [sId, bucket] of componentsBySurface) {
    if (!bucket.has('root')) {
      errors.push(
        `Surface "${sId}" has components but no component with id "root".`,
      );
    }
    // child references exist
    for (const comp of bucket.values()) {
      for (const ref of collectChildRefs(comp)) {
        if (!bucket.has(ref)) {
          errors.push(
            `Component "${comp.id}" references missing child "${ref}" in surface "${sId}".`,
          );
        }
      }
    }
  }

  // path references -> data model coverage -------------------------------
  const providedBySurface = new Map<string, Set<string>>();
  for (const provided of providedPaths) {
    const bucket = providedBySurface.get(provided.surfaceId)
      ?? new Set<string>();
    bucket.add(provided.path);
    providedBySurface.set(provided.surfaceId, bucket);
  }
  for (const referenced of allPaths) {
    const providedSet = providedBySurface.get(referenced.surfaceId)
      ?? new Set<string>();
    const hasMatch = [...providedSet].some(
      (provided) =>
        referenced.path === provided
        || provided.startsWith(
          referenced.path.endsWith('/')
            ? referenced.path
            : referenced.path + '/',
        ),
    );
    if (!hasMatch) {
      errors.push(
        `Path "${referenced.path}" is referenced by a component in surface "${referenced.surfaceId}" but not populated by any updateDataModel message for that surface.`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    messages: errors.length === 0 ? messages : [],
    errors,
  };
}

function collectPaths(node: unknown, acc: string[]): void {
  if (!isRecord(node) && !Array.isArray(node)) return;
  if (Array.isArray(node)) {
    for (const item of node) collectPaths(item, acc);
    return;
  }
  const record = node as Record<string, unknown> & { path?: unknown };
  if (typeof record.path === 'string' && Object.keys(record).length <= 2) {
    acc.push(record.path);
    return;
  }
  for (const value of Object.values(record)) collectPaths(value, acc);
}

function collectChildRefs(comp: A2UIComponent): string[] {
  const refs: string[] = [];
  if (typeof comp.child === 'string') refs.push(comp.child);
  if (typeof comp.trigger === 'string') refs.push(comp.trigger);
  if (typeof comp.content === 'string') refs.push(comp.content);
  if (Array.isArray(comp.children)) {
    for (const c of comp.children) {
      if (typeof c === 'string') refs.push(c);
    }
  } else if (isRecord(comp.children)) {
    const children = comp.children as { template?: unknown };
    const template = children.template;
    if (isRecord(template)) {
      const childTemplate = template as { componentId?: unknown };
      if (typeof childTemplate.componentId === 'string') {
        refs.push(childTemplate.componentId);
      }
    }
  }
  if (Array.isArray(comp.tabs)) {
    for (const tab of comp.tabs) {
      if (isRecord(tab)) {
        const tabRecord = tab as { child?: unknown };
        if (typeof tabRecord.child === 'string') {
          refs.push(tabRecord.child);
        }
      }
    }
  }
  return refs;
}

function flattenProvidedPaths(basePath: string, value: unknown): string[] {
  const normalized = basePath.startsWith('/') ? basePath : '/' + basePath;
  const paths: string[] = [];
  walk(normalized === '/' ? '' : normalized, value, paths);
  return paths.length > 0 ? paths : [normalized];
}

function walk(prefix: string, value: unknown, acc: string[]): void {
  if (value === null || value === undefined) {
    if (prefix) acc.push(prefix || '/');
    return;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    acc.push(prefix || '/');
    return;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    acc.push(prefix || '/');
    return;
  }
  for (const [k, v] of entries) {
    walk(`${prefix}/${k}`, v, acc);
  }
}

export function formatErrorsForModel(errors: string[]): string {
  return [
    'Your previous response failed A2UI validation with the following errors:',
    ...errors.map((e) => `- ${e}`),
    '',
    'Return a CORRECTED JSON array that fixes every error. Emit only the JSON',
    'array – no prose, no code fences.',
  ].join('\n');
}
