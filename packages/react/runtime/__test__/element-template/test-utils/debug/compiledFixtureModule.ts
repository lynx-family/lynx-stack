import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { CompiledFixtureArtifact } from './compiledFixtureCompiler.js';

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
