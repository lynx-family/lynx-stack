#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const { execFileSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const DISALLOWED_PATTERN = /byted|larkoffice/i;
const NOTICE_COPYRIGHT_RE =
  /^Copyright \(c\) \d{4}(?:-\d{4})? ByteDance Inc\.$/;

const SKIPPED_FILES = new Set([
  '.github/scripts/check-no-internal-keywords.cjs',
]);

function isBinaryBuffer(buffer) {
  return buffer.includes(0);
}

function isAllowedLine(file, line) {
  return file === 'NOTICE' && NOTICE_COPYRIGHT_RE.test(line.trim());
}

function listTrackedFiles(rootDir) {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd: rootDir,
    encoding: 'buffer',
  });
  return output.toString('utf8').split('\0').filter(Boolean);
}

function findInternalKeywordViolations({
  rootDir = process.cwd(),
  files = listTrackedFiles(rootDir),
} = {}) {
  const violations = [];

  for (const file of files) {
    const normalizedFile = file.replaceAll('\\', '/');
    if (SKIPPED_FILES.has(normalizedFile)) {
      continue;
    }

    const fullPath = resolve(rootDir, file);
    if (!existsSync(fullPath)) {
      continue;
    }

    const buffer = readFileSync(fullPath);
    if (isBinaryBuffer(buffer)) {
      continue;
    }

    const lines = buffer.toString('utf8').split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (
        !DISALLOWED_PATTERN.test(line) || isAllowedLine(normalizedFile, line)
      ) {
        continue;
      }

      const snippet = line.trim();
      violations.push({
        file: normalizedFile,
        line: index + 1,
        text: snippet.length > 120 ? `${snippet.slice(0, 117)}...` : snippet,
      });
    }
  }

  return violations;
}

function main() {
  const violations = findInternalKeywordViolations();

  if (violations.length === 0) {
    process.stdout.write('No internal keywords found in tracked files.\n');
    return;
  }

  process.stderr.write(
    'Disallowed internal keywords (byted/larkoffice) found in open-source repository:\n',
  );
  for (const violation of violations) {
    process.stderr.write(
      `- ${violation.file}:${violation.line} -> ${violation.text}\n`,
    );
  }

  throw new Error(
    `${violations.length} disallowed internal keyword occurrence(s) found.`,
  );
}

module.exports = {
  findInternalKeywordViolations,
  isAllowedLine,
  isBinaryBuffer,
};

if (require.main === module) {
  main();
}
