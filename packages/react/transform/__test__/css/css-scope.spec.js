// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from 'vitest';

import { transformReactLynx } from '../../main.js';

/** @type {import('../../index.d.ts').TransformNodiffOptions} */
const defaultOptions = {
  mode: 'test',
  sourcemap: false,
  snapshot: {
    runtimePkg: '@lynx-js/react',
    jsxImportSource: '@lynx-js/react',
    target: 'MIXED',
  },
  directiveDCE: false,
  defineDCE: false,
  shake: false,
  compat: false,
  worklet: false,
};

describe('CSS Scope', () => {
  it('should transform imports with default options', async () => {
    const result = await transformReactLynx(
      `\
import './foo.css'
import bar from './bar.css'
import * as styles from './baz.scss'
import { styles0, styles1 } from './foo.modules.css'
bar, styles, styles0, styles1
`,
    );

    await expect(result.code).toMatchFileSnapshot(
      `__snapshots__/transform-imports-defaults.js`,
    );
  });

  it('should transform jsx with default options', async () => {
    const result = await transformReactLynx(
      `\
<view />;
const jsx = <text>foo</text>
function Foo() {
  return <Bar><view /></Bar>
}
function App() {
  return <Baz foo={<view />} />
}
Foo, App
`,
    );

    await expect(result.code).toMatchFileSnapshot(
      `__snapshots__/transform-jsx-defaults.js`,
    );
  });

  it.each([{ mode: 'all' }, { mode: 'none' }, { mode: 'modules' }])(
    'should transform imports with cssScope: $mode',
    async ({ mode }) => {
      const result = await transformReactLynx(
        `\
import './foo.css'
import bar from './bar.css'
import * as styles from './baz.scss'
import { styles0, styles1 } from './foo.modules.css'
const jsx = <view className={\`foo \${styles.bar} \${styles2.baz} \${clsA} \${clsB}\`} />
bar, styles, styles0, styles1
`,
        {
          ...defaultOptions,
          cssScope: {
            mode,
          },
        },
      );

      await expect(result.code).toMatchFileSnapshot(
        `__snapshots__/transform-imports-css-scoped-${mode}.js`,
      );
    },
  );

  it.each([{ mode: 'all' }, { mode: 'none' }, { mode: 'modules' }])(
    'should transform imports without JSX with cssScope: $mode',
    async ({ mode }) => {
      const result = await transformReactLynx(
        `\
import './foo.css'
import bar from './bar.css'
import * as styles from './baz.scss'
import { styles0, styles1 } from './foo.modules.css'
bar, styles, styles0, styles1
`,
        {
          ...defaultOptions,
          cssScope: {
            mode,
          },
        },
      );

      await expect(result.code).toMatchFileSnapshot(
        `__snapshots__/transform-imports-without-jsx-css-scoped-${mode}.js`,
      );
    },
  );

  it.each([{ mode: 'all' }, { mode: 'none' }, { mode: 'modules' }])(
    'should transform jsx with cssScope: $mode',
    async ({ mode }) => {
      const result = await transformReactLynx(
        `\
<view />;
const jsx = <text>foo</text>
function Foo() {
  return <Bar><view /></Bar>
}
function App() {
  return <Baz foo={<view />} />
}
Foo, App
`,
        {
          ...defaultOptions,
          cssScope: {
            mode,
          },
        },
      );

      await expect(result.code).toMatchFileSnapshot(
        `__snapshots__/transform-jsx-css-scoped-${mode}.js`,
      );
    },
  );

  it.each([{ mode: 'all' }, { mode: 'none' }, { mode: 'modules' }])(
    'should transform jsx within dynamic component with cssScope: $mode',
    async ({ mode }) => {
      const result = await transformReactLynx(
        `\
<view />;
const jsx = <text>foo</text>
function Foo() {
  return <Bar><view /></Bar>
}
function App() {
  return <Baz foo={<view />} />
}
Foo, App
`,
        {
          ...defaultOptions,
          snapshot: {
            ...defaultOptions.snapshot,
            isDynamicComponent: true,
          },
          cssScope: {
            mode,
          },
        },
      );

      await expect(result.code).toMatchFileSnapshot(
        `__snapshots__/transform-jsx-css-scoped-${mode}-lazy-bundle.js`,
      );
    },
  );

  it.each([{ mode: 'all' }, { mode: 'none' }, { mode: 'modules' }])(
    'should transform all with cssScope: $mode',
    async ({ mode }) => {
      const result = await transformReactLynx(
        `\
import './foo.css'
import bar from './bar.css'
function App() {
  return <Baz foo={<view />} />
}
bar, App
`,
        {
          ...defaultOptions,
          cssScope: {
            mode,
          },
        },
      );

      await expect(result.code).toMatchFileSnapshot(
        `__snapshots__/transform-all-css-scoped-${mode}.js`,
      );
    },
  );
});
