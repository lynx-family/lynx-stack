// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { IncomingMessage, ServerResponse } from 'node:http'
import { URL } from 'node:url'
import type { URLSearchParams } from 'node:url'

import { knownFields, resolveField } from '@lynx-js/debug-metadata'
import type { DebugMetadataAsset, QueryParams } from '@lynx-js/debug-metadata'

/**
 * Connect-style middleware. Loosely typed so it can plug into rsbuild,
 * vite, or a bare node HTTP server without taking a hard dependency on
 * `connect`'s types.
 */
type Middleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
) => void

/**
 * Minimal slice of webpack `Compiler` the middleware uses.
 */
interface SingleCompiler {
  name?: string
  outputPath?: string
  options?: { output?: { path?: string } }
  outputFileSystem?: {
    readFile: (
      file: string,
      cb: (err: NodeJS.ErrnoException | null, data?: Buffer | string) => void,
    ) => void
  }
}

interface MultiCompiler {
  compilers: SingleCompiler[]
}

/**
 * Lazily-acquired compiler reference. The rsbuild plugin's
 * `setupMiddlewares` callback runs before `onAfterCreateCompiler`, so
 * the compiler may be `null` at middleware-construction time; we
 * dereference at request time.
 */
export interface CompilerHandle {
  compiler: SingleCompiler | MultiCompiler | null
}

/** @internal */
export interface MiddlewareOptions {
  debugMetadataAssetName: string
  compilerHandle: CompilerHandle
}

/**
 * Build the connect-style middleware that backs the
 * `debug-metadata.json` dev-server endpoints.
 *
 * Schema-agnostic: all the lookup logic lives in
 * `@lynx-js/debug-metadata`'s `FIELDS` registry. Adding a new
 * queryable field only needs a one-line change in the protocol
 * library — no edits here.
 *
 * Handles `?field=<name>` queries against `debug-metadata.json`,
 * dispatched through `resolveField()`. The resolver's `payload` hook
 * (when present) is applied automatically — e.g. `?field=source-map`
 * returns the raw Source Map v3, not the `SourceMapDebugSource`
 * wrapper.
 *
 * @internal
 */
export function createDebugMetadataMiddleware(
  options: MiddlewareOptions,
): Middleware {
  const { debugMetadataAssetName } = options

  return (req, res, next) => {
    if (!req.url) return next()

    let url: URL
    try {
      url = new URL(req.url, 'http://localhost')
    } catch {
      return next()
    }

    if (!url.pathname.endsWith(`/${debugMetadataAssetName}`)) return next()
    if (url.search === '') return next()

    const field = url.searchParams.get('field')
    if (field === null) return next()

    if (!knownFields().includes(field)) {
      respondJSON(res, 400, {
        error: 'invalid_field',
        message: `Unknown field=${JSON.stringify(field)}.`,
        allowed: knownFields(),
      })
      return
    }

    handleQuery({
      metadataDir: dirnameOf(url.pathname),
      field,
      params: paramsFromSearch(url.searchParams),
      url,
      options,
      res,
    }).catch((err: unknown) => {
      respondJSON(res, 500, {
        error: 'metadata_read_error',
        message: (err as Error)?.message ?? 'unknown error',
      })
    })
  }
}

async function handleQuery(args: {
  metadataDir: string
  field: string
  params: QueryParams
  url: URL
  options: MiddlewareOptions
  res: ServerResponse
}): Promise<void> {
  const { metadataDir, field, params, url, options, res } = args
  const { debugMetadataAssetName } = options
  const metadataPath = `${metadataDir}/${debugMetadataAssetName}`

  const metadataJson = await readMetadataAsset(metadataPath, options)
  if (metadataJson === undefined) {
    respondJSON(res, 404, {
      error: 'metadata_not_found',
      message: `No \`${debugMetadataAssetName}\` adjacent to `
        + `\`${url.pathname}\`. Ensure pluginLynxDebugMetadata is active.`,
    })
    return
  }

  let metadata: DebugMetadataAsset
  try {
    metadata = JSON.parse(metadataJson) as DebugMetadataAsset
  } catch (err: unknown) {
    respondJSON(res, 500, {
      error: 'metadata_parse_error',
      message: (err as Error)?.message ?? 'unknown parse error',
    })
    return
  }

  const result = resolveField(metadata, field, params)
  if (result === undefined) {
    respondJSON(res, 400, {
      error: 'invalid_field',
      message: `Field \`${field}\` is not registered.`,
      allowed: knownFields(),
    })
    return
  }
  if (!result.found) {
    respondJSON(res, 404, {
      error: 'not_found',
      field,
      query: Object.fromEntries(url.searchParams),
    })
    return
  }
  respondJSON(res, 200, result.payload)
}

function paramsFromSearch(search: URLSearchParams): QueryParams {
  const params: QueryParams = {}
  const path = search.get('path')
  const filename = search.get('filename')
  const key = search.get('key')
  if (path !== null) params.path = path
  if (filename !== null) params.filename = filename
  if (key !== null) params.key = key
  return params
}

function dirnameOf(pathname: string): string {
  const idx = pathname.lastIndexOf('/')
  return idx <= 0 ? '' : pathname.substring(0, idx)
}

/**
 * Read the in-memory `debug-metadata.json` for the given URL pathname
 * using the compiler's `outputFileSystem` (webpack-dev-middleware's
 * memfs in dev, real fs in prod). Returns `undefined` when the asset
 * does not exist (e.g. wrong entry name). Walks every child of a
 * MultiCompiler in turn so multi-env setups (`web` + `lynx`) work.
 */
async function readMetadataAsset(
  pathname: string,
  options: MiddlewareOptions,
): Promise<string | undefined> {
  const handle = options.compilerHandle.compiler
  if (!handle) return undefined
  const compilers = isMultiCompiler(handle) ? handle.compilers : [handle]
  for (const compiler of compilers) {
    if (!compiler.outputFileSystem) continue
    const result = await readFromCompiler(pathname, compiler)
    if (result !== undefined) return result
  }
  return undefined
}

function isMultiCompiler(
  c: SingleCompiler | MultiCompiler,
): c is MultiCompiler {
  return Array.isArray((c as MultiCompiler).compilers)
}

function readFromCompiler(
  pathname: string,
  compiler: SingleCompiler,
): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    if (!compiler.outputFileSystem) {
      resolve(undefined)
      return
    }
    const outputPath = compiler.outputPath
      ?? compiler.options?.output?.path
      ?? ''
    const relPath = pathname.replace(/^\/+/, '')
    const absPath = joinOutputPath(outputPath, relPath)

    compiler.outputFileSystem.readFile(absPath, (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          resolve(undefined)
          return
        }
        reject(err)
        return
      }
      if (data === undefined) {
        resolve(undefined)
        return
      }
      resolve(typeof data === 'string' ? data : data.toString('utf8'))
    })
  })
}

function joinOutputPath(outputPath: string, rel: string): string {
  if (outputPath === '') return rel
  const trimmed = outputPath.replace(/[/\\]+$/, '')
  return `${trimmed}/${rel}`
}

function respondJSON(
  res: ServerResponse,
  status: number,
  body: unknown,
): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}
