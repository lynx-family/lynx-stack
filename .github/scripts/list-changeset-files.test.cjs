// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } = require(
  'node:fs',
);
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { describe, it } = require('node:test');

const { listChangesetFilesSince } = require('./list-changeset-files.cjs');

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function createRepository(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'lynx-stack-changeset-files-'));
  t.after(() => rmSync(cwd, { force: true, recursive: true }));

  git(cwd, 'init', '--quiet', '--initial-branch=main');
  git(cwd, 'config', 'user.email', 'test@example.com');
  git(cwd, 'config', 'user.name', 'Test User');
  writeFileSync(join(cwd, 'package.json'), '{}\n');
  git(cwd, 'add', 'package.json');
  git(cwd, 'commit', '--quiet', '-m', 'initial commit');

  return { baseRef: git(cwd, 'rev-parse', 'HEAD'), cwd };
}

function commitFile(cwd, file, content) {
  const target = join(cwd, file);
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, content);
  git(cwd, 'add', '--', file);
  git(cwd, 'commit', '--quiet', '-m', `update ${file}`);
}

describe('listChangesetFilesSince', () => {
  it('selects PR-head changesets, not later base-branch changesets', t => {
    const { baseRef, cwd } = createRepository(t);
    git(cwd, 'checkout', '--quiet', '-b', 'base');
    commitFile(cwd, '.changeset/base-change.md', '---\n---\n');
    git(cwd, 'checkout', '--quiet', '-b', 'pr', baseRef);
    commitFile(cwd, '.changeset/pr-change.md', '---\n---\n');

    assert.deepEqual(listChangesetFilesSince(baseRef, cwd), [
      '.changeset/pr-change.md',
    ]);
  });

  it('returns no files when the PR has no changeset', t => {
    const { baseRef, cwd } = createRepository(t);
    commitFile(cwd, 'README.md', 'documentation change\n');

    assert.deepEqual(listChangesetFilesSince(baseRef, cwd), []);
  });

  it('keeps malformed active files for Changesets validation', t => {
    const { baseRef, cwd } = createRepository(t);
    commitFile(cwd, '.changeset/malformed.md', 'not valid frontmatter\n');

    assert.deepEqual(listChangesetFilesSince(baseRef, cwd), [
      '.changeset/malformed.md',
    ]);
  });

  it('ignores deleted changesets, hidden files, and the changeset README', t => {
    const { cwd } = createRepository(t);
    commitFile(cwd, '.changeset/deleted.md', '---\n---\n');
    commitFile(cwd, '.changeset/README.md', 'before\n');
    commitFile(cwd, '.changeset/.metadata.md', 'before\n');
    const baseRef = git(cwd, 'rev-parse', 'HEAD');

    unlinkSync(join(cwd, '.changeset/deleted.md'));
    writeFileSync(join(cwd, '.changeset/README.md'), 'after\n');
    writeFileSync(join(cwd, '.changeset/.metadata.md'), 'after\n');
    git(cwd, 'add', '--', '.changeset');
    git(cwd, 'commit', '--quiet', '-m', 'remove active changeset');

    assert.deepEqual(listChangesetFilesSince(baseRef, cwd), []);
  });

  it('propagates an invalid merge-base ref', t => {
    const { cwd } = createRepository(t);

    assert.throws(() => listChangesetFilesSince('invalid-base-ref', cwd));
  });
});
