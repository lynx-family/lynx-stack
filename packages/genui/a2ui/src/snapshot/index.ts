// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  ComponentInstance,
  ServerToClientMessage,
} from '../store/types.js';

export interface CompactA2UISnapshotSurfaceMetadata {
  surfaceId: string;
  componentCount: number;
  droppedComponentCount: number;
  dataPathCount: number;
  hasRoot: boolean;
}

export interface CompactA2UISnapshotMetadata {
  originalMessageCount: number;
  compactedMessageCount: number;
  activeSurfaceCount: number;
  retainedComponentCount: number;
  droppedComponentCount: number;
  retainedDataPathCount: number;
  surfaces: CompactA2UISnapshotSurfaceMetadata[];
}

export interface CompactA2UISnapshotResult {
  messages: ServerToClientMessage[];
  metadata: CompactA2UISnapshotMetadata;
}

export interface GenerateReactLynxA2UIWrapperSourceOptions {
  /**
   * Exported component name in the generated TSX module.
   *
   * @default "App"
   */
  componentName?: string;
  /**
   * Compact the incoming A2UI stream before embedding it.
   *
   * @default true
   */
  compact?: boolean;
  /**
   * Import source for the A2UI renderer APIs.
   *
   * @default "@lynx-js/genui/a2ui"
   */
  a2uiImportSource?: string;
  /**
   * Import source for built-in A2UI catalog components.
   *
   * @default "@lynx-js/genui/a2ui/catalog"
   */
  catalogImportSource?: string;
  /**
   * Import source for the optional default A2UI theme.
   *
   * @default "@lynx-js/genui/a2ui/styles/theme.css"
   */
  themeImportSource?: string;
  /**
   * Include the default A2UI theme stylesheet import.
   *
   * @default true
   */
  includeThemeImport?: boolean;
  /**
   * Class name applied to the generated wrapper root.
   *
   * @default "a2ui-light generated-a2ui-app"
   */
  rootClassName?: string;
  /**
   * Class name passed to the inner A2UI surface root.
   *
   * @default "generated-a2ui-surface"
   */
  surfaceClassName?: string;
  /**
   * Class name used by the generated `wrapSurface` shell.
   *
   * @default "generated-a2ui-surface-shell"
   */
  surfaceWrapperClassName?: string;
}

interface SnapshotTemplateInfo {
  componentId: string;
  path: string;
}

interface SnapshotSurfaceState {
  surfaceId: string;
  catalogId?: string;
  theme?: Readonly<Record<string, unknown>>;
  sendDataModel?: boolean;
  rootComponentId: string | null;
  components: Map<string, ComponentInstance>;
  templates: Map<string, SnapshotTemplateInfo>;
  dataModel: Map<string, unknown>;
}

type JsonRecord = Record<string, unknown>;

const CHILD_REFERENCE_FIELDS = [
  'child',
  'trigger',
  'content',
  'entryPointChild',
  'contentChild',
] as const;

const BUILTIN_CATALOG_COMPONENTS = [
  'Button',
  'Card',
  'CheckBox',
  'ChoicePicker',
  'Column',
  'DateTimeInput',
  'Divider',
  'Icon',
  'Image',
  'LazyComponent',
  'LineChart',
  'List',
  'Loading',
  'Modal',
  'PieChart',
  'RadioGroup',
  'Row',
  'Slider',
  'Tabs',
  'Text',
  'TextField',
] as const;

const JS_IDENTIFIER_RE = /^[$A-Z_a-z][$\w]*$/u;

function isObject(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function cloneJson<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function serializeJavaScriptLiteral(value: unknown): string {
  return JSON.stringify(value, null, 2)
    .replace(/\u2028/gu, '\\u2028')
    .replace(/\u2029/gu, '\\u2029');
}

function assertValidComponentName(componentName: string): void {
  if (JS_IDENTIFIER_RE.test(componentName)) return;
  throw new Error(
    `[a2ui] Invalid ReactLynx component name "${componentName}". `
      + 'Expected a JavaScript identifier.',
  );
}

function createBuiltinCatalogImports(): string {
  return BUILTIN_CATALOG_COMPONENTS.map(name => `  ${name},`).join('\n');
}

function normalizePath(path: string): string {
  if (path === '') return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

function resolveBindingPath(path: string, dataContextPath?: string): string {
  if (!path) return path;
  const bindingPath = path.startsWith('./') ? path.substring(2) : path;
  if (bindingPath.startsWith('/')) return bindingPath;
  const context = dataContextPath?.endsWith('/')
    ? dataContextPath.slice(0, -1)
    : dataContextPath;
  return context ? `${context}/${bindingPath}` : `/${bindingPath}`;
}

function joinDataContextPath(
  basePath: string,
  segment: string | number,
): string {
  const normalizedBase = normalizePath(basePath);
  const base = normalizedBase === '/'
    ? ''
    : normalizedBase.replace(/\/+$/, '');
  return `${base}/${segment}`;
}

function flattenValue(
  value: unknown,
  basePath: string,
  updates: Array<{ path: string; value: unknown }>,
): void {
  const normalizedBase = basePath === '' ? '/' : normalizePath(basePath);

  if (Array.isArray(value)) {
    updates.push({ path: normalizedBase, value });
    value.forEach((item, index) => {
      const childPath = normalizedBase === '/'
        ? `/${index}`
        : `${normalizedBase}/${index}`;
      if (isObject(item) || Array.isArray(item)) {
        updates.push({ path: childPath, value: item });
        flattenValue(item, childPath, updates);
      } else {
        updates.push({ path: childPath, value: String(item) });
      }
    });
    return;
  }

  if (isObject(value)) {
    updates.push({ path: normalizedBase, value });
    for (const [key, item] of Object.entries(value)) {
      const childPath = normalizedBase === '/'
        ? `/${key}`
        : `${normalizedBase}/${key}`;
      if (isObject(item) || Array.isArray(item)) {
        updates.push({ path: childPath, value: item });
        flattenValue(item, childPath, updates);
      } else {
        updates.push({ path: childPath, value: String(item) });
      }
    }
    return;
  }

  updates.push({ path: normalizedBase, value: String(value) });
}

function createSurfaceState(surfaceId: string): SnapshotSurfaceState {
  return {
    surfaceId,
    rootComponentId: null,
    components: new Map(),
    templates: new Map(),
    dataModel: new Map(),
  };
}

function getTemplateInfo(
  component: ComponentInstance,
  dataContextPath: string | undefined,
): SnapshotTemplateInfo | null {
  const children = (component as JsonRecord)['children'];
  if (!isObject(children)) return null;
  const componentId = children['componentId'];
  const path = children['path'];
  if (typeof componentId !== 'string' || typeof path !== 'string') {
    return null;
  }
  return {
    componentId,
    path: resolveBindingPath(path, dataContextPath),
  };
}

function readDataValue(surface: SnapshotSurfaceState, path: string): unknown {
  const raw = surface.dataModel.get(path);
  if (raw === undefined || raw === null) return raw;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function rewriteStringField(
  component: JsonRecord,
  field: string,
  resolveChild: (childId: string) => string | null,
): void {
  const childId = component[field];
  if (typeof childId !== 'string') return;
  const nextId = resolveChild(childId);
  if (nextId) component[field] = nextId;
}

function cloneComponentTree(
  surface: SnapshotSurfaceState,
  originalId: string,
  newIdSuffix: string,
  dataContextPath: string,
  clonedRefs = new Map<string, string | null>(),
): string | null {
  if (clonedRefs.has(originalId)) return clonedRefs.get(originalId) ?? null;

  const original = surface.components.get(originalId);
  if (!original) {
    clonedRefs.set(originalId, null);
    return null;
  }

  const newId = `${originalId}${newIdSuffix}`;
  clonedRefs.set(originalId, newId);

  const cloned = cloneJson(original);
  (cloned as JsonRecord)['id'] = newId;
  cloned.dataContextPath = dataContextPath;
  surface.components.set(newId, cloned);

  const originalTemplate = surface.templates.get(originalId);
  if (originalTemplate) {
    surface.templates.set(newId, { ...originalTemplate });
  } else {
    surface.templates.delete(newId);
  }

  const clonedRecord = cloned as JsonRecord;
  const resolveChild = (childId: string): string | null =>
    cloneComponentTree(
      surface,
      childId,
      newIdSuffix,
      dataContextPath,
      clonedRefs,
    );

  if (Array.isArray(clonedRecord['children'])) {
    const nextChildren: string[] = [];
    for (const childId of clonedRecord['children']) {
      if (typeof childId !== 'string') continue;
      const nextId = resolveChild(childId);
      if (nextId) nextChildren.push(nextId);
    }
    clonedRecord['children'] = nextChildren;
  }

  for (const field of CHILD_REFERENCE_FIELDS) {
    rewriteStringField(clonedRecord, field, resolveChild);
  }

  const tabs = clonedRecord['tabs'];
  if (Array.isArray(tabs)) {
    clonedRecord['tabs'] = tabs.map((tab: unknown): unknown => {
      if (!isObject(tab)) return tab;
      const childId = tab['child'];
      if (typeof childId !== 'string') return tab;
      const nextId = resolveChild(childId);
      return nextId ? { ...tab, child: nextId } : tab;
    });
  }

  return newId;
}

function comparePaths(a: string, b: string): number {
  const depthA = a === '/' ? 0 : a.split('/').length;
  const depthB = b === '/' ? 0 : b.split('/').length;
  return depthA === depthB ? a.localeCompare(b) : depthA - depthB;
}

function addKnownChildReferences(
  component: JsonRecord,
  out: Set<string>,
): void {
  const children = component['children'];
  if (Array.isArray(children)) {
    for (const childId of children) {
      if (typeof childId === 'string') out.add(childId);
    }
  }

  for (const field of CHILD_REFERENCE_FIELDS) {
    const childId = component[field];
    if (typeof childId === 'string') out.add(childId);
  }

  const tabs = component['tabs'];
  if (Array.isArray(tabs)) {
    for (const tab of tabs) {
      if (isObject(tab) && typeof tab['child'] === 'string') {
        out.add(tab['child']);
      }
    }
  }
}

function scanStringReferences(
  value: unknown,
  knownIds: Set<string>,
  out: Set<string>,
): void {
  if (typeof value === 'string') {
    if (knownIds.has(value)) out.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) scanStringReferences(item, knownIds, out);
    return;
  }
  if (!isObject(value)) return;
  for (const item of Object.values(value)) {
    scanStringReferences(item, knownIds, out);
  }
}

function collectChildReferences(
  component: ComponentInstance,
  knownIds: Set<string>,
): string[] {
  const refs = new Set<string>();
  const record = component as JsonRecord;
  addKnownChildReferences(record, refs);
  scanStringReferences(record, knownIds, refs);
  return [...refs].filter(id => id !== component.id);
}

function collectReachableComponents(
  surface: SnapshotSurfaceState,
): ComponentInstance[] {
  const rootId = surface.rootComponentId;
  if (!rootId || !surface.components.has(rootId)) return [];

  const knownIds = new Set(surface.components.keys());
  const visited = new Set<string>();
  const ordered: ComponentInstance[] = [];

  const visit = (componentId: string) => {
    if (visited.has(componentId)) return;
    const component = surface.components.get(componentId);
    if (!component) return;
    visited.add(componentId);
    ordered.push(component);
    for (const childId of collectChildReferences(component, knownIds)) {
      visit(childId);
    }
  };

  visit(rootId);
  return ordered;
}

function collectDataPaths(
  value: unknown,
  dataContextPath: string | undefined,
  out: Set<string>,
): void {
  if (Array.isArray(value)) {
    for (const item of value) collectDataPaths(item, dataContextPath, out);
    return;
  }

  if (!isObject(value)) return;

  if (typeof value['path'] === 'string') {
    const path = resolveBindingPath(value['path'], dataContextPath);
    if (path) out.add(normalizePath(path));
  }

  for (const item of Object.values(value)) {
    collectDataPaths(item, dataContextPath, out);
  }
}

function stripInternalComponentState(
  component: ComponentInstance,
): ComponentInstance {
  const out = cloneJson(component) as ComponentInstance & JsonRecord;
  delete out.__template;
  return out;
}

function createSurfaceMessage(
  surface: SnapshotSurfaceState,
): ServerToClientMessage {
  const createSurface: JsonRecord = {
    surfaceId: surface.surfaceId,
  };
  if (surface.catalogId !== undefined) {
    createSurface['catalogId'] = surface.catalogId;
  }
  if (surface.theme !== undefined) {
    createSurface['theme'] = cloneJson(surface.theme);
  }
  if (surface.sendDataModel !== undefined) {
    createSurface['sendDataModel'] = surface.sendDataModel;
  }
  return {
    version: 'v0.9',
    createSurface,
  } as ServerToClientMessage;
}

function createDataMessage(
  surfaceId: string,
  path: string,
  value: unknown,
): ServerToClientMessage {
  const updateDataModel: JsonRecord = {
    surfaceId,
    value: cloneJson(value),
  };
  if (path !== '/') updateDataModel['path'] = path;
  return {
    version: 'v0.9',
    updateDataModel,
  } as ServerToClientMessage;
}

function createComponentsMessage(
  surfaceId: string,
  components: ComponentInstance[],
): ServerToClientMessage {
  return {
    version: 'v0.9',
    updateComponents: {
      surfaceId,
      components: components.map(component =>
        stripInternalComponentState(component)
      ),
    },
  } as ServerToClientMessage;
}

class A2UISnapshotMachine {
  private surfaces = new Map<string, SnapshotSurfaceState>();

  applyAll(messages: readonly ServerToClientMessage[]): void {
    for (const message of messages) this.apply(message);
  }

  apply(message: ServerToClientMessage): void {
    if ('createSurface' in message && message.createSurface) {
      this.applyCreateSurface(message);
    }
    if ('updateComponents' in message && message.updateComponents) {
      this.applyUpdateComponents(message);
    }
    if ('updateDataModel' in message && message.updateDataModel) {
      this.applyUpdateDataModel(message);
    }
    if ('deleteSurface' in message && message.deleteSurface) {
      this.applyDeleteSurface(message);
    }
  }

  serialize(originalMessageCount: number): CompactA2UISnapshotResult {
    const messages: ServerToClientMessage[] = [];
    const surfaces: CompactA2UISnapshotSurfaceMetadata[] = [];
    let retainedComponentCount = 0;
    let droppedComponentCount = 0;
    let retainedDataPathCount = 0;

    for (const surface of this.surfaces.values()) {
      const reachableComponents = collectReachableComponents(surface);
      const retainedPaths = new Set<string>();
      for (const component of reachableComponents) {
        collectDataPaths(component, component.dataContextPath, retainedPaths);
      }
      const retainedExistingPaths = [...retainedPaths]
        .filter(path => surface.dataModel.has(path))
        .sort(comparePaths);
      const droppedForSurface = Math.max(
        0,
        surface.components.size - reachableComponents.length,
      );

      messages.push(createSurfaceMessage(surface));
      for (const path of retainedExistingPaths) {
        messages.push(createDataMessage(
          surface.surfaceId,
          path,
          surface.dataModel.get(path),
        ));
      }
      if (reachableComponents.length > 0) {
        messages.push(createComponentsMessage(
          surface.surfaceId,
          reachableComponents,
        ));
      }

      retainedComponentCount += reachableComponents.length;
      droppedComponentCount += droppedForSurface;
      retainedDataPathCount += retainedExistingPaths.length;
      surfaces.push({
        surfaceId: surface.surfaceId,
        componentCount: reachableComponents.length,
        droppedComponentCount: droppedForSurface,
        dataPathCount: retainedExistingPaths.length,
        hasRoot: Boolean(
          surface.rootComponentId
            && surface.components.has(surface.rootComponentId),
        ),
      });
    }

    return {
      messages,
      metadata: {
        originalMessageCount,
        compactedMessageCount: messages.length,
        activeSurfaceCount: this.surfaces.size,
        retainedComponentCount,
        droppedComponentCount,
        retainedDataPathCount,
        surfaces,
      },
    };
  }

  private getOrCreateSurface(surfaceId: string): SnapshotSurfaceState {
    let surface = this.surfaces.get(surfaceId);
    if (!surface) {
      surface = createSurfaceState(surfaceId);
      this.surfaces.set(surfaceId, surface);
    }
    return surface;
  }

  private applyCreateSurface(message: ServerToClientMessage): void {
    const createSurface =
      (message as { createSurface?: unknown }).createSurface;
    if (!isObject(createSurface)) return;
    const surfaceId = createSurface['surfaceId'];
    if (typeof surfaceId !== 'string' || surfaceId.length === 0) return;

    const surface = this.getOrCreateSurface(surfaceId);
    if (typeof createSurface['catalogId'] === 'string') {
      surface.catalogId = createSurface['catalogId'];
    }
    if (isObject(createSurface['theme'])) {
      surface.theme = cloneJson(createSurface['theme']);
    }
    if (typeof createSurface['sendDataModel'] === 'boolean') {
      surface.sendDataModel = createSurface['sendDataModel'];
    }
  }

  private applyUpdateComponents(message: ServerToClientMessage): void {
    const updateComponents =
      (message as { updateComponents?: unknown }).updateComponents;
    if (!isObject(updateComponents)) return;
    const surfaceId = updateComponents['surfaceId'];
    const components = updateComponents['components'];
    if (typeof surfaceId !== 'string' || !Array.isArray(components)) return;

    const surface = this.getOrCreateSurface(surfaceId);
    let firstUpdatedId: string | null = null;

    for (const rawComponent of components) {
      if (!isObject(rawComponent) || typeof rawComponent['id'] !== 'string') {
        continue;
      }
      const id = rawComponent['id'];
      firstUpdatedId ??= id;

      const existing = surface.components.get(id);
      const instance = cloneJson(rawComponent) as ComponentInstance;
      if (existing?.dataContextPath !== undefined) {
        instance.dataContextPath = existing.dataContextPath;
      }

      surface.components.set(id, instance);

      const template = getTemplateInfo(instance, instance.dataContextPath);
      if (template) {
        surface.templates.set(id, template);
      } else {
        surface.templates.delete(id);
      }

      if (id === 'root') {
        surface.rootComponentId = 'root';
      }
    }

    if (!surface.rootComponentId) {
      if (surface.components.has('root')) {
        surface.rootComponentId = 'root';
      } else {
        surface.rootComponentId = firstUpdatedId;
      }
    }
  }

  private applyUpdateDataModel(message: ServerToClientMessage): void {
    const updateDataModel =
      (message as { updateDataModel?: unknown }).updateDataModel;
    if (!isObject(updateDataModel)) return;
    const surfaceId = updateDataModel['surfaceId'];
    if (typeof surfaceId !== 'string') return;

    const surface = this.getOrCreateSurface(surfaceId);
    const path = updateDataModel['path'];
    const value = updateDataModel['value'];
    const updates: Array<{ path: string; value: unknown }> = [];

    if (value !== undefined) {
      const basePath = typeof path === 'string' && path !== ''
        ? normalizePath(path)
        : '/';
      flattenValue(value, basePath, updates);
    } else if (typeof path === 'string' && path !== '') {
      updates.push({ path: normalizePath(path), value: '' });
    }

    for (const update of updates) {
      surface.dataModel.set(update.path, cloneJson(update.value));
    }
    if (updates.length > 0) this.expandTemplates(surface);
  }

  private applyDeleteSurface(message: ServerToClientMessage): void {
    const deleteSurface =
      (message as { deleteSurface?: unknown }).deleteSurface;
    if (!isObject(deleteSurface)) return;
    const surfaceId = deleteSurface['surfaceId'];
    if (typeof surfaceId === 'string') this.surfaces.delete(surfaceId);
  }

  private expandTemplates(surface: SnapshotSurfaceState): void {
    for (const [componentId, template] of Array.from(surface.templates)) {
      const component = surface.components.get(componentId);
      if (!component) {
        surface.templates.delete(componentId);
        continue;
      }

      const rawData = readDataValue(surface, template.path);
      const explicitChildren: string[] = [];

      if (Array.isArray(rawData)) {
        rawData.forEach((_, index) => {
          const clonedId = cloneComponentTree(
            surface,
            template.componentId,
            `:${index}`,
            joinDataContextPath(template.path, index),
          );
          if (clonedId) explicitChildren.push(clonedId);
        });
      } else if (isObject(rawData)) {
        for (const key of Object.keys(rawData)) {
          const clonedId = cloneComponentTree(
            surface,
            template.componentId,
            `:${key}`,
            joinDataContextPath(template.path, key),
          );
          if (clonedId) explicitChildren.push(clonedId);
        }
      }

      (component as JsonRecord)['children'] = explicitChildren;
    }
  }
}

export function compactA2UIMessagesToSnapshot(
  messages: readonly ServerToClientMessage[],
): CompactA2UISnapshotResult {
  const machine = new A2UISnapshotMachine();
  machine.applyAll(messages);
  return machine.serialize(messages.length);
}

export function generateReactLynxA2UIWrapperSource(
  messages: readonly ServerToClientMessage[],
  options: GenerateReactLynxA2UIWrapperSourceOptions = {},
): string {
  const componentName = options.componentName ?? 'App';
  assertValidComponentName(componentName);
  const propsName = `${componentName}Props`;
  const a2uiImportSource = options.a2uiImportSource
    ?? '@lynx-js/genui/a2ui';
  const catalogImportSource = options.catalogImportSource
    ?? '@lynx-js/genui/a2ui/catalog';
  const themeImportSource = options.themeImportSource
    ?? '@lynx-js/genui/a2ui/styles/theme.css';
  const includeThemeImport = options.includeThemeImport ?? true;
  const rootClassName = options.rootClassName
    ?? 'a2ui-light generated-a2ui-app';
  const surfaceClassName = options.surfaceClassName
    ?? 'generated-a2ui-surface';
  const surfaceWrapperClassName = options.surfaceWrapperClassName
    ?? 'generated-a2ui-surface-shell';
  const sourceMessages = options.compact === false
    ? cloneJson([...messages])
    : compactA2UIMessagesToSnapshot(messages).messages;
  const messagesLiteral = serializeJavaScriptLiteral(sourceMessages);

  return [
    'import { useMemo } from \'@lynx-js/react\';',
    'import type { ReactNode } from \'@lynx-js/react\';',
    'import {',
    '  A2UI,',
    '  basicFunctions,',
    '  createMessageStore,',
    '  defineCatalog,',
    `} from ${serializeJavaScriptLiteral(a2uiImportSource)};`,
    'import type {',
    '  ServerToClientMessage,',
    '  UserActionPayload,',
    `} from ${serializeJavaScriptLiteral(a2uiImportSource)};`,
    'import {',
    createBuiltinCatalogImports(),
    '  catalogManifests,',
    `} from ${serializeJavaScriptLiteral(catalogImportSource)};`,
    'import type {',
    '  CatalogComponent,',
    '  CatalogInput,',
    '  CatalogManifest,',
    `} from ${serializeJavaScriptLiteral(catalogImportSource)};`,
    ...(includeThemeImport
      ? [`import ${serializeJavaScriptLiteral(themeImportSource)};`]
      : []),
    '',
    `const generatedA2UIMessages: ServerToClientMessage[] = ${messagesLiteral};`,
    '',
    'function withManifest(',
    '  component: CatalogComponent,',
    '  manifest: CatalogManifest | undefined,',
    '): CatalogInput {',
    '  return manifest && Object.keys(manifest).length > 0',
    '    ? [component, manifest] as const',
    '    : component;',
    '}',
    '',
    'const generatedA2UICatalogs = defineCatalog([',
    ...BUILTIN_CATALOG_COMPONENTS.map(name =>
      `  withManifest(${name} as CatalogComponent, catalogManifests.${name}),`
    ),
    '  ...basicFunctions,',
    ']).components;',
    '',
    `export interface ${propsName} {`,
    '  onAction?: (action: UserActionPayload) => void;',
    '}',
    '',
    `export function ${componentName}(`,
    `  props: ${propsName},`,
    '): ReactNode {',
    '  const messageStore = useMemo(() => {',
    '    const store = createMessageStore({',
    '      initialMessages: generatedA2UIMessages,',
    '    });',
    '    return store;',
    '  }, []);',
    '',
    '  return (',
    `    <view className=${serializeJavaScriptLiteral(rootClassName)}>`,
    '      <A2UI',
    '        messageStore={messageStore}',
    '        catalogs={generatedA2UICatalogs}',
    `        className=${serializeJavaScriptLiteral(surfaceClassName)}`,
    '        onAction={props.onAction}',
    '        wrapSurface={(children) => (',
    `          <view className=${
      serializeJavaScriptLiteral(surfaceWrapperClassName)
    }>`,
    '            {children}',
    '          </view>',
    '        )}',
    '      />',
    '    </view>',
    '  );',
    '}',
    '',
    `export default ${componentName};`,
    '',
  ].join('\n');
}

export const generateReactLynx3A2UIWrapperSource =
  generateReactLynxA2UIWrapperSource;
