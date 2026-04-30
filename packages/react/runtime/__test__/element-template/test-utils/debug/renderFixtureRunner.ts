import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { vi } from 'vitest';

import { resetElementTemplateHydrationListener } from '../../../../src/element-template/background/hydration-listener.js';
import { renderOpcodesIntoElementTemplate } from '../../../../src/element-template/runtime/render/render-opcodes.js';
import { resetTemplateId } from '../../../../src/element-template/runtime/template/handle.js';
import { ElementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';
import { renderToString } from '../../../../src/element-template/runtime/render/render-to-opcodes.js';
import {
  assertMissingFile,
  assertOrUpdateTextFile,
  expectReportErrorCount,
  formatFixtureOutput,
  runFixtureTests,
} from './fixtureRunner.js';
import { installMockNativePapi } from '../mock/mockNativePapi.js';
import { registerBuiltinRawTextTemplate, registerTemplates } from './registry.js';
import { serializeToJSX } from './serializer.js';

declare global {
  var __USE_ELEMENT_TEMPLATE__: boolean | undefined;
}

interface RootNode {
  type: 'page';
  id: string;
  children: unknown[];
}

interface TransformResult {
  code?: string;
  elementTemplates?: unknown[];
}

interface RegisteredTemplateFixture {
  templateId: string;
  compiledTemplate: unknown;
}

interface CaseFixtureModule {
  run: (context: { fixtureDir: string; fixtureName: string }) => Promise<unknown> | unknown;
  reportErrorCount?: number;
}

interface CaseFixtureResult {
  output?: unknown;
  files?: Record<string, unknown>;
}

export function runRenderFixtureTests(fixturesRoot: string): void {
  runFixtureTests({
    fixturesRoot,
    async run({ fixtureDir, fixtureName, update, tempDir }) {
      const casePath = fs.existsSync(path.join(fixtureDir, 'case.ts'))
        ? path.join(fixtureDir, 'case.ts')
        : path.join(fixtureDir, 'case.tsx');
      if (fs.existsSync(casePath)) {
        await runCaseFixture({
          casePath,
          fixtureDir,
          fixtureName,
          update,
        });
        return;
      }

      await runCompiledRenderFixture({
        fixtureDir,
        fixtureName,
        tempDir,
        update,
      });
    },
  });
}

async function runCaseFixture(options: {
  casePath: string;
  fixtureDir: string;
  fixtureName: string;
  update: boolean;
}): Promise<void> {
  const { casePath, fixtureDir, fixtureName, update } = options;
  const caseModule = (await import(pathToFileURL(casePath).href)) as CaseFixtureModule;
  const reportErrorCount = caseModule.reportErrorCount ?? 0;
  const result = await caseModule.run({ fixtureDir, fixtureName });
  const normalized = normalizeCaseFixtureResult(result);

  expectReportErrorCount(reportErrorCount);
  if (normalized.files) {
    for (const [fileName, value] of Object.entries(normalized.files)) {
      assertOrUpdateTextFile({
        path: path.join(fixtureDir, fileName),
        actual: formatFixtureOutput(value),
        update,
        fixtureName,
        label: fileName,
      });
    }
  }

  const hasOutputFile = normalized.files
    ? Object.prototype.hasOwnProperty.call(normalized.files, 'output.txt')
    : false;
  if (normalized.output !== undefined && !hasOutputFile) {
    assertOrUpdateTextFile({
      path: path.join(fixtureDir, 'output.txt'),
      actual: formatFixtureOutput(normalized.output),
      update,
      fixtureName,
      label: 'output',
    });
  }
}

async function runCompiledRenderFixture(options: {
  fixtureDir: string;
  fixtureName: string;
  tempDir: string;
  update: boolean;
}): Promise<void> {
  const { fixtureDir, fixtureName, tempDir, update } = options;
  const sourcePath = path.join(fixtureDir, 'index.tsx');
  const compiledJsPath = path.join(fixtureDir, 'index.js.txt');
  const templatesPath = path.join(fixtureDir, 'templates.json.txt');
  const expectedPath = path.join(fixtureDir, 'output.txt');
  const papiPath = path.join(fixtureDir, 'papi.txt');
  const tempImportPath = path.join(tempDir, 'temp_actual.js');

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file missing for fixture "${fixtureName}"`);
  }

  vi.resetAllMocks();
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

  const installed = installMockNativePapi({ clearTemplatesOnCleanup: true });
  const nativeLog = installed.nativeLog as unknown[];
  const cleanup = installed.cleanup;
  const root: RootNode = { type: 'page', id: '0', children: [] };

  try {
    const code = fs.readFileSync(sourcePath, 'utf8');
    const { transformReactLynx } = await import('@lynx-js/react-transform');
    const transformOptions = {
      mode: 'test',
      pluginName: 'test-plugin',
      filename: 'index.tsx',
      sourcemap: false,
      cssScope: false,
      elementTemplate: {
        preserveJsx: false,
        runtimePkg: '@lynx-js/react/element-template/internal',
        filename: 'index.tsx',
        target: 'LEPUS',
      },
      shake: false,
      compat: true,
      directiveDCE: false,
      defineDCE: false,
      worklet: false,
      refresh: false,
    } as Parameters<typeof transformReactLynx>[1];
    const result = (await transformReactLynx(code, transformOptions)) as TransformResult;

    let outputCode = result.code ?? '';
    outputCode = outputCode.replace(/from ["']react\/jsx-runtime["']/g, 'from "@lynx-js/react/jsx-runtime"');

    const outputTemplates = result.elementTemplates ? JSON.stringify(result.elementTemplates, null, 2) : '';

    assertOrUpdateTextFile({
      path: compiledJsPath,
      actual: outputCode,
      update,
      fixtureName,
      label: 'compiled js',
    });

    if (outputTemplates) {
      assertOrUpdateTextFile({
        path: templatesPath,
        actual: outputTemplates,
        update,
        fixtureName,
        label: 'templates',
      });
    } else {
      assertMissingFile({
        path: templatesPath,
        update,
        fixtureName,
        label: 'templates',
      });
    }

    if (update && outputTemplates) {
      registerBuiltinRawTextTemplate();
      registerTemplates(JSON.parse(outputTemplates) as RegisteredTemplateFixture[]);
    } else if (fs.existsSync(templatesPath)) {
      registerBuiltinRawTextTemplate();
      const templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8')) as RegisteredTemplateFixture[];
      registerTemplates(templates);
    }

    fs.writeFileSync(tempImportPath, outputCode);
    try {
      const module = (await import(`${pathToFileURL(tempImportPath).href}?t=${Date.now()}`)) as { App: unknown };
      const vnode = { type: module.App, props: {}, key: null, ref: null };
      const opcodes = renderToString(vnode, null);
      const { rootRefs } = renderOpcodesIntoElementTemplate(opcodes);
      for (const rootRef of rootRefs) {
        __AppendElement(root as FiberElement, rootRef);
      }

      assertOrUpdateTextFile({
        path: expectedPath,
        actual: serializeToJSX(root.children[0]),
        update,
        fixtureName,
        label: 'jsx output',
      });
      assertOrUpdateTextFile({
        path: papiPath,
        actual: JSON.stringify(nativeLog, null, 2),
        update,
        fixtureName,
        label: 'papi log',
      });
    } finally {
      if (fs.existsSync(tempImportPath)) {
        fs.unlinkSync(tempImportPath);
      }
    }

    expectReportErrorCount(0);
  } finally {
    resetElementTemplateHydrationListener();
    cleanup();
    globalThis.__USE_ELEMENT_TEMPLATE__ = undefined;
  }
}

function normalizeCaseFixtureResult(result: unknown): CaseFixtureResult {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return { output: result };
  }

  const candidate = result as CaseFixtureResult;
  if ('output' in candidate || 'files' in candidate) {
    return {
      output: candidate.output,
      files: candidate.files,
    };
  }

  return { output: result };
}
