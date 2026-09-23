// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

import { describe, expect, test } from '@rstest/core'
import { parseSync } from '@swc/core'
import type {
  AssignmentExpression,
  Expression,
  Pattern,
  VariableDeclarator,
} from '@swc/core'
import { Visitor } from '@swc/core/Visitor.js'

import { createStubRsbuild } from './createStubRsbuild.js'

type Fixture = typeof import('./fixtures/safari-rest-destructuring/index.js')

const FIXTURE = fileURLToPath(
  new URL('./fixtures/safari-rest-destructuring/index.ts', import.meta.url),
)

// Safari < 14.1 / iOS < 14.5 mishandles array rest when the RHS is a simple
// array literal with the same number of elements as the pattern. Inspect the
// emitted AST because executing the bundle on Node cannot reproduce that bug.
// https://github.com/babel/babel/tree/main/packages/babel-plugin-bugfix-safari-rest-destructuring-rhs-array
class SafariRestVisitor extends Visitor {
  unsafePatterns = 0

  check(left: Pattern | Expression, right: Expression | undefined) {
    if (
      left.type === 'ArrayPattern'
      && left.elements.at(-1)?.type === 'RestElement'
      && right?.type === 'ArrayExpression'
      && left.elements.length === right.elements.length
      && right.elements.every(element => element && !element.spread)
    ) {
      this.unsafePatterns++
    }
  }

  override visitVariableDeclarator(
    node: VariableDeclarator,
  ): VariableDeclarator {
    this.check(node.id, node.init)
    return super.visitVariableDeclarator(node)
  }

  override visitAssignmentExpression(node: AssignmentExpression): Expression {
    this.check(node.left, node.right)
    return super.visitAssignmentExpression(node)
  }
}

describe('SWC Safari compatibility', () => {
  test.each([false, true])(
    'preserves object rest parameters in production (minify: %s)',
    async (minify) => {
      const root = await mkdtemp(path.join(tmpdir(), 'rspeedy-safari-rest-'))

      try {
        const rsbuild = await createStubRsbuild({
          mode: 'production',
          source: { entry: { index: FIXTURE } },
          output: {
            distPath: { js: '.' },
            filenameHash: false,
            sourceMap: false,
            minify,
          },
          tools: {
            rspack: { output: { library: { type: 'commonjs2' } } },
          },
        }, root)

        const result = await rsbuild.build()
        await result.close()

        const code = await readFile(path.join(root, 'dist/index.js'), 'utf8')
        const visitor = new SafariRestVisitor()
        visitor.visitProgram(parseSync(code))
        expect(visitor.unsafePatterns).toBe(0)

        const entry = { exports: {} as Fixture }
        runInNewContext(code, { module: entry })
        const { openBankH5, withDefaults, readRest, assignRest, readIterable } =
          entry.exports

        const config = { bank: 'test' }
        const params = { screen_params: 'screen', bank_id: '123' }
        const opened = await openBankH5(params, config)
        expect(opened).toEqual({
          screen_params: 'screen',
          query: { bank_id: '123' },
          config,
        })
        expect(opened.config).toBe(config)
        expect(params).toEqual({ screen_params: 'screen', bank_id: '123' })
        await expect(openBankH5(params)).resolves.toEqual({
          screen_params: 'screen',
          query: { bank_id: '123' },
          config: undefined,
        })

        const order: string[] = []
        const record = (value: string) => {
          order.push(value)
        }
        const symbol = Symbol('query')
        const defaults = withDefaults(record, {
          get screen_params() {
            record('screen-getter')
            return undefined
          },
          get bank_id() {
            record('query-getter')
            return '123'
          },
          [symbol]: 'symbol-value',
        })
        expect(order).toEqual([
          'screen-getter',
          'screen-default',
          'query-getter',
          'config-default',
          'body',
        ])
        expect(defaults).toEqual({
          screen_params: 'default',
          query: { bank_id: '123', [symbol]: 'symbol-value' },
          config: {
            screen_params: 'default',
            bank_id: '123',
            [symbol]: 'symbol-value',
          },
        })

        expect(readRest(params, config)).toEqual({
          first: params,
          rest: [config],
        })
        expect(assignRest(params, config)).toEqual({
          first: params,
          rest: [config],
        })
        expect(readIterable(new Set([1, 2, 3]))).toEqual({
          first: 1,
          rest: [2, 3],
        })
      } finally {
        await rm(root, { recursive: true, force: true })
      }
    },
  )
})
