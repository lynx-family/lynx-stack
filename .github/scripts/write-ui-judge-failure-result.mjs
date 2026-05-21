// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const resultFile = process.env.UI_JUDGE_RESULT_FILE
  || join(process.env.GITHUB_WORKSPACE, 'ui-judge-results.json');
const errorMessage = process.env.UI_JUDGE_RESULT_ERROR_MESSAGE
  || 'UI Judge CI failed before writing a model result. See the workflow logs for details.';

if (!existsSync(resultFile)) {
  writeFileSync(
    resultFile,
    `${
      JSON.stringify(
        {
          results: [
            {
              dimension: 'visual-correctness',
              score: 0,
              error: {
                message: errorMessage,
              },
              steps: [],
              url: '',
            },
          ],
        },
        null,
        2,
      )
    }\n`,
  );
}
