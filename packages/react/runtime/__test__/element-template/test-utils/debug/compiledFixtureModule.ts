import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  compileFixtureSource,
  type CompiledFixtureArtifact,
  type CompiledFixtureTarget,
} from './compiledFixtureCompiler.js';
import { primeCompiledFixtureTemplates } from './compiledFixtureRegistry.js';

export interface CompiledFixtureModuleExports {
  App: (props?: Record<string, unknown>) => JSX.Element;
  mainProps?: Record<string, unknown>;
  backgroundProps?: Record<string, unknown>;
}

export async function loadCompiledFixtureModule<T extends object = CompiledFixtureModuleExports>(
  artifact: CompiledFixtureArtifact,
): Promise<T> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lynx-compiled-fixture-'));
  const tempImportPath = path.join(tempDir, 'app.js');

  fs.writeFileSync(tempImportPath, artifact.code);
  try {
    return await import(`${pathToFileURL(tempImportPath).href}?t=${Date.now()}`) as T;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

interface LoadCompiledFixturePairOptions {
  backgroundTarget?: CompiledFixtureTarget;
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
    mainTarget = 'LEPUS',
    registerMainTemplates = true,
  } = options;

  const mainArtifact = await compileFixtureSource(sourcePath, { target: mainTarget });
  if (registerMainTemplates) {
    primeCompiledFixtureTemplates(mainArtifact);
  }
  const mainModule = await loadCompiledFixtureModule<T>(mainArtifact);

  const backgroundArtifact = await compileFixtureSource(sourcePath, { target: backgroundTarget });
  const backgroundModule = await loadCompiledFixtureModule<T>(backgroundArtifact);

  return { backgroundModule, mainModule };
}
