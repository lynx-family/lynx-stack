// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { z } from 'zod';

import type {
  A2UICatalog,
  A2UIComponentProp,
  A2UIComponentSpec,
  JsonSchema,
} from './a2ui-catalog';

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
const ComponentsList = z.array(ComponentBase).min(1);
const ExtensionKey = z.string().regex(
  /^[\p{XID_Start}_]\p{XID_Continue}*$/u,
  'extension keys must be Unicode identifiers',
);
export const A2UIExtensionsMetadataSchema = z
  .object({
    extensions: z.record(ExtensionKey, z.unknown()).optional(),
  })
  .strict();
type A2UIComponent = z.infer<typeof ComponentBase> & {
  action?: unknown;
  child?: unknown;
  children?: unknown;
  content?: unknown;
  tabs?: unknown;
  trigger?: unknown;
};

const CreateSurfaceMessage = z.object({
  version: z.literal('v1.0'),
  createSurface: z
    .object({
      surfaceId: z.string().min(1),
      catalogId: z.string().min(1),
      sendDataModel: z.boolean().optional(),
      components: ComponentsList.optional(),
      dataModel: z.record(z.string(), z.unknown()).optional(),
      metadata: A2UIExtensionsMetadataSchema.optional(),
    })
    .strict(),
}).strict();

const UpdateComponentsMessage = z.object({
  version: z.literal('v1.0'),
  updateComponents: z
    .object({
      surfaceId: z.string().min(1),
      components: ComponentsList,
    })
    .strict(),
}).strict();

const UpdateDataModelMessage = z.object({
  version: z.literal('v1.0'),
  updateDataModel: z
    .object({
      surfaceId: z.string().min(1),
      path: z.string().optional(),
      value: z.unknown(),
    })
    .strict()
    .superRefine((update, context) => {
      if (
        !Object.prototype.hasOwnProperty.call(update, 'value')
        || update.value === undefined
      ) {
        context.addIssue({
          code: 'custom',
          message: 'value is required and must be defined',
          path: ['value'],
        });
      }
    }),
}).strict();

const DeleteSurfaceMessage = z.object({
  version: z.literal('v1.0'),
  deleteSurface: z
    .object({
      surfaceId: z.string().min(1),
    })
    .strict(),
}).strict();

export const A2UIMessageSchema = z.union([
  CreateSurfaceMessage,
  UpdateComponentsMessage,
  UpdateDataModelMessage,
  DeleteSurfaceMessage,
]);

export const A2UIMessageArray = z.array(A2UIMessageSchema).min(1);
export type A2UIMessage = z.infer<typeof A2UIMessageSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export interface ValidationResult {
  ok: boolean;
  messages: A2UIMessage[];
  errors: string[];
  warnings: string[];
}

export interface ValidationOptions {
  requireCreateSurface?: boolean;
  existingSurfaceIds?: string[];
  existingDataModelBySurface?: Record<string, unknown>;
  isImageSourceAllowed?: ((source: string) => boolean) | undefined;
  isOpenUrlAllowed?: ((source: string) => boolean) | undefined;
}

export interface A2UIValidationDebugEntry {
  error: string;
  path: string;
  value: unknown;
}

export interface A2UIValidationDebugData {
  parsedType: string;
  entries: A2UIValidationDebugEntry[];
  rawText?: string;
}

export interface A2UIValidationDebugOptions {
  includeRaw?: boolean;
  previewChars?: number;
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

function unescapeInvalidJsonEscapes(text: string): string {
  // LLMs occasionally add a stray backslash before punctuation or whitespace
  // inside JSON strings. Remove only escapes that JSON itself does not allow.
  return text.replace(/\\(?!["\\/bfnrtu])/g, '');
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
      // Retry only after the original parse fails, so valid JSON strings with
      // literal backslashes are not changed before parsing.
    }

    const repairedCandidate = unescapeInvalidJsonEscapes(candidate);
    if (repairedCandidate === candidate) continue;
    try {
      return JSON.parse(repairedCandidate);
    } catch {
      // try the next candidate
    }
  }

  return null;
}

export function getA2UIValidationDebugData(
  raw: string,
  errors: string[],
  options: A2UIValidationDebugOptions = {},
): A2UIValidationDebugData {
  const parsed = extractJsonArray(raw);
  const parsedType = parsed === null
    ? 'null'
    : (Array.isArray(parsed)
      ? 'array'
      : typeof parsed);
  const hasJsonParseError = errors.some((error) =>
    error.startsWith('Response was not valid JSON.')
  );
  const rawText = options.includeRaw
    ? raw
    : (hasJsonParseError
      ? previewText(raw, options.previewChars ?? 500)
      : undefined);
  return {
    parsedType,
    ...(rawText === undefined ? {} : { rawText }),
    entries: errors.map((error) => {
      const path = extractValidationErrorPath(error);
      return {
        error,
        path,
        value: valueAtPath(parsed, path),
      };
    }),
  };
}

export function validateA2UIOutput(
  raw: string,
  catalog: A2UICatalog,
  options: ValidationOptions = {},
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
      warnings: [],
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
    return { ok: false, messages: [], errors, warnings: [] };
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
  const componentSpecs = new Map(catalog.components.map((c) => [c.name, c]));
  const knownFunctions = new Set(
    (catalog.functions ?? []).map((fn) => fn.name),
  );
  const warnings: string[] = [];

  // structural checks ----------------------------------------------------
  const firstMessage = messages[0];
  const firstIsCreate = firstMessage
    && 'createSurface' in firstMessage
    && firstMessage.createSurface;
  const requireCreateSurface = options.requireCreateSurface ?? true;
  if (!firstIsCreate && requireCreateSurface) {
    errors.push('The first message MUST be a createSurface.');
  }

  const activeSurfaces = new Set<string>(options.existingSurfaceIds ?? []);
  const everSeenSurfaces = new Set(activeSurfaces);
  const componentsBySurface = new Map<string, Map<string, A2UIComponent>>();
  const dataModelBySurface = new Map<string, unknown>();
  const allPaths: { surfaceId: string; path: string }[] = [];
  const templatePaths: { surfaceId: string; path: string }[] = [];

  for (
    const [surfaceId, dataModel] of Object.entries(
      options.existingDataModelBySurface ?? {},
    )
  ) {
    dataModelBySurface.set(surfaceId, dataModel);
  }

  const validateComponentsForSurface = (
    surfaceId: string,
    rawComponents: A2UIComponent[],
    messageKind: 'createSurface' | 'updateComponents',
  ): void => {
    const bucket = componentsBySurface.get(surfaceId)
      ?? new Map<string, A2UIComponent>();
    const idsInMessage = new Set<string>();
    for (const comp of rawComponents) {
      for (const fn of collectFunctionCalls(comp, `component.${comp.id}`)) {
        if (fn.hasLegacyReturnType) {
          errors.push(
            `Function call at ${fn.path} must not include legacy "returnType" in v1.0.`,
          );
        }
        if (fn.invalidArgs) {
          errors.push(
            `Function call at ${fn.path} must use an object for "args" when it is present.`,
          );
        }
        if (
          fn.catalogId !== undefined
          && fn.catalogId !== catalog.id
        ) {
          errors.push(
            `Function call at ${fn.path} references catalogId ${
              JSON.stringify(fn.catalogId)
            }, but this server only supports the active catalog ${
              JSON.stringify(catalog.id)
            }.`,
          );
        }
        if (!knownFunctions.has(fn.name)) {
          const allowed = knownFunctions.size > 0
            ? [...knownFunctions].join(', ')
            : '<none>';
          errors.push(
            `Unknown function "${fn.name}" at ${fn.path}. Allowed functions: ${allowed}.`,
          );
        } else if (
          fn.name === 'openUrl'
          && options.isOpenUrlAllowed
          && (
            typeof fn.args.url !== 'string'
            || !options.isOpenUrlAllowed(fn.args.url)
          )
        ) {
          errors.push(
            `Function "openUrl" at ${fn.path} has untrusted url ${
              JSON.stringify(fn.args.url)
            }. Use a URL supplied by the request or returned by web_search or image_search.`,
          );
        }
      }
      if (knownComponents.has(comp.component)) {
        validateComponentAgainstCatalog(
          comp,
          componentSpecs.get(comp.component)!,
          errors,
          warnings,
        );
        validateRendererSemantics(
          comp,
          errors,
          options.isImageSourceAllowed,
        );
      } else {
        errors.push(
          `Unknown component "${comp.component}" (id=${comp.id}). Allowed: ${
            [...knownComponents].join(', ')
          }.`,
        );
      }
      if (idsInMessage.has(comp.id)) {
        errors.push(
          `Duplicate component id "${comp.id}" in one ${messageKind} components list for surface "${surfaceId}".`,
        );
      }
      idsInMessage.add(comp.id);
      bucket.set(comp.id, comp);
      const componentPaths: string[] = [];
      collectPaths(comp, componentPaths);
      for (const path of componentPaths) {
        if (isCurrentItemPath(path)) {
          errors.push(
            `Path "${path}" in component "${comp.id}" is not supported; use object array items and bind a relative field path like "label" inside template children.`,
          );
          continue;
        }
        if (hasWildcardSegment(path)) {
          errors.push(
            `Path "${path}" in component "${comp.id}" uses "*", but A2UI collection item bindings must use relative paths like "item" inside template children.`,
          );
          continue;
        }
        allPaths.push({ surfaceId, path });
      }
      for (const path of collectTemplatePaths(comp)) {
        if (!path.startsWith('/')) {
          errors.push(
            `Template collection path "${path}" in component "${comp.id}" on surface "${surfaceId}" must be absolute and start with "/".`,
          );
          continue;
        }
        templatePaths.push({ surfaceId, path });
      }
    }
    componentsBySurface.set(surfaceId, bucket);
  };

  for (const msg of messages) {
    if ('createSurface' in msg && msg.createSurface) {
      const createSurface = msg.createSurface;
      const surfaceId = createSurface.surfaceId;
      if (createSurface.catalogId !== catalog.id) {
        errors.push(
          `createSurface for surface "${surfaceId}" requested catalogId "${createSurface.catalogId}", but this server only supports the active catalog "${catalog.id}".`,
        );
      }
      if (everSeenSurfaces.has(surfaceId)) {
        errors.push(
          `createSurface cannot reuse surfaceId "${surfaceId}" after it has been created.`,
        );
      }
      everSeenSurfaces.add(surfaceId);
      activeSurfaces.add(surfaceId);
      if (createSurface.dataModel !== undefined) {
        dataModelBySurface.set(surfaceId, createSurface.dataModel);
      }
      if (createSurface.components !== undefined) {
        validateComponentsForSurface(
          surfaceId,
          createSurface.components as A2UIComponent[],
          'createSurface',
        );
      }
    } else if ('updateComponents' in msg && msg.updateComponents) {
      const sId = msg.updateComponents.surfaceId;
      if (!activeSurfaces.has(sId)) {
        errors.push(
          `updateComponents references inactive surfaceId "${sId}".`,
        );
        continue;
      }
      validateComponentsForSurface(
        sId,
        msg.updateComponents.components as A2UIComponent[],
        'updateComponents',
      );
    } else if ('updateDataModel' in msg && msg.updateDataModel) {
      const sId = msg.updateDataModel.surfaceId;
      if (!activeSurfaces.has(sId)) {
        errors.push(
          `updateDataModel references inactive surfaceId "${sId}".`,
        );
        continue;
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
      dataModelBySurface.set(
        sId,
        setDataModelValue(
          dataModelBySurface.get(sId),
          basePath,
          updateDataModel.value,
        ),
      );
    } else if ('deleteSurface' in msg && msg.deleteSurface) {
      const surfaceId = msg.deleteSurface.surfaceId;
      if (!activeSurfaces.has(surfaceId)) {
        errors.push(
          `deleteSurface references inactive surfaceId "${surfaceId}".`,
        );
        continue;
      }
      activeSurfaces.delete(surfaceId);
      componentsBySurface.delete(surfaceId);
      dataModelBySurface.delete(surfaceId);
      removeSurfaceEntries(allPaths, surfaceId);
      removeSurfaceEntries(templatePaths, surfaceId);
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
  for (const [surfaceId, dataModel] of dataModelBySurface) {
    providedBySurface.set(
      surfaceId,
      new Set(flattenProvidedPaths('/', dataModel)),
    );
  }
  for (const referenced of allPaths) {
    const providedSet = providedBySurface.get(referenced.surfaceId)
      ?? new Set<string>();
    const surfaceTemplatePaths = templatePaths
      .filter((template) => template.surfaceId === referenced.surfaceId)
      .map((template) => template.path);
    const hasMatch = [...providedSet].some((provided) =>
      isPathReferenceCovered(referenced.path, provided, surfaceTemplatePaths)
    );
    if (!hasMatch) {
      errors.push(
        `Path "${referenced.path}" is referenced by a component in surface "${referenced.surfaceId}" but not populated by createSurface.dataModel or updateDataModel for that surface.`,
      );
    }
  }

  validateBoundImageSources(
    componentsBySurface,
    dataModelBySurface,
    errors,
    options.isImageSourceAllowed,
  );

  return {
    ok: errors.length === 0,
    messages: errors.length === 0 ? messages : [],
    errors,
    warnings,
  };
}

function isPathReferenceCovered(
  referencedPath: string,
  providedPath: string,
  templatePaths: string[],
): boolean {
  if (referencedPath.startsWith('/')) {
    return isPathCovered(referencedPath, providedPath);
  }

  for (const templatePath of templatePaths) {
    const scopedPath = joinPath(templatePath, '*', referencedPath);
    if (isPathCovered(scopedPath, providedPath)) return true;
  }

  return isPathCovered(referencedPath, providedPath);
}

function isPathCovered(referencedPath: string, providedPath: string): boolean {
  const referencedSegments = normalizePathSegments(referencedPath);
  const providedSegments = normalizePathSegments(providedPath);
  const comparableLength = Math.min(
    referencedSegments.length,
    providedSegments.length,
  );

  for (let i = 0; i < comparableLength; i++) {
    const referenced = referencedSegments[i];
    const provided = providedSegments[i];
    if (referenced !== provided && referenced !== '*' && provided !== '*') {
      return false;
    }
  }

  if (providedSegments.length === referencedSegments.length) return true;
  const referencedExtra = referencedSegments.slice(comparableLength);
  const providedExtra = providedSegments.slice(comparableLength);
  return (
    referencedExtra.length > 0
    && referencedExtra.every((segment) => segment === '*')
  )
    || (
      providedExtra.length > 0
      && providedExtra.every((segment) => segment === '*')
    );
}

function normalizePathSegments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function hasWildcardSegment(path: string): boolean {
  return normalizePathSegments(path).includes('*');
}

function isCurrentItemPath(path: string): boolean {
  return path === '.';
}

function joinPath(...parts: string[]): string {
  const segments = parts.flatMap((part) => normalizePathSegments(part));
  return `/${segments.join('/')}`;
}

function removeSurfaceEntries<T extends { surfaceId: string }>(
  entries: T[],
  surfaceId: string,
): void {
  for (let index = entries.length - 1; index >= 0; index--) {
    if (entries[index]?.surfaceId === surfaceId) entries.splice(index, 1);
  }
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

function collectFunctionCalls(
  node: unknown,
  path = '<root>',
): {
  name: string;
  path: string;
  args: Record<string, unknown>;
  catalogId?: unknown;
  hasLegacyReturnType: boolean;
  invalidArgs: boolean;
}[] {
  if (!isRecord(node) && !Array.isArray(node)) return [];
  if (Array.isArray(node)) {
    return node.flatMap((item, index) =>
      collectFunctionCalls(item, `${path}.${index}`)
    );
  }

  const record = node;
  const calls: {
    name: string;
    path: string;
    args: Record<string, unknown>;
    catalogId?: unknown;
    hasLegacyReturnType: boolean;
    invalidArgs: boolean;
  }[] = [];
  if (typeof record.call === 'string') {
    calls.push({
      name: record.call,
      path,
      args: isRecord(record.args) ? record.args : {},
      ...(Object.prototype.hasOwnProperty.call(record, 'catalogId')
        ? { catalogId: record.catalogId }
        : {}),
      hasLegacyReturnType: Object.prototype.hasOwnProperty.call(
        record,
        'returnType',
      ),
      invalidArgs: record.args !== undefined && !isRecord(record.args),
    });
  }

  for (const [key, value] of Object.entries(record)) {
    calls.push(...collectFunctionCalls(value, `${path}.${key}`));
  }
  return calls;
}

function collectTemplatePaths(comp: A2UIComponent): string[] {
  const children = comp.children;
  if (!isRecord(children)) return [];

  const paths: string[] = [];
  const directPath = children.path;
  if (typeof directPath === 'string') paths.push(directPath);

  const template = children.template;
  if (isRecord(template) && typeof template.path === 'string') {
    paths.push(template.path);
  }

  return paths;
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
    const children = comp.children as {
      componentId?: unknown;
      template?: unknown;
    };
    if (typeof children.componentId === 'string') {
      refs.push(children.componentId);
    } else if (isRecord(children.template)) {
      const childTemplate = children.template as { componentId?: unknown };
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

function extractValidationErrorPath(error: string): string {
  const match = /^Schema violation at ([^:]+):/u.exec(error)
    ?? /^Prop ([^ ]+) /u.exec(error);
  return match?.[1] ?? '<root>';
}

function valueAtPath(value: unknown, path: string): unknown {
  if (path === '<root>' || path === '') return value;
  let current = value;
  for (const segment of path.match(/[^.[\]]+/gu) ?? []) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
      continue;
    }
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function previewText(raw: string, maxChars: number): string {
  if (raw.length <= maxChars) return raw;
  return `${raw.slice(0, maxChars)}... [truncated ${
    raw.length - maxChars
  } chars]`;
}

function validateComponentAgainstCatalog(
  comp: A2UIComponent,
  spec: A2UIComponentSpec,
  errors: string[],
  warnings: string[],
): void {
  const allowed = new Set([
    'id',
    'component',
    ...spec.props.map((p) => p.name),
  ]);
  for (const key of Object.keys(comp)) {
    if (!allowed.has(key)) {
      errors.push(
        `Component "${comp.id}" (${comp.component}) has unknown prop "${key}". Allowed props: ${
          [...allowed].join(', ')
        }.`,
      );
    }
  }

  for (const prop of spec.props) {
    const hasValue = Object.prototype.hasOwnProperty.call(comp, prop.name);
    if (prop.required && !hasValue) {
      if (isCatalogPropShapeException(comp, prop.name, hasValue)) {
        continue;
      }
      errors.push(
        `Component "${comp.id}" (${comp.component}) is missing required prop "${prop.name}".`,
      );
      continue;
    }
    if (!hasValue || !prop.schema) continue;
    const compRecord = comp as Record<string, unknown>;
    const value = compRecord[prop.name];
    if (
      sanitizeInvalidStringEnumProp(
        compRecord,
        spec,
        prop,
        value,
        warnings,
      )
    ) {
      continue;
    }
    const propErrors = validateValueAgainstSchema(
      compRecord[prop.name],
      prop.schema,
      `${comp.id}.${prop.name}`,
    );
    if (isCatalogPropShapeException(comp, prop.name, hasValue)) {
      continue;
    }
    errors.push(...propErrors);
  }
}

function isCatalogPropShapeException(
  comp: A2UIComponent,
  propName: string,
  hasValue: boolean,
): boolean {
  if (comp.component === 'Button' && propName === 'action') {
    return !hasValue;
  }

  if (!hasValue) {
    return false;
  }

  if (comp.component !== 'Image' || propName !== 'url') {
    return false;
  }
  const url = (comp as Record<string, unknown>).url;
  return isRecord(url) && typeof url.path === 'string';
}

function sanitizeInvalidStringEnumProp(
  comp: Record<string, unknown>,
  spec: A2UIComponentSpec,
  prop: A2UIComponentProp,
  value: unknown,
  warnings: string[],
): boolean {
  if (typeof value !== 'string') return false;
  if (!prop.schema) return false;
  const enumValues = collectStringEnumValues(prop.schema);
  if (enumValues.length === 0 || enumValues.includes(value)) return false;

  const path = `${String(comp.id)}.${prop.name}`;
  if (!prop.required) {
    delete comp[prop.name];
    warnings.push(
      `Prop ${path} received unsupported value ${
        JSON.stringify(value)
      }; omitted it so ${spec.name} can use its default. Allowed values: ${
        enumValues.join(', ')
      }.`,
    );
    return true;
  }

  const fallback = enumValues[0];
  comp[prop.name] = fallback;
  warnings.push(
    `Prop ${path} received unsupported value ${
      JSON.stringify(value)
    }; replaced with ${JSON.stringify(fallback)}. Allowed values: ${
      enumValues.join(', ')
    }.`,
  );
  return true;
}

function validateRendererSemantics(
  comp: A2UIComponent,
  errors: string[],
  isImageSourceAllowed?: (source: string) => boolean,
): void {
  if (comp.component === 'Image') {
    const url = (comp as Record<string, unknown>).url;
    if (typeof url === 'string' && !isLoadableImageSource(url)) {
      errors.push(
        `Component "${comp.id}" (Image) has unresolved url ${
          JSON.stringify(url)
        }. Call image_search first, or generate_image when search is unsuitable, and copy its returned URL exactly into Image.url.`,
      );
    } else if (
      typeof url === 'string'
      && isImageSourceAllowed
      && !isImageSourceAllowed(url)
    ) {
      errors.push(
        `Component "${comp.id}" (Image) has untrusted url ${
          JSON.stringify(url)
        }. The URL was neither provided by the request or host nor returned by image_search or generate_image.`,
      );
    }
  }

  const weight = (comp as { weight?: unknown }).weight;
  if (typeof weight !== 'number') return;
  if (!Number.isFinite(weight) || weight <= 0) {
    errors.push(
      `Component "${comp.id}" (${comp.component}) has invalid weight "${weight}". Use a positive finite layout ratio.`,
    );
    return;
  }
  if (weight > 12) {
    errors.push(
      `Component "${comp.id}" (${comp.component}) has weight "${weight}", but weight is a small Row/Column layout ratio, not CSS font-weight. Use values like 1, 1.5, 2, 3, or 5.`,
    );
  }
}

export function isLoadableImageSource(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const source = value.trim();
  if (!source) return false;
  if (/^(?:https?:|data:image\/|blob:|file:)/iu.test(source)) return true;
  if (/^(?:\/|\.\/|\.\.\/)/u.test(source)) return true;
  return /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/iu.test(source);
}

function validateBoundImageSources(
  componentsBySurface: Map<string, Map<string, A2UIComponent>>,
  dataModelBySurface: Map<string, unknown>,
  errors: string[],
  isImageSourceAllowed?: (source: string) => boolean,
): void {
  for (const [surfaceId, components] of componentsBySurface) {
    const dataModel = dataModelBySurface.get(surfaceId);

    for (const component of components.values()) {
      if (component.component !== 'Image') continue;
      const url = (component as Record<string, unknown>).url;
      if (!isRecord(url) || typeof url.path !== 'string') continue;

      const values = boundDataValues(
        dataModel,
        url.path,
        templatePathsForComponent(component.id, components),
      );
      if (values.length === 0) continue;
      const invalidIndex = values.findIndex((value) =>
        !isLoadableImageSource(value)
        || (isImageSourceAllowed && !isImageSourceAllowed(value))
      );
      if (invalidIndex === -1) continue;
      const invalid = values[invalidIndex];

      if (isLoadableImageSource(invalid)) {
        errors.push(
          `Component "${component.id}" (Image) path ${
            JSON.stringify(url.path)
          } resolves to an untrusted image URL ${
            JSON.stringify(invalid)
          }. The URL was neither provided by the request or host nor returned by image_search or generate_image.`,
        );
      } else {
        errors.push(
          `Component "${component.id}" (Image) path ${
            JSON.stringify(url.path)
          } resolves to an unresolved image value ${
            JSON.stringify(invalid)
          }. Call image_search first, or generate_image when search is unsuitable, and store its returned URL at that path.`,
        );
      }
    }
  }
}

function templatePathsForComponent(
  componentId: string,
  components: Map<string, A2UIComponent>,
): string[] {
  const matches: { distance: number; path: string }[] = [];
  for (const component of components.values()) {
    const children = component.children;
    if (!isRecord(children)) continue;
    const template = isRecord(children.template)
      ? children.template
      : undefined;
    const path = typeof children.path === 'string'
      ? children.path
      : (typeof template?.path === 'string' ? template.path : undefined);
    const rootId = typeof children.componentId === 'string'
      ? children.componentId
      : (typeof template?.componentId === 'string'
        ? template.componentId
        : undefined);
    if (!path || !rootId) continue;

    const distance = componentDistance(rootId, componentId, components);
    if (distance !== undefined) matches.push({ distance, path });
  }

  if (matches.length === 0) return [];
  const closest = Math.min(...matches.map((match) => match.distance));
  return [
    ...new Set(
      matches
        .filter((match) => match.distance === closest)
        .map((match) => match.path),
    ),
  ];
}

function componentDistance(
  rootId: string,
  targetId: string,
  components: Map<string, A2UIComponent>,
): number | undefined {
  const queue: { distance: number; id: string }[] = [{
    distance: 0,
    id: rootId,
  }];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (current.id === targetId) return current.distance;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    const component = components.get(current.id);
    if (!component) continue;
    for (const childId of collectChildRefs(component)) {
      queue.push({ distance: current.distance + 1, id: childId });
    }
  }
  return undefined;
}

function boundDataValues(
  dataModel: unknown,
  path: string,
  templatePaths: string[],
): unknown[] {
  if (path.startsWith('/')) {
    return [dataValueAtPath(dataModel, path)];
  }

  if (templatePaths.length === 0) {
    return [dataValueAtPath(dataModel, path)];
  }

  const values: unknown[] = [];
  let foundCollection = false;
  for (const templatePath of templatePaths) {
    const collection = dataValueAtPath(dataModel, templatePath);
    if (!Array.isArray(collection)) continue;
    foundCollection = true;
    for (const item of collection) {
      values.push(dataValueAtPath(item, path));
    }
  }
  return foundCollection ? values : [undefined];
}

function setDataModelValue(
  current: unknown,
  path: string,
  value: unknown,
): unknown {
  const segments = dataPathSegments(path);
  if (segments.length === 0) return value;

  const setAt = (container: unknown, index: number): unknown => {
    const segment = segments[index]!;
    let nextContainer: Record<string, unknown> | unknown[];
    if (Array.isArray(container)) {
      const array = container as unknown[];
      nextContainer = [...array];
    } else if (isRecord(container)) {
      nextContainer = { ...container };
    } else {
      nextContainer = {};
    }

    if (index === segments.length - 1) {
      if (value === null) {
        if (Array.isArray(nextContainer) && /^\d+$/u.test(segment)) {
          nextContainer.splice(Number(segment), 1);
        } else {
          delete (nextContainer as Record<string, unknown>)[segment];
        }
      } else {
        (nextContainer as Record<string, unknown>)[segment] = value;
      }
      return nextContainer;
    }

    const child = (nextContainer as Record<string, unknown>)[segment];
    (nextContainer as Record<string, unknown>)[segment] = setAt(
      child,
      index + 1,
    );
    return nextContainer;
  };

  return setAt(current, 0);
}

function dataValueAtPath(value: unknown, path: string): unknown {
  let current = value;
  for (const segment of dataPathSegments(path)) {
    if (!isRecord(current) && !Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function dataPathSegments(path: string): string[] {
  return normalizePathSegments(path).map((segment) =>
    segment.replace(/~1/gu, '/').replace(/~0/gu, '~')
  );
}

function validateValueAgainstSchema(
  value: unknown,
  schema: JsonSchema,
  path: string,
): string[] {
  if (schema.oneOf && schema.oneOf.length > 0) {
    const branchErrors = schema.oneOf.map((branch) =>
      validateValueAgainstSchema(value, branch, path)
    );
    if (branchErrors.some((branch) => branch.length === 0)) return [];
    const enumValues = collectStringEnumValues(schema);
    if (enumValues.length > 0) {
      return [
        `Prop ${path} must be one of ${enumValues.join(', ')}; received ${
          JSON.stringify(value)
        }.`,
      ];
    }
    return [
      `Prop ${path} does not match any allowed shape: ${
        branchErrors.map((branch) => branch[0]).filter(Boolean).join(' | ')
      }`,
    ];
  }

  const errors: string[] = [];
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    errors.push(
      `Prop ${path} must be one of ${
        schema.enum.map(String).join(', ')
      }; received ${JSON.stringify(value)}.`,
    );
    return errors;
  }

  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push(`Prop ${path} must be a string.`);
      }
      return errors;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push(`Prop ${path} must be a finite number.`);
      }
      return errors;
    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push(`Prop ${path} must be a boolean.`);
      }
      return errors;
    case 'array':
      if (!Array.isArray(value)) {
        errors.push(`Prop ${path} must be an array.`);
        return errors;
      }
      if (schema.items) {
        value.forEach((item, index) => {
          errors.push(
            ...validateValueAgainstSchema(
              item,
              schema.items!,
              `${path}[${index}]`,
            ),
          );
        });
      }
      return errors;
    case 'object':
      if (!isRecord(value)) {
        errors.push(`Prop ${path} must be an object.`);
        return errors;
      }
      validateObjectAgainstSchema(value, schema, path, errors);
      return errors;
    default:
      return errors;
  }
}

function collectStringEnumValues(schema: JsonSchema): string[] {
  const values: string[] = [];
  const visit = (candidate: JsonSchema) => {
    if (Array.isArray(candidate.enum)) {
      for (const value of candidate.enum) {
        if (typeof value === 'string') values.push(value);
      }
    }
    for (const branch of candidate.oneOf ?? []) visit(branch);
  };
  visit(schema);
  return [...new Set(values)];
}

function validateObjectAgainstSchema(
  value: Record<string, unknown>,
  schema: JsonSchema,
  path: string,
  errors: string[],
): void {
  const properties = schema.properties ?? {};
  const required = schema.required ?? [];
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      errors.push(`Prop ${path} is missing required field "${key}".`);
    }
  }

  const additional = schema.additionalProperties;
  for (const [key, child] of Object.entries(value)) {
    const childSchema = properties[key];
    if (childSchema) {
      errors.push(
        ...validateValueAgainstSchema(child, childSchema, `${path}.${key}`),
      );
      continue;
    }
    if (additional === false) {
      errors.push(`Prop ${path} has unknown field "${key}".`);
    }
  }
}

function walk(prefix: string, value: unknown, acc: string[]): void {
  if (value === null || value === undefined) {
    if (prefix) acc.push(prefix || '/');
    return;
  }
  if (Array.isArray(value)) {
    acc.push(prefix || '/');
    for (const item of value) walk(`${prefix || ''}/*`, item, acc);
    return;
  }
  if (typeof value !== 'object') {
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
