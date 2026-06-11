// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { transformSync } from '@swc/core'
import { describe, expect, test } from 'vitest'

import {
  ES_ENV_TARGETS,
  getESVersionEnvInclude,
} from '../../src/utils/getESVersionTarget.js'

// Syntax spanning ES2018 through ES2025+ (the regex `v` flag, regex modifiers
// and duplicate named capture groups are the newest entries). The guard below
// compiles this with `jsc.target` (SWC's canonical lowering for an ES version)
// and with our `env` config, then asserts byte-identical output.
//
// If a future SWC upgrade starts lowering some syntax at the target that our
// explicit `include` list omits — or stops needing one we list — the two
// outputs diverge and this test fails, flagging that `getESVersionEnvInclude`
// drifted from `jsc.target` and must be updated. Extend this fixture whenever
// SWC gains support for newer syntax so the guard keeps covering it.
const MODERN_SYNTAX = [
  'export * as ns from "mod";',
  'const oc = a?.b?.c;',
  'const nc = a ?? b;',
  'let x = 0; x ||= 1; x &&= 2; x ??= 3;',
  'const num = 1_000_000;',
  'async function af() { return await g(); }',
  'async function* ag() { yield 1; }',
  'const spread = { ...a, b: 1 };',
  'const dotall = /a.b/s;',
  'const named = /(?<year>\\d{4})/;',
  'const exp = 2 ** 10;',
  'try { foo() } catch { bar() }',
  'class C { #priv = 1; static sb = 2; static { this.x = 1 } #m() {} }',
  'const vFlag = /[\\p{ASCII}]/v;',
  'const modifiers = /(?i:abc)/;',
  'const dupNamed = /(?<a>x)|(?<a>y)/;',
].join('\n')

function viaTarget(): string {
  return transformSync(MODERN_SYNTAX, {
    isModule: true,
    jsc: { parser: { syntax: 'ecmascript' }, target: 'es2017' },
  }).code
}

function viaEnv(): string {
  return transformSync(MODERN_SYNTAX, {
    isModule: true,
    jsc: { parser: { syntax: 'ecmascript' } },
    env: { targets: ES_ENV_TARGETS, include: getESVersionEnvInclude() },
  }).code
}

describe('getESVersionEnvInclude', () => {
  // Uses `@swc/core` as a stand-in for rspack's builtin SWC: the
  // `env.include` <-> `jsc.target` equivalence is a preset-env property
  // shared by both.
  test('env.include reproduces `jsc.target: es2017` exactly', () => {
    expect(viaEnv()).toBe(viaTarget())
  })
})
