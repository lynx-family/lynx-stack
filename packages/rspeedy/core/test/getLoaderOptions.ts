// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rsbuild/core'

export function getLoaderOptions<T>(
  config: Rspack.Configuration,
  loader: string | RegExp,
): T | null {
  let res: T | null = null
  config
    .module
    ?.rules
    ?.some(rule => {
      res = getRuleOptions(rule)
      return res
    })

  return res

  function check(target: string) {
    if (typeof loader === 'string') {
      return target === loader
    }

    return loader.test(target)
  }

  function getRuleOptions(
    rule: Rspack.RuleSetRule | boolean | null | undefined | 0 | '' | '...',
  ): T | null {
    if (!rule) {
      return null
    }

    if (typeof rule !== 'object') {
      return null
    }

    const oneOfRule = rule.oneOf?.find((rule) => getRuleOptions(rule))
    if (oneOfRule) {
      return oneOfRule.options as T
    }

    if (typeof rule.use === 'string' && check(rule.use)) {
      return rule.options as T
    }

    if (typeof rule.loader === 'string' && check(rule.loader)) {
      return rule.options as T
    }

    if (!rule.use) {
      return null
    }

    let result: T | null = null

    if (Array.isArray(rule.use)) {
      rule.use.some(u => {
        if (typeof u === 'string') {
          return false
        }
        if (check(u.loader)) {
          result = u.options as T
          return true
        }
        return false
      })
    }

    return result
  }
}
