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
import { runCompiledHydrationScenario } from '../../test-utils/debug/compiledHydrationScenario.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, '../../fixtures/hydrate/background-hydrate-compiled');

describe('Compiled hydration fixtures', () => {
  beforeEach(() => {
    clearTemplates();
  });

  runFixtureTests({
    fixturesRoot: FIXTURES_DIR,
    async run({ fixtureDir, fixtureName, update }) {
      const sourcePath = path.join(fixtureDir, 'index.tsx');
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Missing index.tsx for compiled hydration fixture "${fixtureName}".`);
      }

      const { stream } = await runCompiledHydrationScenario({ sourcePath });
      assertOrUpdateTextFile({
        path: path.join(fixtureDir, 'output.txt'),
        actual: formatFixtureOutput({ stream }),
        update,
        fixtureName,
        label: 'output',
      });
    },
  });
});
