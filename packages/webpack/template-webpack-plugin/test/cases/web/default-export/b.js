/// <reference types="@rspack/test-tools/rstest" />

import * as path from 'node:path';
import * as fs from 'node:fs/promises';

it('should have test in custom-section', async () => {
  const fileContent =
    (await fs.readFile(path.join(__dirname, '..', 'a', 'template.js')))
      .toString();
  // convert to utf-16
  const fileContentUtf16 = Buffer.from(fileContent, 'utf-8').toString(
    'utf-16le',
  );
  expect(fileContentUtf16).toContain('test-content-assert-me');
});

it('should card type', async () => {
  const fileContent =
    (await fs.readFile(path.join(__dirname, '..', 'a', 'template.js')))
      .toString();

  // convert to utf-16
  const fileContentUtf16 = Buffer.from(fileContent, 'utf-8').toString(
    'utf-16le',
  );
  expect(fileContentUtf16).toContain('react');
});

it('should have app type', async () => {
  const fileContent =
    (await fs.readFile(path.join(__dirname, '..', 'a', 'template.js')))
      .toString();
  // convert to utf-16
  const fileContentUtf16 = Buffer.from(fileContent, 'utf-8').toString(
    'utf-16le',
  );
  expect(fileContentUtf16).toContain('react');
});
