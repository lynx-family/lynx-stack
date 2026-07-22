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
  // WHATWG URL forbids reassigning `protocol` across the "special scheme"
  // boundary (ssh: → https:), so rewrite the scheme on the raw string
  // before parsing.
  const isSshLike = /^(?:git\+)?ssh:\/\//.test(remoteUrl)
  const normalized = remoteUrl.replace(/^(?:git\+)?ssh:\/\//, 'https://')
  try {
    const url = new URL(normalized)
    url.username = ''
    url.password = ''
    // Only strip the port for converted SSH remotes (where the original
    // `:22` is meaningless under HTTPS). Legitimate non-default HTTPS
    // ports like `git.example.com:8443` must survive intact.
    if (isSshLike) url.port = ''
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\.git$/, '').replace(/\/$/, '')
  } catch {
    return normalized.replace(/\.git$/, '')
  }
}

/**
 * Capture git state for `cwd`. Returns `null` when `cwd` is not inside
 * a git worktree (or git is unavailable), in which case the caller
 * should omit the `meta.git` field entirely.
 */
export function collectGitMetadata(cwd: string): GitMetadata | null {
  // One spawn for both: each `git` costs ~20ms on the compile critical path.
  const revParse = tryRunGit(cwd, ['rev-parse', 'HEAD', '--show-toplevel'])
  const [commit, rootDir = null] = revParse?.split(/\r?\n/) ?? []
  if (!commit) return null
  const remoteUrl = normalizeRemoteUrl(
    tryRunGit(cwd, ['config', '--get', 'remote.origin.url']),
  )
  return {
    commit,
    rootDir,
    remoteUrl,
    commitUrl: remoteUrl ? `${remoteUrl}/commit/${commit}` : null,
  }
}
