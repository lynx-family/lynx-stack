import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe } from 'vitest';

import { runCaseModuleFixtureTests } from '../../test-utils/debug/fixtureRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HYDRATION_DATA_FIXTURES_DIR = path.resolve(__dirname, '../../fixtures/hydrate/hydration-data');
const BACKGROUND_HYDRATE_FIXTURES_DIR = path.resolve(__dirname, '../../fixtures/hydrate/background-hydrate');

describe('Hydration fixtures', () => {
  runCaseModuleFixtureTests({
    fixturesRoot: HYDRATION_DATA_FIXTURES_DIR,
    allowEmpty: true,
  });

  runCaseModuleFixtureTests({
    fixturesRoot: BACKGROUND_HYDRATE_FIXTURES_DIR,
    allowEmpty: true,
  });
});
