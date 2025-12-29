/// <reference types="vitest/globals" />

import fs from 'node:fs';
import path from 'node:path';

console.info('**bbb**');

it('should have "bbb" in b__main-thread.js', async () => {
  const target = path.resolve(__dirname, 'b__main-thread.js');
  expect(fs.existsSync(target));

  const content = await fs.promises.readFile(target, 'utf-8');

  expect(content).toContain(['**', 'bbb', '**'].join(''));
});
