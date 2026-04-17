import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe } from 'vitest';

import { clearTemplates } from '../../test-utils/debug/registry.js';
import {
  assertOrUpdateTextFile,
  formatFixtureOutput,
  runFixtureTests,
} from '../../test-utils/debug/fixtureRunner.js';
import { runCompiledPatchScenario } from '../../fixtures/patch/_shared.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, '../../fixtures/patch-compiled');

describe('Compiled patch fixtures', () => {
  beforeEach(() => {
    clearTemplates();
  });

  runFixtureTests({
    fixturesRoot: FIXTURES_DIR,
    async run({ fixtureDir, fixtureName, update }) {
      const sourcePath = path.join(fixtureDir, 'index.tsx');
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Missing index.tsx for compiled patch fixture "${fixtureName}".`);
      }

      const result = await runCompiledPatchScenario(sourcePath);
      for (const [fileName, value] of Object.entries(result.files)) {
        assertOrUpdateTextFile({
          path: path.join(fixtureDir, fileName),
          actual: formatFixtureOutput(value),
          update,
          fixtureName,
          label: fileName,
        });
      }
    },
  });
});
