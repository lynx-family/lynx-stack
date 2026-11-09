// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';

for (const file of ['api-extractor.json', 'api-extractor.diagnostics.json']) {
  const config = ExtractorConfig.loadFileAndPrepare(file);
  const result = Extractor.invoke(config, {
    localBuild: process.argv.includes('--local'),
    showVerboseMessages: true,
  });
  if (!result.succeeded) {
    process.exitCode = 1;
    break;
  }
}
