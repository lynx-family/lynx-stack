// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { IncomingMessage, ServerResponse } from 'node:http'

import { describe, expect, test } from 'vitest'

import type { DebugMetadataAsset } from '@lynx-js/debug-metadata'

import { createDebugMetadataMiddleware } from '../src/middleware.js'
import type { CompilerHandle } from '../src/middleware.js'

const VALID_METADATA: DebugMetadataAsset = {
  artifacts: [
    {
      kind: 'main-thread',
      filename: 'main-thread.js',
      path: '.rspeedy/main/main-thread.js',
      debugSources: [
        {
          kind: 'source-map',
          filename: 'main-thread.js.map',
          path: '.rspeedy/main/main-thread.js.map',
          key: 'mt-hash',
          map: { version: 3, sources: [], names: [], mappings: '' },
        },
      ],
    },
  ],
  uiSourceMap: { version: 1, sources: [], mappings: [], uiMaps: [] },
  meta: { rspeedy: { entryFiles: [], bundlePath: 'main/template.js' } },
}

/**
 * Strip Windows drive-letter + reverse separator so a posix-style
 * `/out/...` lookup key matches the path that `path.resolve` produces
 * on the current platform — `C:\out\foo` on Windows, `/out/foo` on
 * posix. Keeps the test keys (and assertion fixtures) platform-neutral.
 */
function toPosixKey(p: string): string {
  return p.replace(/\\/g, '/').replace(/^[A-Z]:/i, '')
}

/**
 * Build a fake compiler whose `outputFileSystem.readFile` resolves
 * paths against an in-memory map. Missing paths yield `ENOENT`. Used
 * to drive the middleware end-to-end without spinning up webpack.
 */
function fakeCompiler(
  files: Record<string, string>,
  publicPath?: string | ((...args: unknown[]) => string),
): CompilerHandle {
  return {
    compiler: {
      outputPath: '/out',
      ...(publicPath === undefined
        ? {}
        : { options: { output: { path: '/out', publicPath } } }),
      outputFileSystem: {
        readFile(file, cb) {
          const data = files[toPosixKey(file)]
          if (data === undefined) {
            const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
            cb(err as NodeJS.ErrnoException)
            return
          }
          cb(null, data)
        },
      },
    },
  }
}

interface CapturedResponse {
  status: number
  body: unknown
  headers: Record<string, string>
}

/**
 * Drive one request through the middleware and resolve once `res.end`
 * has fired (or `next` is called). Returns the captured response or
 * `null` when the middleware delegated to `next`.
 */
function runRequest(
  middleware: ReturnType<typeof createDebugMetadataMiddleware>,
  url: string,
): Promise<CapturedResponse | null> {
  return new Promise((resolve) => {
    const headers: Record<string, string> = {}
    let status = 200
    let passedToNext = false
    let ended = false
    const req = { url } as IncomingMessage
    const res = {
      get statusCode() {
        return status
      },
      set statusCode(value: number) {
        status = value
      },
      setHeader(name: string, value: string) {
        headers[name.toLowerCase()] = value
      },
      end(payload: string) {
        if (ended) return
        ended = true
        let body: unknown = payload
        try {
          body = JSON.parse(payload)
        } catch {
          /* leave as string */
        }
        resolve({ status, body, headers })
      },
    } as unknown as ServerResponse
    middleware(req, res, () => {
      passedToNext = true
      resolve(null)
    })
    // Safety: if neither next() nor end() ever fires, queue a microtask.
    queueMicrotask(() => {
      if (!ended && !passedToNext) {
        /* still pending — caller awaits */
      }
    })
  })
}

describe('createDebugMetadataMiddleware', () => {
  test('skips (next) when the URL is not a debug-metadata.json request', async () => {
    const mw = createDebugMetadataMiddleware({
      compilerHandle: fakeCompiler({}),
    })
    expect(await runRequest(mw, '/something/else.js')).toBeNull()
  })

  test('skips when the path matches but no query is present', async () => {
    const mw = createDebugMetadataMiddleware({
      compilerHandle: fakeCompiler({}),
    })
    expect(await runRequest(mw, '/.rspeedy/main/debug-metadata.json'))
      .toBeNull()
  })

  test('skips when ?field= is missing', async () => {
    const mw = createDebugMetadataMiddleware({
      compilerHandle: fakeCompiler({}),
    })
    expect(
      await runRequest(mw, '/.rspeedy/main/debug-metadata.json?other=1'),
    ).toBeNull()
  })

  test('returns 400 invalid_field for an unknown field name', async () => {
    const mw = createDebugMetadataMiddleware({
      compilerHandle: fakeCompiler({
        '/out/.rspeedy/main/debug-metadata.json': JSON.stringify(
          VALID_METADATA,
        ),
      }),
    })
    const res = await runRequest(
      mw,
      '/.rspeedy/main/debug-metadata.json?field=bogus',
    )
    expect(res?.status).toBe(400)
    const body = res?.body as { error: string, allowed: string[] }
    expect(body.error).toBe('invalid_field')
    expect(body.allowed).toEqual(
      expect.arrayContaining(['source-map', 'bytecode-debug-info']),
    )
  })

  test('returns 404 metadata_not_found when the dir has no debug-metadata.json', async () => {
    const mw = createDebugMetadataMiddleware({
      compilerHandle: fakeCompiler({}),
    })
    const res = await runRequest(
      mw,
      '/.rspeedy/main/debug-metadata.json?field=source-map&filename=x.js.map',
    )
    expect(res?.status).toBe(404)
    expect(res?.body).toMatchObject({ error: 'metadata_not_found' })
  })

  test('returns 500 metadata_parse_error on corrupt JSON', async () => {
    const mw = createDebugMetadataMiddleware({
      compilerHandle: fakeCompiler({
        '/out/.rspeedy/main/debug-metadata.json': '{ not json',
      }),
    })
    const res = await runRequest(
      mw,
      '/.rspeedy/main/debug-metadata.json?field=source-map&filename=x.js.map',
    )
    expect(res?.status).toBe(500)
    expect(res?.body).toMatchObject({ error: 'metadata_parse_error' })
  })

  test('returns 404 not_found when the field is valid but no match', async () => {
    const mw = createDebugMetadataMiddleware({
      compilerHandle: fakeCompiler({
        '/out/.rspeedy/main/debug-metadata.json': JSON.stringify(
          VALID_METADATA,
        ),
      }),
    })
    const res = await runRequest(
      mw,
      '/.rspeedy/main/debug-metadata.json?field=source-map&filename=missing.js.map',
    )
    expect(res?.status).toBe(404)
    expect(res?.body).toMatchObject({ error: 'not_found', field: 'source-map' })
  })

  test('200 source-map payload is the unwrapped map (not the wrapper)', async () => {
    const mw = createDebugMetadataMiddleware({
      compilerHandle: fakeCompiler({
        '/out/.rspeedy/main/debug-metadata.json': JSON.stringify(
          VALID_METADATA,
        ),
      }),
    })
    const res = await runRequest(
      mw,
      '/.rspeedy/main/debug-metadata.json?field=source-map&filename=main-thread.js.map',
    )
    expect(res?.status).toBe(200)
    expect(res?.body).toEqual({
      version: 3,
      sources: [],
      names: [],
      mappings: '',
    })
    expect(res?.headers['content-type']).toContain('application/json')
    expect(res?.headers['cache-control']).toBe('no-store')
  })

  test('200 returns the whole `meta` block for ?field=meta', async () => {
    const mw = createDebugMetadataMiddleware({
      compilerHandle: fakeCompiler({
        '/out/.rspeedy/main/debug-metadata.json': JSON.stringify(
          VALID_METADATA,
        ),
      }),
    })
    const res = await runRequest(
      mw,
      '/.rspeedy/main/debug-metadata.json?field=meta',
    )
    expect(res?.status).toBe(200)
    expect(res?.body).toEqual(VALID_METADATA.meta)
  })

  test('strips a path-prefix publicPath before reading outputFileSystem', async () => {
    const mw = createDebugMetadataMiddleware({
      compilerHandle: fakeCompiler(
        {
          '/out/.rspeedy/main/debug-metadata.json': JSON.stringify(
            VALID_METADATA,
          ),
        },
        '/assets/',
      ),
    })
    const res = await runRequest(
      mw,
      '/assets/.rspeedy/main/debug-metadata.json?field=meta',
    )
    expect(res?.status).toBe(200)
    expect(res?.body).toEqual(VALID_METADATA.meta)
  })

  test('does NOT strip a prefix that only matches a partial segment (e.g. /assets vs /assets2)', async () => {
    const mw = createDebugMetadataMiddleware({
      compilerHandle: fakeCompiler(
        {
          '/out/assets2/.rspeedy/main/debug-metadata.json': JSON.stringify(
            VALID_METADATA,
          ),
        },
        '/assets/',
      ),
    })
    // publicPathPrefix = '/assets' — must NOT strip from '/assets2/...'
    const res = await runRequest(
      mw,
      '/assets2/.rspeedy/main/debug-metadata.json?field=meta',
    )
    expect(res?.status).toBe(200)
    expect(res?.body).toEqual(VALID_METADATA.meta)
  })

  test('strips a function publicPath that returns a static prefix', async () => {
    const mw = createDebugMetadataMiddleware({
      compilerHandle: fakeCompiler(
        {
          '/out/.rspeedy/main/debug-metadata.json': JSON.stringify(
            VALID_METADATA,
          ),
        },
        () => '/build/',
      ),
    })
    const res = await runRequest(
      mw,
      '/build/.rspeedy/main/debug-metadata.json?field=meta',
    )
    expect(res?.status).toBe(200)
    expect(res?.body).toEqual(VALID_METADATA.meta)
  })

  test('does not crash on a function publicPath that throws — best-effort, treat as no prefix', async () => {
    const mw = createDebugMetadataMiddleware({
      compilerHandle: fakeCompiler(
        {
          '/out/.rspeedy/main/debug-metadata.json': JSON.stringify(
            VALID_METADATA,
          ),
        },
        () => {
          throw new Error('depends on per-chunk runtime data')
        },
      ),
    })
    const res = await runRequest(
      mw,
      '/.rspeedy/main/debug-metadata.json?field=meta',
    )
    expect(res?.status).toBe(200)
    expect(res?.body).toEqual(VALID_METADATA.meta)
  })

  test('strips the path part of a full-URL publicPath', async () => {
    const mw = createDebugMetadataMiddleware({
      compilerHandle: fakeCompiler(
        {
          '/out/.rspeedy/main/debug-metadata.json': JSON.stringify(
            VALID_METADATA,
          ),
        },
        'https://cdn.example.com/static/',
      ),
    })
    const res = await runRequest(
      mw,
      '/static/.rspeedy/main/debug-metadata.json?field=meta',
    )
    expect(res?.status).toBe(200)
    expect(res?.body).toEqual(VALID_METADATA.meta)
  })

  test('returns 404 metadata_not_found when no compiler is attached yet', async () => {
    const mw = createDebugMetadataMiddleware({
      compilerHandle: { compiler: null },
    })
    const res = await runRequest(
      mw,
      '/.rspeedy/main/debug-metadata.json?field=source-map&filename=x.js.map',
    )
    expect(res?.status).toBe(404)
    expect(res?.body).toMatchObject({ error: 'metadata_not_found' })
  })

  test('walks a MultiCompiler and uses the first matching child', async () => {
    const handle: CompilerHandle = {
      compiler: {
        compilers: [
          {
            outputPath: '/web-out',
            outputFileSystem: {
              readFile(_file, cb) {
                cb(
                  Object.assign(new Error('ENOENT'), {
                    code: 'ENOENT',
                  }) as NodeJS.ErrnoException,
                )
              },
            },
          },
          {
            outputPath: '/lynx-out',
            outputFileSystem: {
              readFile(file, cb) {
                if (
                  toPosixKey(file)
                    === '/lynx-out/.rspeedy/main/debug-metadata.json'
                ) {
                  cb(null, JSON.stringify(VALID_METADATA))
                  return
                }
                cb(
                  Object.assign(new Error('ENOENT'), {
                    code: 'ENOENT',
                  }) as NodeJS.ErrnoException,
                )
              },
            },
          },
        ],
      },
    }
    const mw = createDebugMetadataMiddleware({
      compilerHandle: handle,
    })
    const res = await runRequest(
      mw,
      '/.rspeedy/main/debug-metadata.json?field=meta',
    )
    expect(res?.status).toBe(200)
    expect(res?.body).toEqual(VALID_METADATA.meta)
  })
})
