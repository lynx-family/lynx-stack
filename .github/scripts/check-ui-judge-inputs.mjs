// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
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
    const changedFiles = await listPullRequestFiles();
    if (changedFiles === null) {
      shouldRun = true;
      reason =
        'Unable to list pull request files; running UI Judge by default.';
    } else {
      shouldRun = changedFiles.some((file) =>
        relevantFilePatterns.some((pattern) => pattern.test(file))
      );
      reason = shouldRun
        ? 'Relevant UI Judge files changed.'
        : 'No UI Judge, A2UI, or playground files changed.';
    }
  }
}

appendFileSync(process.env.GITHUB_OUTPUT, `should-run=${shouldRun}\n`);
appendFileSync(process.env.GITHUB_OUTPUT, `reason=${reason}\n`);
console.info(reason);

async function listPullRequestFiles() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const pullRequestUrl = event.pull_request?.url;
  if (!pullRequestUrl) {
    throw new Error(
      'Unable to resolve pull request API URL for the UI Judge gate.',
    );
  }

  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const files = [];
    for (let page = 1; page <= 30; page++) {
      const url = new URL(`${pullRequestUrl}/files`);
      url.searchParams.set('per_page', '100');
      url.searchParams.set('page', String(page));

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(
          `GitHub API returned ${response.status} ${response.statusText}`,
        );
      }

      const pageFiles = await response.json();
      files.push(...pageFiles.map((file) => file.filename));
      if (pageFiles.length < 100) {
        break;
      }
    }
    return files;
  } catch (error) {
    console.warn(error instanceof Error ? error.message : String(error));
    return null;
  }
}
