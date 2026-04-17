import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { vi } from 'vitest';

import { setupPage } from '../../../../src/element-template/runtime/page/page.js';
import { renderOpcodesIntoElementTemplate } from '../../../../src/element-template/runtime/render/render-opcodes.js';
import { resetTemplateId } from '../../../../src/element-template/runtime/template/handle.js';
import { ElementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';
import { renderToString } from '../../../../src/element-template/runtime/render/render-to-opcodes.js';
import { clearTemplates, registerBuiltinRawTextTemplate, registerTemplates } from '../../test-utils/debug/registry.js';
import { serializeToJSX } from '../../test-utils/debug/serializer.js';
import { installMockNativePapi, type MockNativePapi } from '../../test-utils/mock/mockNativePapi.js';

declare global {
  var __USE_ELEMENT_TEMPLATE__: boolean | undefined;
}

interface RegisteredTemplateFixture {
  templateId: string;
  compiledTemplate: unknown;
}

interface TransformResult {
  code?: string;
  elementTemplates?: RegisteredTemplateFixture[];
}

interface RenderedListFixture {
  listElement: unknown;
  mockNativePapi: MockNativePapi;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SOURCE_FIXTURES_DIR = path.resolve(__dirname, '../render-list');
const PLATFORM_INFO_KEYS = new Set([
  'reuse-identifier',
  'full-span',
  'item-key',
  'sticky-top',
  'sticky-bottom',
  'estimated-height',
  'estimated-height-px',
  'estimated-main-axis-size-px',
  'recyclable',
]);
const TRANSFORM_OPTIONS = {
  mode: 'test',
  pluginName: 'test-plugin',
  filename: 'index.tsx',
  sourcemap: false,
  cssScope: false,
  snapshot: {
    preserveJsx: false,
    runtimePkg: '@lynx-js/react/element-template/internal',
    filename: 'index.tsx',
    target: 'LEPUS',
    experimentalEnableElementTemplate: true,
  },
  shake: false,
  compat: true,
  directiveDCE: false,
  defineDCE: false,
  worklet: false,
  refresh: false,
} as const;

export async function runListRuntimeFixture(
  sourceFixtureName: string,
  actions: (ctx: RenderedListFixture) => Promise<void> | void,
): Promise<{ files: Record<string, unknown> }> {
  const rendered = await compileFixture(sourceFixtureName);
  try {
    const before = serializeToJSX(rendered.listElement);
    await actions(rendered);
    const after = serializeToJSX(rendered.listElement);
    return {
      files: {
        'before.txt': before,
        'output.txt': after,
        'contract.txt': summarizeNativeLog(rendered.mockNativePapi.nativeLog),
      },
    };
  } finally {
    try {
      rendered.mockNativePapi.cleanup();
    } finally {
      clearTemplates();
      ElementTemplateRegistry.clear();
      resetTemplateId();
      vi.clearAllMocks();
      vi.unstubAllGlobals();
    }
  }
}

async function compileFixture(sourceFixtureName: string): Promise<RenderedListFixture> {
  vi.resetAllMocks();
  const mockNativePapi = installMockNativePapi({ clearTemplatesOnCleanup: true });
  clearTemplates();
  registerBuiltinRawTextTemplate();
  ElementTemplateRegistry.clear();
  resetTemplateId();

  globalThis.__USE_ELEMENT_TEMPLATE__ = true;
  globalThis.__LEPUS__ = true;
  globalThis.__JS__ = false;
  globalThis.__MAIN_THREAD__ = true;
  globalThis.__BACKGROUND__ = false;

  const globalWithInject = globalThis as typeof globalThis & {
    lynxCoreInject?: {
      tt?: {
        _params?: {
          initData: Record<string, unknown>;
          updateData: Record<string, unknown>;
        };
      };
    };
  };
  globalWithInject.lynxCoreInject ??= {};
  globalWithInject.lynxCoreInject.tt ??= {};
  globalWithInject.lynxCoreInject.tt._params ??= { initData: {}, updateData: {} };

  const sourcePath = path.join(SOURCE_FIXTURES_DIR, sourceFixtureName, 'index.tsx');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const { transformReactLynx } = await import('@lynx-js/react-transform');
  const result = await transformReactLynx(
    source,
    TRANSFORM_OPTIONS as Parameters<typeof transformReactLynx>[1],
  ) as TransformResult;

  registerTemplates(result.elementTemplates ?? []);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lynx-et-list-runtime-'));
  const tempImportPath = path.join(tempDir, 'temp_actual.js');
  try {
    let outputCode = result.code ?? '';
    outputCode = outputCode.replace(
      /from ["']react\/jsx-runtime["']/g,
      'from "@lynx-js/react/jsx-runtime"',
    );
    fs.writeFileSync(tempImportPath, outputCode);

    const module = (await import(
      `${pathToFileURL(tempImportPath).href}?t=${Date.now()}`
    )) as { App: unknown };
    const page = { type: 'page' as const, id: '0', children: [] as unknown[] };
    setupPage(page as unknown as FiberElement);
    const vnode = { type: module.App, props: {}, key: null, ref: null };
    const opcodes = renderToString(vnode, null);
    const { rootRefs } = renderOpcodesIntoElementTemplate(opcodes);

    for (const rootRef of rootRefs) {
      __AppendElement(page as unknown as FiberElement, rootRef as FiberElement);
    }

    const listElement = findFirstTag(page, 'list');
    if (!listElement) {
      throw new Error(`Expected fixture "${sourceFixtureName}" to materialize a native list container.`);
    }

    return {
      listElement,
      mockNativePapi,
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function summarizeNativeLog(nativeLog: unknown[]): Record<string, unknown> {
  return {
    updateListCallbacks: nativeLog.filter(entry => Array.isArray(entry) && entry[0] === '__UpdateListCallbacks'),
    updateListInfo: nativeLog.filter(entry =>
      Array.isArray(entry)
      && entry[0] === '__SetAttribute'
      && entry[1] === '<list />'
      && entry[2] === 'update-list-info'
    ),
    listAttrs: nativeLog.filter(entry =>
      Array.isArray(entry)
      && (entry[0] === '__SetAttribute' || entry[0] === '__SetInlineStyles' || entry[0] === '__SetClasses'
        || entry[0] === '__SetID' || entry[0] === '__SetDataset')
      && entry[1] === '<list />'
      && entry[2] !== 'update-list-info'
    ),
    platformInfoAttrs: nativeLog.filter(entry =>
      Array.isArray(entry)
      && entry[0] === '__SetAttribute'
      && typeof entry[2] === 'string'
      && PLATFORM_INFO_KEYS.has(entry[2])
    ),
    flushes: nativeLog.filter(entry => Array.isArray(entry) && entry[0] === '__FlushElementTree'),
  };
}

function findFirstTag(node: unknown, tag: string): unknown {
  if (!node || typeof node !== 'object') {
    return undefined;
  }

  const record = node as {
    tag?: string;
    type?: string;
    children?: unknown[];
  };
  if (record.tag === tag || record.type === tag) {
    return node;
  }

  for (const child of record.children ?? []) {
    const found = findFirstTag(child, tag);
    if (found) {
      return found;
    }
  }

  return undefined;
}
