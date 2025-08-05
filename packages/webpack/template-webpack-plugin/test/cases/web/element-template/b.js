/// <reference types="vitest/globals" />

import * as path from 'node:path';
import * as fs from 'node:fs/promises';

it('should have elementTemplate', async () => {
  const fileContent = (await fs.readFile(
    path.join(__dirname, '..', '.rspeedy', 'a', 'tasm.json'),
  ))
    .toString();
  const { elementTemplate } = JSON.parse(fileContent);
  expect(elementTemplate).toBeTruthy();
});
