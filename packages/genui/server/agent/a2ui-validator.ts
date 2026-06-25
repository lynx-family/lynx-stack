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
  if (firstIsCreate) {
    const catalogId = firstMessage.createSurface.catalogId;
    if (catalogId !== catalog.id) {
      errors.push(
        `createSurface.catalogId must equal "${catalog.id}"; received "${catalogId}".`,
      );
    }
  } else if (requireCreateSurface) {
    errors.push('The first message MUST be a createSurface.');
  }

  const surfaces = new Set<string>(options.existingSurfaceIds ?? []);
  const componentsBySurface = new Map<string, Map<string, A2UIComponent>>();
  const allPaths: { surfaceId: string; path: string }[] = [];
  const providedPaths: { surfaceId: string; path: string }[] = [];
  const templatePaths: { surfaceId: string; path: string }[] = [];

  for (
    const [surfaceId, dataModel] of Object.entries(
      options.existingDataModelBySurface ?? {},
    )
  ) {
    for (const path of flattenProvidedPaths('/', dataModel)) {
      providedPaths.push({ surfaceId, path });
    }
  }

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
        for (const fn of collectFunctionCalls(comp, `component.${comp.id}`)) {
          if (!knownFunctions.has(fn.name)) {
            const allowed = knownFunctions.size > 0
              ? [...knownFunctions].join(', ')
              : '<none>';
            errors.push(
              `Unknown function "${fn.name}" at ${fn.path}. Allowed functions: ${allowed}.`,
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
          validateRendererSemantics(comp, errors);
        } else {
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
          allPaths.push({ surfaceId: sId, path });
        }
        for (const path of collectTemplatePaths(comp)) {
          if (!path.startsWith('/')) {
            errors.push(
              `Template collection path "${path}" in component "${comp.id}" on surface "${sId}" must be absolute and start with "/".`,
            );
            continue;
          }
          templatePaths.push({ surfaceId: sId, path });
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
    const surfaceTemplatePaths = templatePaths
      .filter((template) => template.surfaceId === referenced.surfaceId)
      .map((template) => template.path);
    const hasMatch = [...providedSet].some((provided) =>
      isPathReferenceCovered(referenced.path, provided, surfaceTemplatePaths)
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
): { name: string; path: string }[] {
  if (!isRecord(node) && !Array.isArray(node)) return [];
  if (Array.isArray(node)) {
    return node.flatMap((item, index) =>
      collectFunctionCalls(item, `${path}.${index}`)
    );
  }

  const record = node;
  const calls: { name: string; path: string }[] = [];
  if (typeof record.call === 'string' && isRecord(record.args)) {
    calls.push({ name: record.call, path });
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
      if (isOptionalServerResolvedProp(comp, prop.name, hasValue)) {
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
    if (isOptionalServerResolvedProp(comp, prop.name, hasValue)) {
      continue;
    }
    errors.push(...propErrors);
  }
}

function isOptionalServerResolvedProp(
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
): void {
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
