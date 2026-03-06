/// <reference types="vitest/globals" />

import * as path from 'node:path';
import * as fs from 'node:fs/promises';

it('should have test in custom-section', async () => {
  const fileContent =
    (await fs.readFile(path.join(__dirname, '..', 'a', 'template.js')))
      .toString();
  expect(fileContent).toContain('test-content-assert-me');
});

it('should card type', async () => {
  const fileContent =
    (await fs.readFile(path.join(__dirname, '..', 'a', 'template.js')))
      .toString();
  expect(fileContent).toContain('react');
});

it('should have app type', async () => {
  const fileContent =
    (await fs.readFile(path.join(__dirname, '..', 'a', 'template.js')))
      .toString();
  const { appType } = JSON.parse(fileContent);
  expect(appType).toBeTruthy();
});
