import { vi } from 'vitest';

import type { BackgroundElementTemplateInstance } from '../../../../src/element-template/background/instance.js';
import { ElementTemplateLifecycleConstant } from '../../../../src/element-template/protocol/lifecycle-constant.js';
import type {
  ElementTemplateUpdateCommandStream,
  SerializedEtNode,
} from '../../../../src/element-template/protocol/types.js';
import { installMockNativePapi } from '../mock/mockNativePapi.js';
import type { CompiledFixtureTarget } from './compiledFixtureCompiler.js';
import { loadCompiledFixturePair } from './compiledFixtureModule.js';
import { ElementTemplateEnvManager } from './envManager.js';
import { hydrateBackground } from './hydrate.js';
import { renderCompiledFixtureOnBackground, renderCompiledFixtureOnMainThread } from './compiledThreadRunner.js';

interface RunCompiledHydrationScenarioOptions {
  backgroundProps?: Record<string, unknown>;
  backgroundTarget?: CompiledFixtureTarget;
  mainProps?: Record<string, unknown>;
  mainTarget?: CompiledFixtureTarget;
  sourcePath: string;
}

export interface CompiledHydrationScenarioResult {
  after: BackgroundElementTemplateInstance;
  before: SerializedEtNode;
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

  const hydrationData: SerializedEtNode[] = [];
  const onHydrate = vi.fn().mockImplementation((event: { data: { instances: SerializedEtNode[] } }) => {
    hydrationData.push(...event.data.instances);
  });
  lynx.getCoreContext().addEventListener(ElementTemplateLifecycleConstant.hydrate, onHydrate);

  try {
    const { backgroundModule, mainModule } = await loadCompiledFixturePair(sourcePath, {
      backgroundTarget,
      mainTarget,
    });
    renderCompiledFixtureOnMainThread(mainModule, envManager, mainProps);

    const before = hydrationData[0];
    if (!before) {
      throw new Error('Missing compiled main-thread hydration data.');
    }

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
