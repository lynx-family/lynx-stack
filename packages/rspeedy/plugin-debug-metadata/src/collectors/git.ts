// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { execFileSync } from 'node:child_process'

import type { GitMetadata } from '@lynx-js/debug-metadata'

/**
 * Run `git <args>` in `cwd` and return trimmed stdout, or `null` when
 * git is unavailable or the command failed (e.g. not a git worktree).
 */
function tryRunGit(cwd: string, args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

/**
 * Normalize a `remote.origin.url` value into a browsable HTTPS URL.
 *
 * - ssh-style `git@host:owner/repo(.git)` → `https://host/owner/repo`
 * - https-style: drop the trailing `.git`
 *
 * Userinfo (username / password / PAT) embedded in HTTPS remotes is
 * always stripped before returning so it does not leak into the
 * metadata file or the derived `commitUrl`.
 *
 * Returns `null` when input is `null` / empty.
 *
 * @internal Exported for unit testing only.
 */
export function normalizeRemoteUrl(remoteUrl: string | null): string | null {
  if (!remoteUrl) return null
  const sshMatch = /^git@([^:]+):(.+?)(?:\.git)?$/.exec(remoteUrl)
  if (sshMatch) {
    return `https://${sshMatch[1]}/${sshMatch[2]}`
  }
  try {
    const url = new URL(remoteUrl)
    url.username = ''
    url.password = ''
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\.git$/, '').replace(/\/$/, '')
  } catch {
    return remoteUrl.replace(/\.git$/, '')
  }
}

/**
 * Capture git state for `cwd`. Returns `null` when `cwd` is not inside
 * a git worktree (or git is unavailable), in which case the caller
 * should omit the `meta.git` field entirely.
 */
export function collectGitMetadata(cwd: string): GitMetadata | null {
  const commit = tryRunGit(cwd, ['rev-parse', 'HEAD'])
  if (!commit) return null
  const branch = tryRunGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
    ?? 'unknown'
  const rootDir = tryRunGit(cwd, ['rev-parse', '--show-toplevel'])
  const remoteUrl = normalizeRemoteUrl(
    tryRunGit(cwd, ['config', '--get', 'remote.origin.url']),
  )
  return {
    branch,
    commit,
    rootDir,
    remoteUrl,
    commitUrl: remoteUrl ? `${remoteUrl}/commit/${commit}` : null,
  }
}
