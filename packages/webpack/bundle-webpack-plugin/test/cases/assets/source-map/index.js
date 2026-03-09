/// <reference types="vitest/globals" />

import fs from 'node:fs/promises';

it('should have source-map emitted', async () => {
  const content = await fs.readFile(
    `${__filename}.map`,
  );

  expect(content.length).not.toBe(0);
});
