import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe } from 'vitest';

import { runCaseModuleFixtureTests } from '../../../test-utils/debug/fixtureRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKGROUND_HYDRATE_FIXTURES_DIR = path.resolve(__dirname, '../../../fixtures/background/hydrate');

describe('Background hydrate fixtures', () => {
  runCaseModuleFixtureTests({
    fixturesRoot: BACKGROUND_HYDRATE_FIXTURES_DIR,
  });
});
