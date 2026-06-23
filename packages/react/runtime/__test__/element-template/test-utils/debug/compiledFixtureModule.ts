import {
  compileFixtureSource,
  type CompiledFixtureArtifact,
  type CompiledFixtureTarget,
} from './compiledFixtureCompiler.js';
import { evaluateCompiledModule } from './compiledModuleEval.js';
import { primeCompiledFixtureTemplates } from './compiledFixtureRegistry.js';

export interface CompiledFixtureModuleExports {
  App: (props?: Record<string, unknown>) => JSX.Element;
  mainProps?: Record<string, unknown>;
  backgroundProps?: Record<string, unknown>;
}

export async function loadCompiledFixtureModule<T extends object = CompiledFixtureModuleExports>(
  artifact: CompiledFixtureArtifact,
): Promise<T> {
  // Evaluate the compiled module in-process (see compiledModuleEval.ts). Writing
  // it to a temp file and `import()`ing escapes rspack into Node's loader, which
  // cannot resolve the bare `@lynx-js/react/*` (TypeScript src) specifiers.
  return evaluateCompiledModule<T>(artifact.code);
}

interface LoadCompiledFixturePairOptions {
  backgroundTarget?: CompiledFixtureTarget;
  enableWorkletTransform?: boolean;
  isDynamicComponent?: boolean;
  mainTarget?: CompiledFixtureTarget;
  registerMainTemplates?: boolean;
}

export async function loadCompiledFixturePair<T extends object = CompiledFixtureModuleExports>(
  sourcePath: string,
  options: LoadCompiledFixturePairOptions = {},
): Promise<{
  backgroundModule: T;
  mainModule: T;
}> {
  const {
    backgroundTarget = 'JS',
    enableWorkletTransform = false,
    isDynamicComponent = false,
    mainTarget = 'LEPUS',
    registerMainTemplates = true,
  } = options;

  const mainArtifact = await compileFixtureSource(sourcePath, {
    enableWorkletTransform,
    isDynamicComponent,
    target: mainTarget,
  });
  if (registerMainTemplates) {
    primeCompiledFixtureTemplates(mainArtifact);
  }
  const mainModule = await loadCompiledFixtureModule<T>(mainArtifact);

  const backgroundArtifact = await compileFixtureSource(sourcePath, {
    enableWorkletTransform,
    isDynamicComponent,
    target: backgroundTarget,
  });
  const backgroundModule = await loadCompiledFixtureModule<T>(backgroundArtifact);

  return { backgroundModule, mainModule };
}
