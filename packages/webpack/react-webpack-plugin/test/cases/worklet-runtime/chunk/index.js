/// <reference types="vitest/globals" />
// @ts-check

import fs from 'node:fs/promises';
import path from 'node:path';

import './a.jsx';

it('should have worklet-runtime inlined in main-thread', async () => {
  const source = await fs.readFile(
    path.resolve(
      path.join(
        path.dirname(__filename),
        '.rspeedy',
        'tasm.json',
      ),
    ),
    'utf-8',
  );
  const json = JSON.parse(source);
  // worklet-runtime is now bundled into main-thread.js entry,
  // not as a separate lepus chunk
  expect(json['lepusCode']['lepusChunk']['worklet-runtime'])
    .toBe(undefined);
  // Verify the worklet runtime code is in the main-thread root
  expect(json['lepusCode']['root'].includes('lynxWorkletImpl'))
    .toBe(true);
});
