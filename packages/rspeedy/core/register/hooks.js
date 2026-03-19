// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Copyright 2024 Bloomberg Finance L.P.
// Distributed under the terms of the Apache 2.0 license.

// @ts-check

import { URL } from 'node:url'

import tsBlankSpace from 'ts-blank-space'

/**
 * @typedef {import('./data').Options} Options
 */

/**
 * @type {{ active: boolean; port: import('worker_threads').MessagePort | null; options: Options | null }}
 */
const state = {
  active: true,
  port: null,
  options: null,
}

/**
 * @typedef {import('./data').Data} Data
 */

/**
 * The `initialize` hook provides a way to define a custom function that runs in the hooks thread
 * when the hooks module is initialized. Initialization happens when the hooks module is registered via `register`.
 *
 * This hook can receive data from a `register` invocation, including ports and other transferable objects.
 * The return value of `initialize` can be a `Promise`, in which case it will be awaited before the main application thread execution resumes.
 *
 * @type {import('module').InitializeHook<Data>}
 */
export const initialize = function initialize(
  data,
) {
  state.options = data.options ?? { resolve: true, load: true }
  state.port = data.port
  data.port.on('message', onMessage)
}

/**
 * The `resolve` hook chain is responsible for resolving file URL for a given module specifier and parent URL, and optionally its format (such as `'module'`) as a hint to the `load` hook.
 * If a format is specified, the load hook is ultimately responsible for providing the final `format` value (and it is free to ignore the hint provided by `resolve`);
 * if `resolve` provides a format, a custom `load` hook is required even if only to pass the value to the Node.js default `load` hook.
 *
 * @type {import('module').ResolveHook}
 */
export const resolve = async function resolve(
  specifier,
  context,
  nextResolve,
) {
  if (!state.options?.resolve) {
    return nextResolve(specifier, context)
  }

  try {
    return await nextResolve(specifier, context)
  } catch (err) {
    const url = parseURL(err?.url)
    if (
      state.active && url?.pathname.endsWith('.js')
    ) {
      try {
        return await nextResolve(
          // Try `.ts` when resolve failed.
          url.pathname.slice(0, -'.js'.length) + '.ts',
          context,
        )
      } catch {
        // Can't not resolve `.ts`, too.
        // Throw the original error.
        throw err
      }
    }
    throw err
  }
}

/**
 * The `load` hook provides a way to define a custom method of determining how a URL should be interpreted, retrieved, and parsed.
 * It is also in charge of validating the import assertion.
 *
 * @type {import('module').LoadHook}
 */
export const load = async function load(url, context, nextLoad) {
  if (!state.options?.load) {
    return nextLoad(url, context)
  }

  const fullURL = parseURL(url)

  if (!fullURL) {
    return nextLoad(url, context)
  }

  const { pathname } = fullURL

  const isCts = pathname.endsWith('.cts')

  if (
    !(pathname.endsWith('.ts')
      || pathname.endsWith('.mts')
      || isCts)
    || !state.active
  ) {
    return nextLoad(url, context)
  }

  const result = await nextLoad(url, { ...context, format: 'module' })
  const transformedSource = tsBlankSpace(
    // @ts-expect-error result.source should not be `undefined`
    result.source.toString(),
  )

  return {
    format: isCts ? 'commonjs' : 'module',
    shortCircuit: true,
    source: transformedSource + '\n//# sourceURL=' + url,
  }
}

/**
 * The callback of the `onmessage` of worker_thread.
 *
 * @param {string} message - The posted message from main-thread
 */
function onMessage(message) {
  if (message === 'deactivate') {
    state.active = false
  }
  state.port?.off('message', onMessage)
}

/**
 * Similar with `URL.parse(url, 'file://')`.
 *
 * We are doing this since `URL.parse` is only supported in NodeJS 22.
 *
 * @param {string | undefined | null} url - The url string.
 * @returns {URL | null} The URL parsed by `new URL`
 */
function parseURL(url) {
  if (url === null || url === undefined) {
    return null
  }

  try {
    return new URL(url, 'file://')
  } catch {
    return null
  }
}
