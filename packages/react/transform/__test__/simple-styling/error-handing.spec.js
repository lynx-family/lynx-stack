// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { formatMessages } from 'esbuild';
import { describe, expect, it } from 'vitest';

import { transformReactLynx } from '../../main.js';

describe('simple styling', () => {
  const __cfg = {
    pluginName: 'transform',
    filename: '',
    sourcemap: false,
    cssScope: false,
    jsx: {
      runtimePkg: '@lynx-js/react',
      filename: '',
      target: 'MIXED',
    },
    directiveDCE: false,
    defineDCE: false,
    shake: true,
    compat: {
      target: 'LEPUS',
      componentsPkg: ['@lynx-js/react-components'],
      oldRuntimePkg: ['@lynx-js/react-runtime'],
      newRuntimePkg: '@lynx-js/react',
      additionalComponentAttributes: [],
      addComponentElement: true,
      simplifyCtorLikeReactLynx2: true,
      disableDeprecatedWarning: false,
    },
    worklet: false,
    refresh: false,
    simpleStyling: true,
  };

  it('should not support dynamic style key', async () => {
    const result = await transformReactLynx(
      `
import { SimpleStyleSheet } from '@lynx-js/react'
const key = 'main';
const styles = SimpleStyleSheet.create({
  [key]: {
    width: '100px',
  },
})
`,
      __cfg,
    );
    expect(await formatMessages(result.errors, { kind: 'error' })).toMatchInlineSnapshot(`
      [
        "✘ [ERROR] Cannot statically evaluate the style key of SimpleStyleSheet \`styles\` [plugin transform]

          :5:2:
            5 │   [key]: {
              ╵   ~~~~~

      ",
      ]
    `);
  });
  it('should not support dynamic css property key', async () => {
    const result = await transformReactLynx(
      `
import { SimpleStyleSheet } from '@lynx-js/react'
const key = 'width';
const styles = SimpleStyleSheet.create({
  main: {
    [key]: '100px',
  },
})
`,
      __cfg,
    );
    expect(await formatMessages(result.errors, { kind: 'error' })).toMatchInlineSnapshot(`
      [
        "✘ [ERROR] Cannot statically evaluate the css property key of SimpleStyleSheet \`styles.main\` [plugin transform]

          :6:4:
            6 │     [key]: '100px',
              ╵     ~~~~~

      ",
      ]
    `);
  });
  it('should not support non string or number css property value', async () => {
    const result = await transformReactLynx(
      `
import { SimpleStyleSheet } from '@lynx-js/react'
const styles = SimpleStyleSheet.create({
  main: {
    display: 'flex',
    fontSize: 12,
    width: null,
    height: BigInt(2),
    fontSize: 1n
  },
})
`,
      __cfg,
    );
    expect(await formatMessages(result.errors, { kind: 'error' })).toMatchInlineSnapshot(`
      [
        "✘ [ERROR] Static CSS property value must be a string or number, check SimpleStyleSheet \`styles.main\` with css key \`width\` [plugin transform]

          :7:11:
            7 │     width: null,
              ╵            ~~~~

      ",
        "✘ [ERROR] Static CSS property value must be a string or number, check SimpleStyleSheet \`styles.main\` with css key \`height\` [plugin transform]

          :8:12:
            8 │     height: BigInt(2),
              ╵             ~~~~~~~~~

      ",
        "✘ [ERROR] Static CSS property value must be a string or number, check SimpleStyleSheet \`styles.main\` with css key \`fontSize\` [plugin transform]

          :9:14:
            9 │     fontSize: 1n
              ╵               ~~

      ",
      ]
    `);
  });
  it('expect 1 argument passed to SimpleStyleSheet.create()', async () => {
    const result = await transformReactLynx(
      `
import { SimpleStyleSheet } from '@lynx-js/react'
const styles = SimpleStyleSheet.create({})
const styles = SimpleStyleSheet.create()
const styles = SimpleStyleSheet.create(1)
const styles = SimpleStyleSheet.create(1, 2)
const styles = SimpleStyleSheet.create({}, 1, 2)
`,
      __cfg,
    );
    expect(await formatMessages(result.errors, { kind: 'error' })).toMatchInlineSnapshot(`
      [
        "✘ [ERROR] SimpleStyleSheet.create() should have exactly 1 argument, but got 0 [plugin transform]

          :4:15:
            4 │ const styles = SimpleStyleSheet.create()
              ╵                ~~~~~~~~~~~~~~~~~~~~~~~~~

      ",
        "✘ [ERROR] SimpleStyleSheet.create() should have an object argument, check SimpleStyleSheet \`styles\` [plugin transform]

          :5:15:
            5 │ const styles = SimpleStyleSheet.create(1)
              ╵                ~~~~~~~~~~~~~~~~~~~~~~~~~~

      ",
        "✘ [ERROR] SimpleStyleSheet.create() should have exactly 1 argument, but got 2 [plugin transform]

          :6:15:
            6 │ const styles = SimpleStyleSheet.create(1, 2)
              ╵                ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

      ",
        "✘ [ERROR] SimpleStyleSheet.create() should have exactly 1 argument, but got 3 [plugin transform]

          :7:15:
            7 │ const styles = SimpleStyleSheet.create({}, 1, 2)
              ╵                ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

      ",
      ]
    `);
  });
  it('dynamic style should return object literal ', async () => {
    const result = await transformReactLynx(
      `
import { SimpleStyleSheet } from '@lynx-js/react'

const styles = SimpleStyleSheet.create({
  withColor: (color) => null,
  dynamic: function() {
      return 1
  }
})
`,
      __cfg,
    );
    expect(await formatMessages(result.errors, { kind: 'error' })).toMatchInlineSnapshot(`
      [
        "✘ [ERROR] SimpleStyleSheet.create() call with arrow function should return an object, check SimpleStyleSheet \`styles.withColor\` [plugin transform]

          :5:13:
            5 │   withColor: (color) => null,
              ╵              ~~~~~~~~~~~~~~~

      ",
        "✘ [ERROR] Cannot statically evaluate the style value of SimpleStyleSheet \`styles.dynamic\`, should be an object literal or arrow function return an object literal [plugin transform]

          :6:11:
            6 │   dynamic: function() {
              ╵            ~~~~~~~~~~~~

      ",
      ]
    `);
  });
  it('should not support dynamic style access', async () => {
    const result = await transformReactLynx(
      `
import { SimpleStyleSheet } from '@lynx-js/react'
const styles = SimpleStyleSheet.create({
  main: {
    width: '100px'
  }
})
const key = 'main'
const jsx = <view simpleStyle={[styles[key]]} />
`,
      __cfg,
    );
    expect(await formatMessages(result.errors, { kind: 'error' })).toMatchInlineSnapshot(`
      [
        "✘ [ERROR] Cannot statically evaluate the style key of SimpleStyleSheet \`styles\` [plugin transform]

          :9:39:
            9 │ const jsx = <view simpleStyle={[styles[key]]} />
              ╵                                        ~~~

      ",
        "✘ [ERROR] The usage of SimpleStyleSheet is not supported, please check [plugin transform]

          :9:32:
            9 │ const jsx = <view simpleStyle={[styles[key]]} />
              ╵                                 ~~~~~~~~~~~

      ",
      ]
    `);
  });
  it('should not support unknown stylesheet usage', async () => {
    const result = await transformReactLynx(
      `
import { SimpleStyleSheet } from '@lynx-js/react'
const styles = SimpleStyleSheet.create({
  main: {
    width: '100px'
  }
})
const key = 'main'
const jsx = <view simpleStyle={[1+2]} />
`,
      __cfg,
    );
    expect(await formatMessages(result.errors, { kind: 'error' })).toMatchInlineSnapshot(`
      [
        "✘ [ERROR] The usage of SimpleStyleSheet is not supported, please check [plugin transform]

          :9:32:
            9 │ const jsx = <view simpleStyle={[1+2]} />
              ╵                                 ~~~

      ",
      ]
    `);
  });
  it('should not support non-array simpleStyle', async () => {
    const result = await transformReactLynx(
      `
import { SimpleStyleSheet } from '@lynx-js/react'
const styles = SimpleStyleSheet.create({
  main: {
    width: '100px'
  }
})
const key = 'main'
const jsx = <view simpleStyle={1} />
`,
      __cfg,
    );
    expect(await formatMessages(result.errors, { kind: 'error' })).toMatchInlineSnapshot(`
      [
        "✘ [ERROR] simpleStyle should be an array [plugin transform]

          :9:30:
            9 │ const jsx = <view simpleStyle={1} />
              ╵                               ~~~

      ",
      ]
    `);
  });
  it('should not support shorthand css property', async () => {
    const result = await transformReactLynx(
      `
import { SimpleStyleSheet } from '@lynx-js/react'
const styles = SimpleStyleSheet.create({
  main: {
    padding: '100px'
  }
})
const jsx = <view simpleStyle={[styles.main]} />
`,
      __cfg,
    );

    expect(await formatMessages(result.errors, { kind: 'error' })).toMatchInlineSnapshot(`
      [
        "✘ [ERROR] Only longhand css properties are supported in Simple Styling, check SimpleStyleSheet \`styles.main\` with css key \`padding\` [plugin transform]

          :5:4:
            5 │     padding: '100px'
              ╵     ~~~~~~~

      ",
      ]
    `);
  });
  it('should not support duplicate css properties in all styles', async () => {
    const result = await transformReactLynx(
      `
import { SimpleStyleSheet } from '@lynx-js/react'

const styles = SimpleStyleSheet.create({
  main: {
    width: '100px',
    height: '100px',
    backgroundColor: 'yellow',
  },
  active: {
    width: '100px',
    borderBottomWidth: '1px',
  },
  withColor: (color) => ({
    backgroundColor: color,
    width: '10px',
    borderBottomWidth: '1px',
  }),
})
  
export function ComponentWithSimpleStyle({
  color,
  isActive,
}) {
  return (
    <view>
      <view
        simpleStyle={[
          styles.main,
          styles.active
        ]}
      />
      <view
        simpleStyle={[
          styles.main,
          isActive && styles.active,
          styles.withColor(color),
        ]}
      />
    </view>
  )
}
`,
      __cfg,
    );

    expect(await formatMessages(result.errors, { kind: 'error' })).toMatchInlineSnapshot(`
      [
        "✘ [ERROR] Duplicate css property is not supported in Simple Styling, found \`width\` in SimpleStyleSheet \`styles.main\` and \`styles.active\` [plugin transform]

          :30:10:
            30 │           styles.active
               ╵           ~~~~~~~~~~~~~

      ",
        "✘ [ERROR] Duplicate css property is not supported in Simple Styling, found \`width\` in SimpleStyleSheet \`styles.main\` and \`styles.active\` [plugin transform]

          :36:22:
            36 │           isActive && styles.active,
               ╵                       ~~~~~~~~~~~~~

      ",
        "✘ [ERROR] Duplicate css property is not supported in Simple Styling, found \`width\` in SimpleStyleSheet \`styles.active\` and \`styles.withColor\` [plugin transform]

          :37:10:
            37 │           styles.withColor(color),
               ╵           ~~~~~~~~~~~~~~~~~~~~~~~

      ",
        "✘ [ERROR] Duplicate css property is not supported in Simple Styling, found \`borderBottomWidth\` in SimpleStyleSheet \`styles.active\` and \`styles.withColor\` [plugin transform]

          :37:10:
            37 │           styles.withColor(color),
               ╵           ~~~~~~~~~~~~~~~~~~~~~~~

      ",
      ]
    `);
  });
  it('should report error if simple styling is not enabled', async () => {
    const result = await transformReactLynx(
      `
import { SimpleStyleSheet } from '@lynx-js/react'
const styles = SimpleStyleSheet.create({
  main: {
    padding: '100px'
  }
})
const jsx = <view simpleStyle={[styles.main]} />
`,
      {
        ...__cfg,
        simpleStyling: false,
      },
    );

    expect(await formatMessages(result.warnings, { kind: 'warning' })).toMatchInlineSnapshot(`
      [
        "▲ [WARNING] \`simpleStyle\` attribute is only supported in simple styling mode, please enable it by setting \`enableSimpleStyling: true\` in the pluginReactLynx. [plugin transform]

          :8:18:
            8 │ const jsx = <view simpleStyle={[styles.main]} />
              ╵                   ~~~~~~~~~~~~~~~~~~~~~~~~~~~

      ",
      ]
    `);
  });
});
