// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

const relevantFilePatterns = [
  /^packages\/genui\/(ui-judge|a2ui|a2ui-playground)\//,
  /^\.github\/actions\/ui-judge-comment\//,
  /^\.github\/scripts\/(check-ui-judge-inputs|write-ui-judge-failure-result)\.mjs$/,
  /^\.github\/workflows\/(test|workflow-test)\.yml$/,
  /^\.github\/ui-judge(-ci)?\.instructions\.md$/,
];

let shouldRun = false;
let reason = 'UI Judge only comments on pull_request events.';

if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
  if (!process.env.MIDSCENE_MODEL_NAME || !process.env.MIDSCENE_MODEL_API_KEY) {
    reason = 'Midscene model secrets are not configured for this pull request.';
  } else {
    const changedFiles = listPullRequestFiles();
    shouldRun = changedFiles.some((file) =>
      relevantFilePatterns.some((pattern) => pattern.test(file))
    );
    reason = shouldRun
      ? 'Relevant UI Judge files changed.'
      : 'No UI Judge, A2UI, or playground files changed.';
  }
}

appendFileSync(process.env.GITHUB_OUTPUT, `should-run=${shouldRun}\n`);
appendFileSync(process.env.GITHUB_OUTPUT, `reason=${reason}\n`);
console.info(reason);

function listPullRequestFiles() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const base = event.pull_request?.base?.sha;
  const head = event.pull_request?.head?.sha;
  if (!base || !head) {
    throw new Error(
      'Unable to resolve pull request base/head SHAs for the UI Judge gate.',
    );
  }

  const output = execFileSync('git', [
    'diff',
    '--name-only',
    `${base}...${head}`,
  ], { encoding: 'utf8' });
  return output.split(/\r?\n/).filter(Boolean);
}
