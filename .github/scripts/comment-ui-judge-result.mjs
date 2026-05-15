#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { readFile } from 'node:fs/promises';

const COMMENT_MARKER = '<!-- ui-judge-pr-result -->';
const apiUrl = process.env['GITHUB_API_URL'] || 'https://api.github.com';
const token = requireEnv('GITHUB_TOKEN');
const repository = requireEnv('GITHUB_REPOSITORY');
const prNumber = Number.parseInt(requireEnv('UI_JUDGE_PR_NUMBER'), 10);
const resultPath = requireEnv('UI_JUDGE_RESULT_PATH');
const [owner, repo] = repository.split('/');

if (!owner || !repo) {
  throw new Error(`Invalid GITHUB_REPOSITORY: ${repository}`);
}

if (!Number.isInteger(prNumber) || prNumber <= 0) {
  throw new Error(`Invalid UI_JUDGE_PR_NUMBER: ${String(prNumber)}`);
}

const payload = asRecord(await readResultPayload(resultPath));
const body = buildCommentBody(payload);
const comments = await listIssueComments();
const existing = comments.find((comment) =>
  typeof comment.body === 'string' && comment.body.includes(COMMENT_MARKER)
);

if (existing) {
  await githubRequest('PATCH', `/issues/comments/${existing.id}`, { body });
  process.stdout.write(`Updated UI Judge comment on PR #${prNumber}.\n`);
} else {
  await githubRequest('POST', `/issues/${prNumber}/comments`, { body });
  process.stdout.write(`Created UI Judge comment on PR #${prNumber}.\n`);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function readResultPayload(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    return {
      dimension: 'visual-correctness',
      reason: `The UI Judge result artifact could not be read: ${
        error instanceof Error ? error.message : String(error)
      }`,
      score: null,
      status: 'missing',
    };
  }
}

function buildCommentBody(payload) {
  const status = plainText(payload.status, 'unknown', 80);
  const score = formatScore(payload.score);
  const dimension = plainText(payload.dimension, 'visual-correctness', 80);
  const reason = plainText(payload.reason, '', 800);
  const task = plainText(payload.task, '', 800);
  const url = plainText(payload.url, '', 400);
  const runUrl = process.env['UI_JUDGE_WORKFLOW_RUN_URL'] || '';
  const conclusion = plainText(
    process.env['UI_JUDGE_WORKFLOW_CONCLUSION'],
    'unknown',
    80,
  );
  const headSha = process.env['UI_JUDGE_HEAD_SHA'] || '';
  const steps = Array.isArray(payload.steps)
    ? payload.steps.filter((step) => typeof step === 'string')
    : [];
  const error = payload.error && typeof payload.error === 'object'
    ? plainText(payload.error.message, '', 800)
    : '';

  const lines = [
    COMMENT_MARKER,
    '## UI Judge Result',
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Status | ${escapeTableValue(status)} |`,
    `| Score | ${escapeTableValue(score)} |`,
    `| Dimension | ${escapeTableValue(dimension)} |`,
    `| Workflow | ${escapeTableValue(conclusion)} |`,
  ];

  if (headSha) {
    lines.push(`| Commit | \`${headSha.slice(0, 12)}\` |`);
  }

  if (url) {
    lines.push(`| Page | ${escapeTableValue(url)} |`);
  }

  if (runUrl) {
    lines.push(`| Run | [details](${runUrl}) |`);
  }

  if (task) {
    lines.push('', `**Task:** ${task}`);
  }

  if (steps.length > 0) {
    lines.push('', '**Steps:**');
    for (const step of steps) {
      lines.push(`- ${plainText(step, '', 400)}`);
    }
  }

  if (reason) {
    lines.push('', `**Reason:** ${reason}`);
  }

  if (error) {
    lines.push('', `**Error:** ${error}`);
  }

  lines.push('', '_This comment is updated automatically by UI Judge._');
  return `${lines.join('\n')}\n`;
}

function formatScore(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return 'not available';
  }

  const normalizedScore = Math.max(0, Math.min(5, Math.round(score)));
  return `${normalizedScore} / 5`;
}

function stringValue(value, fallback) {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function plainText(value, fallback, maxLength) {
  const text = stringValue(value, fallback)
    .replaceAll('@', '[at]')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\r\n', '\n')
    .replaceAll('\n', ' ');

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

function escapeTableValue(value) {
  return value.replaceAll('|', '\\|').replaceAll('\n', '<br>');
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

async function listIssueComments() {
  const comments = [];
  let page = 1;

  while (true) {
    const batch = await githubRequest(
      'GET',
      `/issues/${prNumber}/comments?per_page=100&page=${page}`,
    );
    comments.push(...batch);
    if (batch.length < 100) {
      return comments;
    }
    page += 1;
  }
}

async function githubRequest(method, path, body) {
  const response = await fetch(`${apiUrl}/repos/${owner}/${repo}${path}`, {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    method,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `GitHub API ${method} ${path} failed with ${response.status}: ${message}`,
    );
  }

  if (response.status === 204) {
    return undefined;
  }

  return response.json();
}
