#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { appendFile, readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

const MAX_DETAIL_LENGTH = 1_200;
const MAX_COMMENT_LENGTH = 64_000;

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  const inputs = readInputs();
  const results = normalizeResults(await readResultPayload(inputs));
  const body = truncateComment(formatComment({
    marker: inputs.marker,
    results,
    title: inputs.title,
  }));

  await writeOutput('body', body);

  if (inputs.dryRun) {
    console.info(body);
    return;
  }

  const event = await readEventPayload();
  const repository = parseRepository(process.env.GITHUB_REPOSITORY);
  const prNumber = inputs.prNumber ?? getPullRequestNumber(event);
  if (!prNumber) {
    throw new Error(
      'Unable to determine the pull request number. Run this action on a pull_request event or pass pr-number.',
    );
  }

  const token = inputs.githubToken || process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      'Missing github-token. Pass github-token or allow the action to use github.token.',
    );
  }

  const client = createGitHubClient(token);
  const existingComment = inputs.updateExisting
    ? await findExistingComment(client, repository, prNumber, inputs.marker)
    : undefined;
  const comment = existingComment
    ? await updateComment(client, repository, existingComment.id, body)
    : await createComment(client, repository, prNumber, body);

  await writeOutput('comment-id', String(comment.id ?? ''));
  await writeOutput('comment-url', String(comment.html_url ?? ''));
  console.info(
    existingComment
      ? `Updated UI Judge comment: ${comment.html_url}`
      : `Created UI Judge comment: ${comment.html_url}`,
  );
}

function readInputs() {
  const resultFile = emptyToUndefined(process.env.INPUT_RESULT_FILE);
  const resultJson = emptyToUndefined(process.env.INPUT_RESULT_JSON);
  if (!resultFile && !resultJson) {
    throw new Error('Pass result-file or result-json to ui-judge-comment.');
  }
  if (resultFile && resultJson) {
    throw new Error('Pass only one of result-file or result-json.');
  }

  return {
    dryRun: parseBoolean(process.env.INPUT_DRY_RUN, false),
    githubToken: emptyToUndefined(process.env.INPUT_GITHUB_TOKEN),
    marker: process.env.INPUT_MARKER?.trim() || '<!-- ui-judge-comment -->',
    prNumber: parseOptionalPositiveInteger(process.env.INPUT_PR_NUMBER),
    resultFile,
    resultJson,
    title: process.env.INPUT_TITLE?.trim() || 'UI Judge',
    updateExisting: parseBoolean(process.env.INPUT_UPDATE_EXISTING, true),
  };
}

async function readResultPayload(inputs) {
  if (inputs.resultJson) {
    return parseJson(inputs.resultJson, 'result-json');
  }

  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const filePath = isAbsolute(inputs.resultFile)
    ? inputs.resultFile
    : resolve(workspace, inputs.resultFile);
  const content = await readFile(filePath, 'utf8');
  return parseJson(content, filePath);
}

function parseJson(content, source) {
  try {
    return JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ${source} as JSON: ${message}`);
  }
}

function normalizeResults(payload) {
  const rawResults = Array.isArray(payload)
    ? payload
    : (Array.isArray(payload?.results)
      ? payload.results
      : [payload]);

  const results = rawResults.map((result, index) =>
    normalizeResult(result, index)
  );
  if (results.length === 0) {
    throw new Error('UI Judge result payload did not contain any results.');
  }
  return results;
}

function normalizeResult(result, index) {
  if (!result || typeof result !== 'object') {
    throw new Error(`UI Judge result at index ${index} must be an object.`);
  }

  return {
    dimension: stringValue(result.dimension) || 'visual-correctness',
    error: normalizeError(result.error),
    reference: stringValue(result.reference),
    score: normalizeScore(result.score, index),
    steps: normalizeSteps(result.steps),
    task: stringValue(result.task),
    url: stringValue(result.url),
  };
}

function normalizeScore(value, index) {
  const score = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(score)) {
    throw new Error(
      `UI Judge result at index ${index} has a non-numeric score.`,
    );
  }
  return Math.max(0, Math.min(5, Math.round(score)));
}

function normalizeError(error) {
  if (!error) return undefined;
  if (typeof error === 'string') return { message: error };
  if (typeof error === 'object') {
    return {
      message: stringValue(error.message) || JSON.stringify(error),
    };
  }
  return { message: String(error) };
}

function normalizeSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.filter((step) => typeof step === 'string' && step.trim())
    .map((step) => step.trim());
}

function formatComment({ marker, results, title }) {
  const average = results.reduce((sum, result) => sum + result.score, 0)
    / results.length;
  const failedCount = results.filter((result) => result.error).length;
  const runUrl = getRunUrl();
  const lines = [
    marker,
    `### ${escapeMarkdown(title)}`,
    '',
    `Average score: **${formatScore(average)} / 5** across ${
      pluralize(results.length, 'result')
    }.`,
  ];

  if (failedCount > 0) {
    lines.push(
      `${failedCount} ${
        failedCount === 1 ? 'result has' : 'results have'
      } an error.`,
    );
  }

  lines.push(
    '',
    '| # | Dimension | Score | Page | Status |',
    '| - | - | -: | - | - |',
    ...results.map((result, index) => formatTableRow(result, index)),
  );

  const details = results
    .map((result, index) => formatResultDetails(result, index))
    .filter(Boolean);
  if (details.length > 0) {
    lines.push(
      '',
      '<details>',
      '<summary>Details</summary>',
      '',
      ...details,
      '</details>',
    );
  }

  if (runUrl) {
    lines.push('', `[Workflow run](${runUrl})`);
  }

  return lines.join('\n');
}

function formatTableRow(result, index) {
  const page = result.url
    ? `[preview](${sanitizeUrlForMarkdown(result.url)})`
    : 'n/a';
  const status = result.error ? 'Error' : 'OK';
  return [
    String(index + 1),
    escapeTableCell(result.dimension),
    `${result.score} / 5`,
    page,
    status,
  ].join(' | ').replace(/^/, '| ').replace(/$/, ' |');
}

function formatResultDetails(result, index) {
  const lines = [`#### Result ${index + 1}`, ''];

  if (result.task) {
    lines.push(`- Task: ${truncateText(result.task)}`);
  }
  if (result.reference) {
    lines.push(`- Reference: ${truncateText(result.reference)}`);
  }
  if (result.steps.length > 0) {
    lines.push(
      '- Steps:',
      ...result.steps.map((step) => `  - ${truncateText(step)}`),
    );
  }
  if (result.error) {
    lines.push(`- Error: ${truncateText(result.error.message)}`);
  }

  return lines.length > 2 ? [...lines, ''].join('\n') : '';
}

async function readEventPayload() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return {};

  try {
    return parseJson(await readFile(eventPath, 'utf8'), eventPath);
  } catch {
    return {};
  }
}

function getPullRequestNumber(event) {
  const number = event?.pull_request?.number
    ?? (event?.issue?.pull_request ? event.issue.number : undefined);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function parseRepository(repository) {
  const [owner, repo] = String(repository || '').split('/');
  if (!owner || !repo) {
    throw new Error('GITHUB_REPOSITORY must be set to owner/repo.');
  }
  return { owner, repo };
}

function createGitHubClient(token) {
  const apiUrl = process.env.GITHUB_API_URL || 'https://api.github.com';
  return async function request(path, options = {}) {
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'user-agent': 'lynx-ui-judge-comment',
        'x-github-api-version': '2022-11-28',
        ...options.headers,
      },
    });

    const text = await response.text();
    const data = text ? parseJsonResponse(text) : {};
    if (!response.ok) {
      const message = data?.message || response.statusText;
      throw new Error(
        `GitHub API ${
          options.method || 'GET'
        } ${path} failed with ${response.status}: ${message}`,
      );
    }
    return data;
  };
}

function parseJsonResponse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function findExistingComment(client, repository, prNumber, marker) {
  const comments = await client(
    `/repos/${repository.owner}/${repository.repo}/issues/${prNumber}/comments?per_page=100`,
  );
  return comments.find((comment) =>
    typeof comment.body === 'string' && comment.body.includes(marker)
  );
}

async function createComment(client, repository, prNumber, body) {
  return await client(
    `/repos/${repository.owner}/${repository.repo}/issues/${prNumber}/comments`,
    {
      body: JSON.stringify({ body }),
      method: 'POST',
    },
  );
}

async function updateComment(client, repository, commentId, body) {
  return await client(
    `/repos/${repository.owner}/${repository.repo}/issues/comments/${commentId}`,
    {
      body: JSON.stringify({ body }),
      method: 'PATCH',
    },
  );
}

async function writeOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;

  const delimiter = `ui_judge_${name}_${Date.now()}`;
  const content = `${name}<<${delimiter}\n${value}\n${delimiter}\n`;
  await appendFile(outputPath, content, 'utf8');
}

function parseOptionalPositiveInteger(value) {
  const normalized = emptyToUndefined(value);
  if (!normalized) return undefined;

  const number = Number(normalized);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`Expected a positive integer, received: ${normalized}`);
  }
  return number;
}

function parseBoolean(value, defaultValue) {
  const normalized = emptyToUndefined(value);
  if (!normalized) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(normalized.toLowerCase());
}

function stringValue(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function emptyToUndefined(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function formatScore(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function pluralize(count, word) {
  return `${count} ${count === 1 ? word : `${word}s`}`;
}

function escapeTableCell(value) {
  return escapeMarkdown(value).replaceAll('|', '\\|');
}

function escapeMarkdown(value) {
  return String(value).replaceAll('\n', ' ').trim();
}

function sanitizeUrlForMarkdown(url) {
  return String(url).replaceAll(')', '%29');
}

function truncateText(value) {
  const text = escapeMarkdown(value);
  if (text.length <= MAX_DETAIL_LENGTH) return text;
  return `${text.slice(0, MAX_DETAIL_LENGTH - 3)}...`;
}

function truncateComment(body) {
  if (body.length <= MAX_COMMENT_LENGTH) return body;
  return `${
    body.slice(0, MAX_COMMENT_LENGTH - 120)
  }\n\n_Comment truncated because it exceeded ${MAX_COMMENT_LENGTH} characters._`;
}

function getRunUrl() {
  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const repository = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  if (!repository || !runId) return undefined;
  return `${serverUrl}/${repository}/actions/runs/${runId}`;
}
