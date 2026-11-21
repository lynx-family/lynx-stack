// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';

const projectFolder = fileURLToPath(new URL('..', import.meta.url));
const baseConfigPath = fileURLToPath(
  new URL('../../../api-extractor.json', import.meta.url),
);
const localBuild = process.argv.includes('--local');
mkdirSync(new URL('../etc/', import.meta.url), { recursive: true });

for (const entry of ['build', 'runtime', 'react', 'shared']) {
  const configObject = ExtractorConfig.loadFile(baseConfigPath);
  const name = `islands-${entry.replaceAll('/', '-')}`;
  configObject.projectFolder = projectFolder;
  configObject.mainEntryPointFilePath =
    `<projectFolder>/lib/${entry}/index.d.ts`;
  configObject.compiler.tsconfigFilePath = '<projectFolder>/tsconfig.json';
  configObject.apiReport.reportFileName = `${name}.api.md`;
  configObject.docModel.apiJsonFilePath =
    `<projectFolder>/temp/${name}.api.json`;
  const config = ExtractorConfig.prepare({
    configObject,
    configObjectFullPath: baseConfigPath,
    packageJsonFullPath: `${projectFolder}/package.json`,
  });
  const result = Extractor.invoke(config, { localBuild });
  if (!result.succeeded) process.exitCode = 1;
}
