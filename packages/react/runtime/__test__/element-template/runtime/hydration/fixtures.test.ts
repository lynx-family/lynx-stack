import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe } from 'vitest';

import { runCaseModuleFixtureTests } from '../../test-utils/debug/fixtureRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HYDRATION_DATA_FIXTURES_DIR = path.resolve(__dirname, '../../fixtures/hydration/hydration-data');

describe('Hydration fixtures', () => {
  runCaseModuleFixtureTests({
    fixturesRoot: HYDRATION_DATA_FIXTURES_DIR,
  });
});
