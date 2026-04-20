import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TransformNodiffOutput } from '@lynx-js/react-transform';
import { transformReactLynx } from '@lynx-js/react-transform';

import { renderOpcodesIntoElementTemplate } from '../../../../src/element-template/runtime/render/render-opcodes.js';
import { resetTemplateId } from '../../../../src/element-template/runtime/template/handle.js';
import { ElementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';
import { renderToString } from '../../../../src/element-template/runtime/render/render-to-opcodes.js';
import { clearTemplates, registerBuiltinRawTextTemplate, registerTemplates } from '../../test-utils/debug/registry.js';
import { installMockNativePapi, lastMock } from '../../test-utils/mock/mockNativePapi.js';

interface CompileOptions {
  isDynamicComponent?: boolean;
}

interface RenderResult {
  rootRef: ElementRef;
}

function findUserTemplateCreateLog(): unknown[] | undefined {
  return lastMock!.nativeLog.find((entry) =>
    Array.isArray(entry)
    && entry[0] === '__CreateElementTemplate'
    && entry[1] !== '__et_builtin_raw_text__'
  ) as unknown[];
}

function registerCompiledTemplates(
  result: TransformNodiffOutput,
  entryName: string | undefined,
): void {
  const templates = result.elementTemplates ?? [];

  clearTemplates();
  registerBuiltinRawTextTemplate();
  registerTemplates(templates);

  if (!entryName) {
    return;
  }

  registerTemplates(
    templates
      .filter(template => template.templateId !== '__et_builtin_raw_text__')
      .map(template => ({
        ...template,
        templateId: `${entryName}:${template.templateId}`,
      })),
  );
}

async function compileAndRender(
  source: string,
  options: CompileOptions = {},
): Promise<RenderResult> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'et-runtime-transform-'));
  const tempImportPath = path.join(tempDir, 'compiled.mjs');

  try {
    globalThis.__USE_ELEMENT_TEMPLATE__ = true;
    globalThis.__LEPUS__ = true;
    globalThis.__JS__ = false;
    globalThis.__MAIN_THREAD__ = true;
    globalThis.__BACKGROUND__ = false;

    const entryName = options.isDynamicComponent
      ? String(globalThis.globDynamicComponentEntry)
      : undefined;

    const result = await transformReactLynx(source, {
      mode: 'test',
      pluginName: 'runtime-transform-contract',
      filename: 'source.tsx',
      sourcemap: false,
      cssScope: false,
      snapshot: {
        preserveJsx: false,
        runtimePkg: '@lynx-js/react/element-template/internal',
        jsxImportSource: '@lynx-js/react',
        filename: 'source.tsx',
        target: 'LEPUS',
        experimentalEnableElementTemplate: true,
        isDynamicComponent: options.isDynamicComponent ?? false,
      },
      shake: false,
      compat: true,
      directiveDCE: false,
      defineDCE: false,
      worklet: false,
      refresh: false,
    }) as TransformNodiffOutput;

    let outputCode = result.code;
    outputCode = outputCode.replace(/from ["']react\/jsx-runtime["']/g, 'from "@lynx-js/react/jsx-runtime"');

    registerCompiledTemplates(result, entryName);

    fs.writeFileSync(tempImportPath, outputCode);
    const module = (await import(`${pathToFileURL(tempImportPath).href}?t=${Date.now()}`)) as {
      App: unknown;
    };

    const vnode = { type: module.App, props: {}, key: null, ref: null };
    const opcodes = renderToString(vnode, null);
    const { rootRefs } = renderOpcodesIntoElementTemplate(opcodes);

    expect(rootRefs).toHaveLength(1);

    return {
      rootRef: rootRefs[0]!,
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

describe('render transform contract', () => {
  beforeEach(() => {
    installMockNativePapi({ clearTemplatesOnCleanup: true });
    clearTemplates();
    ElementTemplateRegistry.clear();
    resetTemplateId();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    clearTemplates();
    ElementTemplateRegistry.clear();
    resetTemplateId();
  });

  it('does not pass legacy css-id metadata through ET create', async () => {
    const { rootRef } = await compileAndRender(`
      /**
       * @jsxCSSId 100
       */
      export function App() {
        return (
          <view id="main">
            <text>Hello</text>
          </view>
        );
      }
    `);

    expect(rootRef).toMatchObject({
      tag: 'view',
      attributes: {
        id: 'main',
      },
      __handleId: -1,
    });
    expect(ElementTemplateRegistry.get(-1)).toMatchObject({
      attributes: { id: 'main' },
    });
    expect(findUserTemplateCreateLog()).toEqual([
      '__CreateElementTemplate',
      '_et_7079c_test_1',
      null,
      null,
      null,
      -1,
    ]);
  });

  it('does not pass legacy entry-name metadata through ET create for dynamic component output', async () => {
    vi.stubGlobal('globDynamicComponentEntry', 'lazy-entry');

    const { rootRef } = await compileAndRender(
      `
      export function App() {
        return (
          <view id="lazy">
            <text>Dynamic</text>
          </view>
        );
      }
    `,
      {
        isDynamicComponent: true,
      },
    );

    expect(rootRef).toMatchObject({
      tag: 'view',
      attributes: {
        id: 'lazy',
      },
      __handleId: -1,
    });
    expect(ElementTemplateRegistry.get(-1)).toMatchObject({
      attributes: { id: 'lazy' },
    });
    expect(findUserTemplateCreateLog()).toEqual([
      '__CreateElementTemplate',
      'lazy-entry:_et_7079c_test_1',
      null,
      null,
      null,
      -1,
    ]);
  });

  it('hoists list into its own ET template and tags list roots with runtime create options', async () => {
    const result = await transformReactLynx(
      `
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
    `,
      {
        mode: 'test',
        pluginName: 'runtime-transform-contract',
        filename: 'source.tsx',
        sourcemap: false,
        cssScope: false,
        snapshot: {
          preserveJsx: false,
          runtimePkg: '@lynx-js/react/element-template/internal',
          jsxImportSource: '@lynx-js/react',
          filename: 'source.tsx',
          target: 'LEPUS',
          experimentalEnableElementTemplate: true,
          isDynamicComponent: false,
        },
        shake: false,
        compat: true,
        directiveDCE: false,
        defineDCE: false,
        worklet: false,
        refresh: false,
      },
    ) as TransformNodiffOutput;

    expect(result.code).toContain('__elementTemplateList: true');

    const templates = result.elementTemplates ?? [];
    const listTemplate = templates.find((template) => (template.compiledTemplate as { type?: string }).type === 'list');
    const viewTemplate = templates.find((template) => (template.compiledTemplate as { type?: string }).type === 'view');

    expect(listTemplate).toBeDefined();
    expect(viewTemplate).toBeDefined();
    expect((viewTemplate?.compiledTemplate as { children?: unknown[] }).children).toEqual([
      {
        kind: 'elementSlot',
        type: 'slot',
        elementSlotIndex: 0,
      },
    ]);
  });

  it('only marks non-deferred list roots for the ET fast-path', async () => {
    const deferredResult = await transformReactLynx(
      `
      export function App() {
        return (
          <view>
            <list>
              <list-item defer item-key="Ada">
                <text>Ada</text>
              </list-item>
            </list>
          </view>
        );
      }
    `,
      {
        mode: 'test',
        pluginName: 'runtime-transform-contract',
        filename: 'source.tsx',
        sourcemap: false,
        cssScope: false,
        snapshot: {
          preserveJsx: false,
          runtimePkg: '@lynx-js/react/element-template/internal',
          jsxImportSource: '@lynx-js/react',
          filename: 'source.tsx',
          target: 'LEPUS',
          experimentalEnableElementTemplate: true,
          isDynamicComponent: false,
        },
        shake: false,
        compat: true,
        directiveDCE: false,
        defineDCE: false,
        worklet: false,
        refresh: false,
      },
    ) as TransformNodiffOutput;

    const nonDeferredResult = await transformReactLynx(
      `
      export function App() {
        return (
          <view>
            <list>
              <list-item defer={false} item-key="Ada">
                <text>Ada</text>
              </list-item>
            </list>
          </view>
        );
      }
    `,
      {
        mode: 'test',
        pluginName: 'runtime-transform-contract',
        filename: 'source.tsx',
        sourcemap: false,
        cssScope: false,
        snapshot: {
          preserveJsx: false,
          runtimePkg: '@lynx-js/react/element-template/internal',
          jsxImportSource: '@lynx-js/react',
          filename: 'source.tsx',
          target: 'LEPUS',
          experimentalEnableElementTemplate: true,
          isDynamicComponent: false,
        },
        shake: false,
        compat: true,
        directiveDCE: false,
        defineDCE: false,
        worklet: false,
        refresh: false,
      },
    ) as TransformNodiffOutput;

    const stringLiteralDeferredResult = await transformReactLynx(
      `
      export function App() {
        return (
          <view>
            <list>
              <list-item defer="false" item-key="Ada">
                <text>Ada</text>
              </list-item>
            </list>
          </view>
        );
      }
    `,
      {
        mode: 'test',
        pluginName: 'runtime-transform-contract',
        filename: 'source.tsx',
        sourcemap: false,
        cssScope: false,
        snapshot: {
          preserveJsx: false,
          runtimePkg: '@lynx-js/react/element-template/internal',
          jsxImportSource: '@lynx-js/react',
          filename: 'source.tsx',
          target: 'LEPUS',
          experimentalEnableElementTemplate: true,
          isDynamicComponent: false,
        },
        shake: false,
        compat: true,
        directiveDCE: false,
        defineDCE: false,
        worklet: false,
        refresh: false,
      },
    ) as TransformNodiffOutput;

    const behavioralAttrResult = await transformReactLynx(
      `
      export function App() {
        const handleTap = () => {};
        return (
          <view>
            <list bindtap={handleTap}>
              <list-item item-key="Ada">
                <text>Ada</text>
              </list-item>
            </list>
          </view>
        );
      }
    `,
      {
        mode: 'test',
        pluginName: 'runtime-transform-contract',
        filename: 'source.tsx',
        sourcemap: false,
        cssScope: false,
        snapshot: {
          preserveJsx: false,
          runtimePkg: '@lynx-js/react/element-template/internal',
          jsxImportSource: '@lynx-js/react',
          filename: 'source.tsx',
          target: 'LEPUS',
          experimentalEnableElementTemplate: true,
          isDynamicComponent: false,
        },
        shake: false,
        compat: true,
        directiveDCE: false,
        defineDCE: false,
        worklet: false,
        refresh: false,
      },
    ) as TransformNodiffOutput;

    const spreadBehavioralAttrResult = await transformReactLynx(
      `
      export function App() {
        const props = { bindtap: () => {} };
        return (
          <view>
            <list {...props}>
              <list-item item-key="Ada">
                <text>Ada</text>
              </list-item>
            </list>
          </view>
        );
      }
    `,
      {
        mode: 'test',
        pluginName: 'runtime-transform-contract',
        filename: 'source.tsx',
        sourcemap: false,
        cssScope: false,
        snapshot: {
          preserveJsx: false,
          runtimePkg: '@lynx-js/react/element-template/internal',
          jsxImportSource: '@lynx-js/react',
          filename: 'source.tsx',
          target: 'LEPUS',
          experimentalEnableElementTemplate: true,
          isDynamicComponent: false,
        },
        shake: false,
        compat: true,
        directiveDCE: false,
        defineDCE: false,
        worklet: false,
        refresh: false,
      },
    ) as TransformNodiffOutput;

    const spreadRefResult = await transformReactLynx(
      `
      export function App() {
        const props = { ref: () => {} };
        return (
          <view>
            <list {...props}>
              <list-item item-key="Ada">
                <text>Ada</text>
              </list-item>
            </list>
          </view>
        );
      }
    `,
      {
        mode: 'test',
        pluginName: 'runtime-transform-contract',
        filename: 'source.tsx',
        sourcemap: false,
        cssScope: false,
        snapshot: {
          preserveJsx: false,
          runtimePkg: '@lynx-js/react/element-template/internal',
          jsxImportSource: '@lynx-js/react',
          filename: 'source.tsx',
          target: 'LEPUS',
          experimentalEnableElementTemplate: true,
          isDynamicComponent: false,
        },
        shake: false,
        compat: true,
        directiveDCE: false,
        defineDCE: false,
        worklet: false,
        refresh: false,
      },
    ) as TransformNodiffOutput;

    expect(deferredResult.code).not.toContain('__elementTemplateList: true');
    expect(nonDeferredResult.code).toContain('__elementTemplateList: true');
    expect(stringLiteralDeferredResult.code).not.toContain('__elementTemplateList: true');
    expect(behavioralAttrResult.code).not.toContain('__elementTemplateList: true');
    expect(spreadBehavioralAttrResult.code).not.toContain('__elementTemplateList: true');
    expect(spreadRefResult.code).not.toContain('__elementTemplateList: true');
  });
});
