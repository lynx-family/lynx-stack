// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

interface Query {
  screen_params?: string | undefined
  [key: string]: unknown
}

interface Result {
  screen_params: string | undefined
  query: Record<string, unknown>
  config: object | undefined
}

interface RestResult {
  first: unknown
  rest: unknown[]
}

// Keep the object rest in the parameter list: lowering it to ES2017 creates
// an array rest temporary which the production minimizer can inline.
export const openBankH5 = async (
  { screen_params, ...query }: Query,
  config?: object,
): Promise<Result> => {
  'use js only'
  await Promise.resolve()
  return { screen_params, query, config }
}

export function withDefaults(
  record: (value: string) => void,
  { screen_params = (record('screen-default'), 'default'), ...query }: Query =
    {},
  config: object = (record('config-default'), { screen_params, ...query }),
): Result {
  record('body')
  return { screen_params, query, config }
}

export function readRest(head: unknown, tail: unknown): RestResult {
  const [first, ...rest] = [head, tail]
  return { first, rest }
}

export function assignRest(head: unknown, tail: unknown): RestResult {
  let first: unknown
  let rest: unknown[]
  ;[first, ...rest] = [head, tail]
  return { first, rest }
}

export function readIterable(values: Iterable<unknown>): RestResult {
  const [first, ...rest] = values
  return { first, rest }
}
