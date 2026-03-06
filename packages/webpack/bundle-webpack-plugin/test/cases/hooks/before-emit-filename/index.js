/// <reference types="vitest/globals" />

import fs from 'node:fs/promises';
import path from 'node:path';

it('should have changed template', async () => {
  const content = await fs.readFile(
    path.resolve(__dirname, 'main.template.js'),
  );

  expect(content.length).not.toBe(0);
});
