import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe } from 'vitest';

import { runCaseModuleFixtureTests } from '../../test-utils/debug/fixtureRunner.js';
import { runRenderFixtureTests } from '../../test-utils/debug/renderFixtureRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RENDER_FIXTURES_DIR = path.resolve(__dirname, '../../fixtures/render-list');
const RUNTIME_FIXTURES_DIR = path.resolve(__dirname, '../../fixtures/render-list-runtime');

describe('List render fixtures', () => {
  runRenderFixtureTests(RENDER_FIXTURES_DIR);
});

describe('List runtime fixtures', () => {
  runCaseModuleFixtureTests({ fixturesRoot: RUNTIME_FIXTURES_DIR });
});
