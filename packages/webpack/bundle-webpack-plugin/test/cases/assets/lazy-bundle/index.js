/// <reference types="vitest/globals" />

import fs from 'node:fs/promises';
import path from 'node:path';

it('should have tasm.json emitted with appType DynamicComponent', async () => {
  const content = await fs.readFile(
    path.resolve(__dirname, '.rspeedy/main/tasm.json'),
    'utf-8',
  );

  expect(content.length).not.toBe(0);

  const { sourceContent } = JSON.parse(content);

  expect(sourceContent).toHaveProperty('appType', 'DynamicComponent');
});
