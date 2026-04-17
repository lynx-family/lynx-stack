import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetElementTemplatePatchListener } from '../../../../src/element-template/native/patch-listener.js';
import { setupPage } from '../../../../src/element-template/runtime/page/page.js';
import { setRoot } from '../../../../src/element-template/runtime/page/root-instance.js';
import { renderMainThread } from '../../../../src/element-template/runtime/render/render-main-thread.js';
import { resetTemplateId } from '../../../../src/element-template/runtime/template/handle.js';
import { ElementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';
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
  page: {
    type: 'page';
    id: string;
    children: unknown[];
  };
  dispatchEvent: ReturnType<typeof vi.fn>;
  listElement: unknown;
}

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

describe('ET list first-screen contract', () => {
  let mockNativePapi: MockNativePapi;

  beforeEach(() => {
    vi.resetAllMocks();
    mockNativePapi = installMockNativePapi({ clearTemplatesOnCleanup: true });
    clearTemplates();
    ElementTemplateRegistry.clear();
    resetTemplateId();
    registerBuiltinRawTextTemplate();

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
  });

  afterEach(() => {
    resetElementTemplatePatchListener();
    clearTemplates();
    ElementTemplateRegistry.clear();
    resetTemplateId();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates a list container and materializes mapped list-item cells on demand', async () => {
    const { dispatchEvent, listElement, page } = await compileAndRender(`
      export function App() {
        const users = ['Ada', 'Linus'];
        return (
          <view>
            <list>
              {users.map((name) => (
                <list-item
                  item-key={name}
                  full-span={name === 'Ada'}
                  sticky-top={name === 'Ada'}
                >
                  <text>{name}</text>
                </list-item>
              ))}
            </list>
          </view>
        );
      }
    `);

    expect(mockNativePapi.nativeLog.some(([name]) => name === '__CreateList')).toBe(true);
    expect(page.children).toHaveLength(1);
    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'rLynxElementTemplateHydrate',
        data: expect.any(Array),
      }),
    );
    expect(mockNativePapi.nativeLog).toContainEqual([
      '__SetAttribute',
      '<list />',
      'update-list-info',
      {
        insertAction: [
          {
            position: 0,
            type: expect.any(String),
            'item-key': 'Ada',
            'full-span': true,
            'sticky-top': true,
          },
          {
            position: 1,
            type: expect.any(String),
            'item-key': 'Linus',
            'full-span': false,
            'sticky-top': false,
          },
        ],
        removeAction: [],
        updateAction: [],
      },
    ]);
    // Match the Snapshot list baseline: the container exists first, cells are described through update-list-info,
    // while concrete cells are still pulled by native callbacks.
    expect(serializeToJSX(listElement)).toBe('<list />');

    mockNativePapi.triggerComponentAtIndex(listElement, 0, 11);
    expect(serializeToJSX(listElement).match(/<list-item/g)?.length ?? 0).toBe(1);
    expect(serializeToJSX(listElement)).toContain('item-key="Ada"');
    expect(serializeToJSX(listElement)).toContain('full-span="true"');
    expect(serializeToJSX(listElement)).toContain('sticky-top="true"');
    mockNativePapi.triggerComponentAtIndex(listElement, 0, 12);
    expect(serializeToJSX(listElement).match(/<list-item/g)?.length ?? 0).toBe(1);

    mockNativePapi.triggerComponentAtIndexes(listElement, [0, 1], [21, 22], false, false);

    const listJsx = serializeToJSX(listElement);
    expect(listJsx.match(/<list-item/g)?.length ?? 0).toBe(2);
    expect(listJsx).toContain('text="Ada"');
    expect(listJsx).toContain('text="Linus"');
  });

  it('supports fragment-wrapped list-item sequences', async () => {
    const { listElement } = await compileAndRender(`
      export function App() {
        const users = ['Ada', 'Linus'];
        return (
          <view>
            <list>
              <>
                {users.map((name) => (
                  <list-item item-key={name}>
                    <text>{name}</text>
                  </list-item>
                ))}
              </>
            </list>
          </view>
        );
      }
    `);

    expect(mockNativePapi.nativeLog.some(([name]) => name === '__CreateList')).toBe(true);
    expect(mockNativePapi.nativeLog).toContainEqual([
      '__SetAttribute',
      '<list />',
      'update-list-info',
      {
        insertAction: [
          {
            position: 0,
            type: expect.any(String),
            'item-key': 'Ada',
          },
          {
            position: 1,
            type: expect.any(String),
            'item-key': 'Linus',
          },
        ],
        removeAction: [],
        updateAction: [],
      },
    ]);
    // Match the Snapshot list baseline: the container exists first, cells are described through update-list-info,
    // while concrete cells are still pulled by native callbacks.
    expect(serializeToJSX(listElement)).toBe('<list />');

    mockNativePapi.triggerComponentAtIndexes(listElement, [0, 1], [11, 22], false, true);

    const listJsx = serializeToJSX(listElement);
    expect(listJsx.match(/<list-item/g)?.length ?? 0).toBe(2);
    expect(listJsx).toContain('text="Ada"');
    expect(listJsx).toContain('text="Linus"');
    expect(
      mockNativePapi.nativeLog.some(([name, _node, options]) =>
        name === '__FlushElementTree'
        && typeof options === 'object'
        && options !== null
        && 'asyncFlush' in options
        && options.asyncFlush === true
      ),
    ).toBe(true);
  });

  it('flushes synchronous batch requests through the list container only once', async () => {
    const { listElement } = await compileAndRender(`
      export function App() {
        const users = ['Ada', 'Linus'];
        return (
          <view>
            <list>
              {users.map((name) => (
                <list-item item-key={name}>
                  <text>{name}</text>
                </list-item>
              ))}
            </list>
          </view>
        );
      }
    `);

    const beforeFlushLogIndex = mockNativePapi.nativeLog.length;
    mockNativePapi.triggerComponentAtIndexes(listElement, [0, 1], [11, 22], false, false);

    const flushLogs = mockNativePapi.nativeLog
      .slice(beforeFlushLogIndex)
      .filter(([name]) => name === '__FlushElementTree');

    expect(flushLogs).toHaveLength(1);
    expect(
      flushLogs.some(([, _node, options]) =>
        typeof options === 'object'
        && options !== null
        && 'operationIDs' in options
        && Array.isArray(options.operationIDs)
        && options.operationIDs[0] === 11
        && options.operationIDs[1] === 22
      ),
    ).toBe(true);
    expect(
      flushLogs.every(([, _node, options]) =>
        typeof options === 'object'
        && options !== null
        && !('operationID' in options)
        && !('elementID' in options)
      ),
    ).toBe(true);
  });

  it('replays list root attributes onto the native list container', async () => {
    const { listElement } = await compileAndRender(`
      export function App() {
        const cls = 'shell';
        const style = { color: 'red' };
        return (
          <view>
            <list id="user-list" className={cls} style={style} data-scene="benchmark" role="feed">
              {[1].map((id) => (
                <list-item item-key={String(id)}>
                  <text>{id}</text>
                </list-item>
              ))}
            </list>
          </view>
        );
      }
    `);
    expect(serializeToJSX(listElement)).toContain('id="user-list"');
    expect(serializeToJSX(listElement)).toContain('class="shell"');
    expect(serializeToJSX(listElement)).toContain('data-scene="benchmark"');
    expect(serializeToJSX(listElement)).toContain('role="feed"');
    expect(serializeToJSX(listElement)).toContain('style={{"color":"red"}}');
    expect(mockNativePapi.nativeLog).toContainEqual(['__SetID', '<list />', 'user-list']);
    expect(mockNativePapi.nativeLog).toContainEqual(['__SetClasses', '<list />', 'shell']);
    expect(mockNativePapi.nativeLog).toContainEqual(['__SetInlineStyles', '<list />', { color: 'red' }]);
    expect(mockNativePapi.nativeLog).toContainEqual(['__SetDataset', '<list />', { scene: 'benchmark' }]);
    expect(mockNativePapi.nativeLog).toContainEqual(['__SetAttribute', '<list />', 'role', 'feed']);
  });

  it('lets explicit nullish attrs clear earlier spread values on the list root', async () => {
    const { listElement } = await compileAndRender(`
      export function App() {
        const rest = {
          id: 'spread-id',
          className: 'spread-class',
          role: 'feed',
          'data-scene': 'spread-scene',
        };
        return (
          <view>
            <list {...rest} id={undefined} className={null} role={undefined} data-scene={undefined}>
              {[1].map((id) => (
                <list-item item-key={String(id)}>
                  <text>{id}</text>
                </list-item>
              ))}
            </list>
          </view>
        );
      }
    `);

    expect(serializeToJSX(listElement)).not.toContain('id="spread-id"');
    expect(serializeToJSX(listElement)).not.toContain('class="spread-class"');
    expect(serializeToJSX(listElement)).not.toContain('role="feed"');
    expect(serializeToJSX(listElement)).not.toContain('data-scene="spread-scene"');
  });

  it('skips null branches while preserving remaining list-item order', async () => {
    const { listElement } = await compileAndRender(`
      export function App() {
        const users = [
          { key: 'Ada', visible: true },
          { key: 'Skip', visible: false },
          { key: 'Linus', visible: true },
        ];
        return (
          <view>
            <list>
              {users.map((user) => user.visible ? (
                <list-item item-key={user.key}>
                  <text>{user.key}</text>
                </list-item>
              ) : null)}
            </list>
          </view>
        );
      }
    `);

    expect(mockNativePapi.nativeLog.some(([name]) => name === '__CreateList')).toBe(true);
    expect(mockNativePapi.nativeLog).toContainEqual([
      '__SetAttribute',
      '<list />',
      'update-list-info',
      {
        insertAction: [
          {
            position: 0,
            type: expect.any(String),
            'item-key': 'Ada',
          },
          {
            position: 1,
            type: expect.any(String),
            'item-key': 'Linus',
          },
        ],
        removeAction: [],
        updateAction: [],
      },
    ]);
    // Match the Snapshot list baseline: the container exists first, cells are described through update-list-info,
    // while concrete cells are still pulled by native callbacks.
    expect(serializeToJSX(listElement)).toBe('<list />');

    mockNativePapi.triggerComponentAtIndex(listElement, 0, 11);
    mockNativePapi.triggerComponentAtIndex(listElement, 1, 22);

    const listJsx = serializeToJSX(listElement);
    expect(listJsx.match(/<list-item/g)?.length ?? 0).toBe(2);
    expect(listJsx).toContain('text="Ada"');
    expect(listJsx).toContain('text="Linus"');
    expect(listJsx).not.toContain('text="Skip"');
  });

  it('reapplies only list-item platform info when spread props are present', async () => {
    const { listElement } = await compileAndRender(`
      export function App() {
        const users = [
          {
            key: 'Ada',
            fullSpan: true,
            extra: {
              title: 'user-card',
              'data-track': 'tracked',
            },
          },
        ];
        return (
          <view>
            <list>
              {users.map((user) => (
                <list-item item-key={user.key} full-span={user.fullSpan} {...user.extra}>
                  <text>{user.key}</text>
                </list-item>
              ))}
            </list>
          </view>
        );
      }
    `);

    mockNativePapi.triggerComponentAtIndex(listElement, 0, 11);

    const platformAttrKeys = mockNativePapi.nativeLog
      .filter(([name]) => name === '__SetAttribute')
      .map(([, , key]) => key);

    expect(platformAttrKeys).toContain('item-key');
    expect(platformAttrKeys).toContain('full-span');
    expect(platformAttrKeys).not.toContain('__spread');
    expect(platformAttrKeys).not.toContain('title');
    expect(platformAttrKeys).not.toContain('data-track');
  });

  it('does not emit reuse-notification payloads while first-screen cells are newly created', async () => {
    const { listElement } = await compileAndRender(`
      export function App() {
        const users = ['Ada', 'Linus'];
        return (
          <view>
            <list>
              {users.map((name) => (
                <list-item item-key={name}>
                  <text>{name}</text>
                </list-item>
              ))}
            </list>
          </view>
        );
      }
    `);

    mockNativePapi.triggerComponentAtIndex(listElement, 0, 11, true);
    mockNativePapi.triggerComponentAtIndexes(listElement, [1], [22], true, true);

    expect(
      mockNativePapi.nativeLog.some(([name, _node, options]) =>
        name === '__FlushElementTree'
        && typeof options === 'object'
        && options !== null
        && 'listReuseNotification' in options
      ),
    ).toBe(false);
  });

  it('does not emit reuse-notification payloads for literal item-key values during first-screen creation', async () => {
    const { listElement } = await compileAndRender(`
      export function App() {
        return (
          <view>
            <list>
              <list-item item-key="Ada">
                <text>Ada</text>
              </list-item>
            </list>
          </view>
        );
      }
    `);

    mockNativePapi.triggerComponentAtIndex(listElement, 0, 11, true);

    expect(
      mockNativePapi.nativeLog.some(([name, _node, options]) =>
        name === '__FlushElementTree'
        && typeof options === 'object'
        && options !== null
        && 'listReuseNotification' in options
      ),
    ).toBe(false);
  });

  async function compileAndRender(source: string): Promise<RenderedListFixture> {
    const { transformReactLynx } = await import('@lynx-js/react-transform');
    const result = await transformReactLynx(
      source,
      TRANSFORM_OPTIONS as Parameters<typeof transformReactLynx>[1],
    ) as TransformResult;

    registerTemplates(result.elementTemplates ?? []);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lynx-et-list-'));
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
      const jsContext = globalThis.lynx?.getJSContext?.();
      const dispatchEvent = vi.fn((event: unknown) => jsContext?.dispatchEvent?.(event as never));
      const page = { type: 'page' as const, id: '0', children: [] as unknown[] };
      setRoot({ __jsx: { type: module.App, props: {}, key: null, ref: null } });
      setupPage(page as unknown as FiberElement);
      globalThis.lynx = {
        ...(globalThis.lynx ?? {}),
        reportError: vi.fn(),
        getJSContext: vi.fn(() => ({
          ...(jsContext ?? {}),
          dispatchEvent,
        })),
      } as typeof lynx;

      renderMainThread();

      const listElement = findFirstTag(page, 'list');
      if (!listElement) {
        throw new Error('Expected renderMainThread() to materialize a native list container.');
      }

      return {
        page,
        dispatchEvent,
        listElement,
      };
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
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
});
