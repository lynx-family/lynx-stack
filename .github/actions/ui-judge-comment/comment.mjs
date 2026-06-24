#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { appendFile, readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  const inputs = readInputs();
  const body = await readBody(inputs.bodyFile);
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
    throw new Error('Missing github-token.');
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
  const bodyFile = process.env.INPUT_BODY_FILE?.trim();
  if (!bodyFile) throw new Error('body-file is required.');
  return {
    bodyFile,
    githubToken: emptyToUndefined(process.env.INPUT_GITHUB_TOKEN),
    marker: process.env.INPUT_MARKER?.trim() || '<!-- ui-judge-comment -->',
    prNumber: parseOptionalPositiveInteger(process.env.INPUT_PR_NUMBER),
    updateExisting: parseBoolean(process.env.INPUT_UPDATE_EXISTING, true),
  };
}

async function readBody(bodyFile) {
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const filePath = isAbsolute(bodyFile)
    ? bodyFile
    : resolve(workspace, bodyFile);
  const body = await readFile(filePath, 'utf8');
  if (!body.includes('<!-- ui-judge-comment -->')) {
    return `<!-- ui-judge-comment -->\n${body}`;
  }
  return body;
}

async function readEventPayload() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return {};
  try {
    return JSON.parse(await readFile(eventPath, 'utf8'));
  } catch {
    return {};
  }
}

function parseRepository(value) {
  const [owner, repo] = String(value || '').split('/');
  if (!owner || !repo) {
    throw new Error('GITHUB_REPOSITORY must be set to owner/repo.');
  }
  return { owner, repo };
}

function getPullRequestNumber(event) {
  return parseOptionalPositiveInteger(event?.pull_request?.number);
}

function createGitHubClient(token) {
  const request = async (path, options = {}) => {
    const response = await fetch(`https://api.github.com${path}`, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...options.headers,
      },
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(
        `GitHub API ${
          options.method || 'GET'
        } ${path} failed with ${response.status}: ${text}`,
      );
    }
    return payload;
  };
  return { request };
}

async function findExistingComment(client, repository, prNumber, marker) {
  const comments = await client.request(
    `/repos/${repository.owner}/${repository.repo}/issues/${prNumber}/comments?per_page=100`,
  );
  return comments.find((comment) =>
    typeof comment.body === 'string' && comment.body.includes(marker)
  );
}

async function createComment(client, repository, prNumber, body) {
  return await client.request(
    `/repos/${repository.owner}/${repository.repo}/issues/${prNumber}/comments`,
    {
      body: JSON.stringify({ body }),
      method: 'POST',
    },
  );
}

async function updateComment(client, repository, commentId, body) {
  return await client.request(
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
  await appendFile(outputPath, `${name}=${value}\n`, 'utf8');
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function parseOptionalPositiveInteger(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function emptyToUndefined(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
