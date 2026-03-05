/// <reference types="vitest/globals" />
// @ts-check

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

import './a.jsx';

it('should keep worklet-runtime injection name unchanged', async () => {
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
  expect(json['lepusCode']['lepusChunk']['worklet-runtime'].length > 0)
    .toBe(true);
});

it('should not keep compiled worklet-runtime assets in final output when injection is needed', () => {
  const root = path.dirname(__filename);
  expect(existsSync(path.join(root, 'worklet-runtime.js'))).toBe(false);
  expect(existsSync(path.join(root, 'worklet-runtime.js.map'))).toBe(false);
});

it('should inject worklet-runtime from compiled asset content', async () => {
  const root = path.dirname(__filename);
  const templateSource = await fs.readFile(
    path.join(root, '.rspeedy', 'tasm.json'),
    'utf-8',
  );

  const templateJson = JSON.parse(templateSource);
  const injected = templateJson['lepusCode']['lepusChunk']['worklet-runtime'];
  expect(injected.includes('sourceMappingURL=worklet-runtime.js.map')).toBe(
    true,
  );
  expect(
    injected.startsWith('(function(){')
      || injected.includes('function __webpack_require__('),
  ).toBe(true);
});
