// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const resultFile = process.env.UI_JUDGE_RESULT_FILE
  || join(process.env.GITHUB_WORKSPACE, 'ui-judge-results.json');
const errorMessage = process.env.UI_JUDGE_RESULT_ERROR_MESSAGE
  || 'UI Judge did not produce a model result. See the workflow logs for details.';
const geqiDimensions = [
  ['usability-interaction', 'Usability & Interaction', 30],
  ['visual-aesthetics', 'Visual & Aesthetics', 25],
  ['consistency-standards', 'Consistency & Standards', 15],
  ['architecture-writing', 'Architecture & UX Writing', 15],
  ['accessibility-performance', 'Accessibility & Performance', 15],
];

if (!existsSync(resultFile)) {
  writeFileSync(
    resultFile,
    `${
      JSON.stringify(
        {
          results: [
            {
              dimension: 'visual-correctness',
              dimensions: geqiDimensions.map((
                [dimension, dimensionLabel, weight],
              ) => ({
                dimension,
                dimensionLabel,
                error: {
                  message: errorMessage,
                },
                score: 0,
                steps: [],
                url: '',
                weight,
              })),
              error: {
                message: errorMessage,
              },
              score: 0,
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
