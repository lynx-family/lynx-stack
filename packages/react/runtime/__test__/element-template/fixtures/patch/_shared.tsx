// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createElement } from 'preact';
import { vi } from 'vitest';

import { BackgroundElementTemplateInstance } from '../../../../src/element-template/background/instance.js';
import { hydrate as hydrateBackground } from '../../../../src/element-template/background/hydrate.js';
import { installMockNativePapi } from '../../test-utils/mock/mockNativePapi.js';
import {
  installElementTemplatePatchListener,
  resetElementTemplatePatchListener,
} from '../../../../src/element-template/native/patch-listener.js';
import {
  installElementTemplateHydrationListener,
  resetElementTemplateHydrationListener,
} from '../../../../src/element-template/background/hydration-listener.js';
import { installElementTemplateCommitHook } from '../../../../src/element-template/background/commit-hook.js';
import '../../../../src/element-template/native/index.js';
import { ElementTemplateLifecycleConstant } from '../../../../src/element-template/protocol/lifecycle-constant.js';
import type {
  ElementTemplateUpdateCommitContext,
  SerializedElementTemplate,
} from '../../../../src/element-template/protocol/types.js';
import { root } from '../../../../src/element-template/client/root.js';
import { __page } from '../../../../src/element-template/runtime/page/page.js';
import { __root as internalRoot } from '../../../../src/element-template/runtime/page/root-instance.js';
import { resetTemplateId } from '../../../../src/element-template/runtime/template/handle.js';
import { ElementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';
import { registerBuiltinRawTextTemplate } from '../../test-utils/debug/registry.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';
import { compileFixtureSource } from '../../test-utils/debug/compiledFixtureCompiler.js';
import {
  loadCompiledFixtureModule,
  type CompiledFixtureModuleExports,
} from '../../test-utils/debug/compiledFixtureModule.js';
import { primeCompiledFixtureTemplates } from '../../test-utils/debug/compiledFixtureRegistry.js';
import { serializeToJSX } from '../../test-utils/debug/serializer.js';

interface RootWithFirstChild {
  firstChild: BackgroundElementTemplateInstance | null;
}

interface RootNode {
  type: 'root';
}

export interface PatchContext {
  envManager: ElementTemplateEnvManager;
  hydrationData: SerializedElementTemplate[];
  onHydrate: (event: { data: unknown }) => void;
  root: RootNode;
  nativeLog: unknown[];
  cleanupNative: () => void;
}

export interface UpdateFixtureContext {
  envManager: ElementTemplateEnvManager;
  hydrationData: SerializedElementTemplate[];
  updateEvents: ElementTemplateUpdateCommitContext[];
  onHydrate: (event: { data: unknown }) => void;
  onUpdate: (event: { data: unknown }) => void;
  cleanupNative: () => void;
}

export function setupPatchContext(): PatchContext {
  vi.clearAllMocks();
  ElementTemplateRegistry.clear();
  resetTemplateId();
  registerBuiltinRawTextTemplate();

  const installed = installMockNativePapi({ clearTemplatesOnCleanup: false });

  const envManager = new ElementTemplateEnvManager();
  const hydrationData: SerializedElementTemplate[] = [];

  envManager.resetEnv('background');
  envManager.setUseElementTemplate(true);

  // Core context lives on background thread
  installElementTemplateHydrationListener();

  // JS context lives on main thread
  envManager.switchToMainThread();
  installElementTemplatePatchListener();
  envManager.switchToBackground();

  const onHydrate = vi.fn().mockImplementation((event: { data: unknown }) => {
    const data = event.data;
    if (Array.isArray(data)) {
      for (const item of data) {
        hydrationData.push(item as SerializedElementTemplate);
      }
    }
  });
  lynx.getCoreContext().addEventListener(ElementTemplateLifecycleConstant.hydrate, onHydrate);

  return {
    envManager,
    hydrationData,
    onHydrate,
    root: { type: 'root' },
    nativeLog: installed.nativeLog,
    cleanupNative: installed.cleanup,
  };
}

export function setupUpdateFixtureContext(): UpdateFixtureContext {
  vi.clearAllMocks();
  ElementTemplateRegistry.clear();
  resetTemplateId();
  registerBuiltinRawTextTemplate();

  const installed = installMockNativePapi({ clearTemplatesOnCleanup: false });
  const envManager = new ElementTemplateEnvManager();
  const hydrationData: SerializedElementTemplate[] = [];
  const updateEvents: ElementTemplateUpdateCommitContext[] = [];

  envManager.resetEnv('background');
  envManager.setUseElementTemplate(true);

  envManager.switchToBackground();
  installElementTemplateHydrationListener();
  installElementTemplateCommitHook();
  const onHydrate = (event: { data: unknown }) => {
    const data = event.data;
    if (Array.isArray(data)) {
      for (const item of data) {
        hydrationData.push(item as SerializedElementTemplate);
      }
    }
  };
  lynx.getCoreContext().addEventListener(ElementTemplateLifecycleConstant.hydrate, onHydrate);

  envManager.switchToMainThread();
  installElementTemplatePatchListener();
  const onUpdate = (event: { data: unknown }) => {
    updateEvents.push(event.data as ElementTemplateUpdateCommitContext);
  };
  lynx.getJSContext().addEventListener(ElementTemplateLifecycleConstant.update, onUpdate);
  envManager.switchToBackground();

  return {
    envManager,
    hydrationData,
    updateEvents,
    onHydrate,
    onUpdate,
    cleanupNative: installed.cleanup,
  };
}

export function teardownPatchContext(context: PatchContext): void {
  try {
    context.cleanupNative();
  } finally {
    context.envManager.switchToBackground();
    resetElementTemplateHydrationListener();
    lynx.getCoreContext().removeEventListener(ElementTemplateLifecycleConstant.hydrate, context.onHydrate);

    context.envManager.switchToMainThread();
    resetElementTemplatePatchListener();

    context.envManager.setUseElementTemplate(false);
    (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
  }
}

export function teardownUpdateFixtureContext(context: UpdateFixtureContext): void {
  try {
    context.cleanupNative();
  } finally {
    context.envManager.switchToBackground();
    resetElementTemplateHydrationListener();
    lynx.getCoreContext().removeEventListener(ElementTemplateLifecycleConstant.hydrate, context.onHydrate);

    context.envManager.switchToMainThread();
    lynx.getJSContext().removeEventListener(ElementTemplateLifecycleConstant.update, context.onUpdate);
    resetElementTemplatePatchListener();

    context.envManager.setUseElementTemplate(false);
    (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
  }
}

export function renderAndCollect(App: () => JSX.Element, context: PatchContext): {
  before: SerializedElementTemplate;
  after: BackgroundElementTemplateInstance;
} {
  root.render(<App />);
  context.envManager.switchToMainThread();
  (globalThis as { renderPage: () => void }).renderPage();
  context.envManager.switchToBackground();

  const before = context.hydrationData[0];
  if (!before) {
    throw new Error('Missing hydration data.');
  }

  const backgroundRoot = internalRoot as unknown as RootWithFirstChild;
  const after = backgroundRoot.firstChild;
  if (!after) {
    throw new Error('Missing background root child.');
  }

  return { before, after };
}

function resolveCompiledFixtureProps(
  moduleExports: CompiledFixtureModuleExports,
  thread: 'main' | 'background',
): Record<string, unknown> {
  return thread === 'main'
    ? (moduleExports.mainProps ?? {})
    : (moduleExports.backgroundProps ?? {});
}

export async function runCompiledPatchScenario(sourcePath: string): Promise<{
  files: {
    'after-jsx.txt': string;
    'before-jsx.txt': string;
    'ops.txt': ElementTemplateUpdateCommandStream;
  };
}> {
  const context = setupPatchContext();
  try {
    const mainArtifact = await compileFixtureSource(sourcePath, { target: 'LEPUS' });
    primeCompiledFixtureTemplates(mainArtifact);
    const mainModule = await loadCompiledFixtureModule(mainArtifact);

    const backgroundArtifact = await compileFixtureSource(sourcePath, { target: 'JS' });
    const backgroundModule = await loadCompiledFixtureModule(backgroundArtifact);

    context.envManager.switchToBackground();
    root.render(createElement(
      backgroundModule.App,
      resolveCompiledFixtureProps(backgroundModule, 'background'),
    ));

    context.envManager.switchToMainThread();
    root.render(createElement(
      mainModule.App,
      resolveCompiledFixtureProps(mainModule, 'main'),
    ));
    (globalThis as { renderPage: () => void }).renderPage();
    const beforeJSX = serializeToJSX(__page);

    context.envManager.switchToBackground();
    const beforeData = context.hydrationData[0];
    if (!beforeData) {
      throw new Error('Missing compiled patch hydration data.');
    }

    const backgroundRoot = internalRoot as unknown as RootWithFirstChild;
    const afterData = backgroundRoot.firstChild;
    if (!afterData) {
      throw new Error('Missing compiled patch background root child.');
    }

    const ops = hydrateBackground(beforeData, afterData);

    context.envManager.switchToMainThread();
    const afterJSX = serializeToJSX(__page);

    return {
      files: {
        'before-jsx.txt': beforeJSX,
        'after-jsx.txt': afterJSX,
        'ops.txt': ops,
      },
    };
  } finally {
    teardownPatchContext(context);
  }
}
