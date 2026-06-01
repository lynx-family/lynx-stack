import { compileFixtureSource, type CompiledFixtureTarget } from './compiledFixtureCompiler.js';
import { loadCompiledFixtureModule } from './compiledFixtureModule.js';
import { installCompiledFixtureTemplates } from './compiledFixtureRegistry.js';

interface LoadCompiledFixtureAppOptions {
  target?: CompiledFixtureTarget;
  registerCompiledTemplates?: boolean;
}

export async function loadCompiledFixtureApp(
  sourcePath: string,
  options: LoadCompiledFixtureAppOptions = {},
): Promise<() => JSX.Element> {
  const {
    target = 'LEPUS',
    registerCompiledTemplates = true,
  } = options;
  const artifact = await compileFixtureSource(sourcePath, { target });

  if (registerCompiledTemplates) {
    installCompiledFixtureTemplates(artifact);
  }

  const module = await loadCompiledFixtureModule(artifact);
  return module.App;
}
