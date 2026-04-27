import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe } from 'vitest';

import { runCaseModuleFixtureTests } from '../../../test-utils/debug/fixtureRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, '../../../fixtures/background/instance');

describe('Background instance fixtures', () => {
  runCaseModuleFixtureTests({
    fixturesRoot: FIXTURES_DIR,
    allowEmpty: true,
  });
});
