import { vi } from 'vitest';

import { hydrate as hydrateBackground } from '../../../../src/element-template/background/hydrate.js';
import type { BackgroundElementTemplateInstance } from '../../../../src/element-template/background/instance.js';
import { ElementTemplateLifecycleConstant } from '../../../../src/element-template/protocol/lifecycle-constant.js';
import type {
  ElementTemplateUpdateCommandStream,
  SerializedElementTemplate,
} from '../../../../src/element-template/protocol/types.js';
import { installMockNativePapi } from '../mock/mockNativePapi.js';
import { compileFixtureSource, type CompiledFixtureTarget } from './compiledFixtureCompiler.js';
import { loadCompiledFixtureModule } from './compiledFixtureModule.js';
import { ElementTemplateEnvManager } from './envManager.js';
import { primeCompiledFixtureTemplates } from './compiledFixtureRegistry.js';
import {
  renderCompiledFixtureOnBackground,
  renderCompiledFixtureOnMainThread,
} from './compiledThreadRunner.js';

interface RunCompiledHydrationScenarioOptions {
  backgroundProps?: Record<string, unknown>;
  backgroundTarget?: CompiledFixtureTarget;
  mainProps?: Record<string, unknown>;
  mainTarget?: CompiledFixtureTarget;
  sourcePath: string;
}

export interface CompiledHydrationScenarioResult {
  after: BackgroundElementTemplateInstance;
  before: SerializedElementTemplate;
  stream: ElementTemplateUpdateCommandStream;
}

export async function runCompiledHydrationScenario(
  options: RunCompiledHydrationScenarioOptions,
): Promise<CompiledHydrationScenarioResult> {
  const {
    backgroundProps,
    backgroundTarget = 'JS',
    mainProps,
    mainTarget = 'LEPUS',
    sourcePath,
  } = options;

  vi.clearAllMocks();
  const mockNative = installMockNativePapi({ clearTemplatesOnCleanup: true });
  const envManager = new ElementTemplateEnvManager();
  envManager.resetEnv('background');
  envManager.setUseElementTemplate(true);

  const hydrationData: SerializedElementTemplate[] = [];
  const onHydrate = vi.fn().mockImplementation((event: { data: unknown }) => {
    const data = event.data;
    if (Array.isArray(data)) {
      hydrationData.push(...data as SerializedElementTemplate[]);
    }
  });
  lynx.getCoreContext().addEventListener(ElementTemplateLifecycleConstant.hydrate, onHydrate);

  try {
    const mainArtifact = await compileFixtureSource(sourcePath, { target: mainTarget });
    primeCompiledFixtureTemplates(mainArtifact);
    const mainModule = await loadCompiledFixtureModule(mainArtifact);
    renderCompiledFixtureOnMainThread(mainModule, envManager, mainProps);

    const before = hydrationData[0];
    if (!before) {
      throw new Error('Missing compiled main-thread hydration data.');
    }

    const backgroundArtifact = await compileFixtureSource(sourcePath, { target: backgroundTarget });
    const backgroundModule = await loadCompiledFixtureModule(backgroundArtifact);
    const after = renderCompiledFixtureOnBackground(backgroundModule, envManager, backgroundProps);
    if (!after) {
      throw new Error('Missing compiled background root child.');
    }

    return {
      after,
      before,
      stream: hydrateBackground(before, after),
    };
  } finally {
    envManager.switchToBackground();
    lynx.getCoreContext().removeEventListener(ElementTemplateLifecycleConstant.hydrate, onHydrate);
    envManager.setUseElementTemplate(false);
    mockNative.cleanup();
  }
}
