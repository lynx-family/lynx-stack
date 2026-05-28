// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export function getESVersionTarget(isProd: boolean): 'es2015' | 'es2019' {
  return isProd ? 'es2015' : 'es2019'
}

// Transforms newer than ES2019 (i.e. ES2020+) — exactly what an
// `jsc.target: 'es2019'` lowers.
const ES2019_INCLUDE = [
  // ES2020
  'transform-nullish-coalescing-operator',
  'transform-optional-chaining',
  'transform-export-namespace-from',
  // ES2021
  'transform-logical-assignment-operators',
  'transform-numeric-separator',
  // ES2022
  'transform-class-properties',
  'transform-class-static-block',
  'transform-private-methods',
  'transform-private-property-in-object',
]

// Transforms newer than ES2015 (i.e. ES2016+) — exactly what an
// `jsc.target: 'es2015'` lowers: ES2016~ES2019, plus everything in
// {@link ES2019_INCLUDE}.
const ES2015_INCLUDE = [
  // ES2016
  'transform-exponentiation-operator',
  // ES2017
  'transform-async-to-generator',
  // ES2018
  'transform-async-generator-functions',
  'transform-dotall-regex',
  'transform-named-capturing-groups-regex',
  'transform-object-rest-spread',
  'transform-unicode-property-regex',
  // ES2019
  'transform-json-strings',
  'transform-optional-catch-binding',
  ...ES2019_INCLUDE,
]

/**
 * The SWC `env.include` list equivalent to a discrete `jsc.target`. Lets the
 * baseline be expressed through `env` (which supports `include`/`exclude`)
 * instead of `jsc.target`, while running the exact same set of transforms —
 * so the emitted output is unchanged.
 *
 * Pair it with a high `env.targets` (so `env` auto-includes nothing and the
 * returned list is the canonical transform set).
 */
export function getESVersionEnvInclude(
  target: 'es2015' | 'es2019',
): string[] {
  return target === 'es2015' ? [...ES2015_INCLUDE] : [...ES2019_INCLUDE]
}

// A high baseline so SWC `env` auto-includes nothing; the `include` list
// returned by {@link getESVersionEnvInclude} is the canonical transform set.
export const ES_ENV_TARGETS = { chrome: '120' }
