import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TransformNodiffOutput } from '@lynx-js/react-transform';
import { transformReactLynx } from '@lynx-js/react-transform';

import { renderOpcodesIntoElementTemplate } from '../../../../src/element-template/runtime/render/render-opcodes.js';
import { resetTemplateId } from '../../../../src/element-template/runtime/template/handle.js';
import { elementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';
import { renderToString } from '../../../../src/element-template/runtime/render/render-to-opcodes.js';
import { clearTemplates, registerBuiltinRawTextTemplate, registerTemplates } from '../../test-utils/debug/registry.js';
import { installMockNativePapi, lastMock } from '../../test-utils/mock/mockNativePapi.js';

interface CompileOptions {
  isDynamicComponent?: boolean;
}

interface RenderResult {
  rootRef: ElementRef;
  userTemplateIds: string[];
}

function findUserTemplateCreateLog(): unknown[] | undefined {
  return lastMock!.nativeLog.find((entry) =>
    Array.isArray(entry)
    && entry[0] === '__CreateElementTemplate'
    && entry[1] !== '_et_builtin_raw_text'
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
      .filter(template => template.templateId !== '_et_builtin_raw_text')
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
      elementTemplate: {
        preserveJsx: false,
        runtimePkg: '@lynx-js/react/element-template/internal',
        jsxImportSource: '@lynx-js/react',
        filename: 'source.tsx',
        target: 'LEPUS',
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
      userTemplateIds: (result.elementTemplates ?? [])
        .map(template => template.templateId)
        .filter(templateId => templateId !== '_et_builtin_raw_text'),
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

describe('render transform contract', () => {
  beforeEach(() => {
    installMockNativePapi({ clearTemplatesOnCleanup: true });
    clearTemplates();
    elementTemplateRegistry.clear();
    resetTemplateId();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    clearTemplates();
    elementTemplateRegistry.clear();
    resetTemplateId();
  });

  it('does not pass legacy css-id metadata through ET create', async () => {
    const { rootRef, userTemplateIds } = await compileAndRender(`
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
    expect(elementTemplateRegistry.get(-1)).toMatchObject({
      attributes: { id: 'main' },
    });
    expect(userTemplateIds).toEqual([
      expect.stringMatching(/^_et_[0-9a-f]{12}$/),
    ]);
    expect(findUserTemplateCreateLog()).toEqual([
      '__CreateElementTemplate',
      expect.stringMatching(/^_et_[0-9a-f]{12}$/),
      null,
      null,
      null,
      -1,
    ]);
  });

  it('does not pass legacy entry-name metadata through ET create for dynamic component output', async () => {
    vi.stubGlobal('globDynamicComponentEntry', 'lazy-entry');

    const { rootRef, userTemplateIds } = await compileAndRender(
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
    expect(elementTemplateRegistry.get(-1)).toMatchObject({
      attributes: { id: 'lazy' },
    });
    expect(userTemplateIds).toEqual([
      expect.stringMatching(/^_et_[0-9a-f]{12}$/),
    ]);
    expect(userTemplateIds[0]).not.toContain(':');
    expect(findUserTemplateCreateLog()).toEqual([
      '__CreateElementTemplate',
      expect.stringMatching(/^lazy-entry:_et_[0-9a-f]{12}$/),
      null,
      null,
      null,
      -1,
    ]);
  });
});
