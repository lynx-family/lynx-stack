// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test, vi } from 'vitest'

const mockExecFileSync = vi.fn<(...args: unknown[]) => string>()
vi.mock('node:child_process', () => ({
  execFileSync: (...args: unknown[]): string => mockExecFileSync(...args),
}))

const {
  collectGitMetadata,
  normalizeRemoteUrl,
} = await import('../src/collectors/git.js')

describe('normalizeRemoteUrl', () => {
  test('null / empty input → null', () => {
    expect(normalizeRemoteUrl(null)).toBeNull()
    expect(normalizeRemoteUrl('')).toBeNull()
  })

  test('SSH-style url is rewritten to https', () => {
    expect(normalizeRemoteUrl('git@github.com:lynx-family/lynx-stack.git'))
      .toBe('https://github.com/lynx-family/lynx-stack')
    expect(normalizeRemoteUrl('git@code.byted.org:lynx/revilo'))
      .toBe('https://code.byted.org/lynx/revilo')
  })

  test('HTTPS-style url drops trailing .git', () => {
    expect(normalizeRemoteUrl('https://github.com/owner/repo.git'))
      .toBe('https://github.com/owner/repo')
    expect(normalizeRemoteUrl('https://github.com/owner/repo'))
      .toBe('https://github.com/owner/repo')
  })

  test('ssh:// scheme is converted to https so commitUrl is browsable', () => {
    expect(normalizeRemoteUrl('ssh://git@github.com:22/owner/repo.git'))
      .toBe('https://github.com/owner/repo')
    expect(normalizeRemoteUrl('ssh://git@code.byted.org/lynx/revilo'))
      .toBe('https://code.byted.org/lynx/revilo')
  })

  test('git+ssh:// scheme is converted to https', () => {
    expect(normalizeRemoteUrl('git+ssh://git@github.com/owner/repo.git'))
      .toBe('https://github.com/owner/repo')
  })
})

describe('collectGitMetadata', () => {
  test('returns null when `git rev-parse HEAD` throws (not a git worktree)', () => {
    mockExecFileSync.mockReset()
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('not a git repository')
    })
    expect(collectGitMetadata('/no/repo')).toBeNull()
  })

  test('assembles GitMetadata from the four git commands', () => {
    mockExecFileSync.mockReset()
    mockExecFileSync
      .mockReturnValueOnce('abc123\n')
      .mockReturnValueOnce('feat/foo\n')
      .mockReturnValueOnce('/repo\n')
      .mockReturnValueOnce('git@github.com:owner/repo.git\n')

    expect(collectGitMetadata('/repo')).toEqual({
      branch: 'feat/foo',
      commit: 'abc123',
      rootDir: '/repo',
      remoteUrl: 'https://github.com/owner/repo',
      commitUrl: 'https://github.com/owner/repo/commit/abc123',
    })
  })

  test('omits commitUrl when no remote URL is configured', () => {
    mockExecFileSync.mockReset()
    mockExecFileSync
      .mockReturnValueOnce('abc123\n')
      .mockReturnValueOnce('main\n')
      .mockReturnValueOnce('/repo\n')
      .mockImplementationOnce(() => {
        throw new Error('no remote')
      })

    expect(collectGitMetadata('/repo')).toEqual({
      branch: 'main',
      commit: 'abc123',
      rootDir: '/repo',
      remoteUrl: null,
      commitUrl: null,
    })
  })

  test('falls back to "unknown" branch when `git rev-parse --abbrev-ref` fails', () => {
    mockExecFileSync.mockReset()
    mockExecFileSync
      .mockReturnValueOnce('abc123\n')
      .mockImplementationOnce(() => {
        throw new Error('detached HEAD')
      })
      .mockReturnValueOnce('/repo\n')
      .mockImplementationOnce(() => {
        throw new Error('no remote')
      })

    expect(collectGitMetadata('/repo')?.branch).toBe('unknown')
  })
})
