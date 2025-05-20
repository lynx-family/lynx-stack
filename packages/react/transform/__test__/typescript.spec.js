// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from 'vitest';

import { transformReactLynx } from '../main.js';

describe('TypeScript', () => {
  it('import type {  } from "lynx-js/react-runtime"', async () => {
    const inputContent = `
import type {  } from "lynx-js/react-runtime";
`;
    const { code } = await transformReactLynx(inputContent, {
      syntaxConfig: { syntax: 'typescript', tsx: false },
    });

    expect(code).toMatchInlineSnapshot(`
      "export { };
      "
    `);
  });

  it('import type { Foo } from "lynx-js/react-runtime"', async () => {
    const inputContent = `
import type { Foo } from "lynx-js/react-runtime";
`;
    const { code } = await transformReactLynx(inputContent, {
      syntaxConfig: { syntax: 'typescript', tsx: false },
    });
    expect(code).toMatchInlineSnapshot(`
      "export { };
      "
    `);
  });

  it('import { type Foo } from "lynx-js/react-runtime"', async () => {
    const inputContent = `
import { type Foo } from "lynx-js/react-runtime";
`;
    const { code } = await transformReactLynx(inputContent, {
      syntaxConfig: { syntax: 'typescript', tsx: false },
    });
    expect(code).toMatchInlineSnapshot(`
      "export { };
      "
    `);
  });

  it('import { type Foo, type Bar } from "lynx-js/react-runtime"', async () => {
    const inputContent = `
import { type Foo, type Bar } from "lynx-js/react-runtime";
`;
    const { code } = await transformReactLynx(inputContent, {
      syntaxConfig: { syntax: 'typescript', tsx: false },
    });
    expect(code).toMatchInlineSnapshot(`
      "export { };
      "
    `);
  });

  it('import { type Foo(used), type Bar } from "lynx-js/react-runtime"', async () => {
    const inputContent = `
import { type Foo, type Bar } from "lynx-js/react-runtime";
export const a: Foo = {};
`;
    const { code } = await transformReactLynx(inputContent, {
      syntaxConfig: { syntax: 'typescript', tsx: false },
    });
    expect(code).toMatchInlineSnapshot(`
      "export const a = {};
      "
    `);
  });

  it('import { type Foo, Bar } from "lynx-js/react-runtime"', async () => {
    const inputContent = `
import { type Foo, Bar } from "lynx-js/react-runtime";
`;
    const { code } = await transformReactLynx(inputContent, {
      syntaxConfig: { syntax: 'typescript', tsx: false },
    });
    expect(code).toMatchInlineSnapshot(`
      "export { };
      "
    `);
  });

  it('import { Foo } from "lynx-js/react-runtime"', async () => {
    const inputContent = `
import { Foo } from "lynx-js/react-runtime";
`;
    const { code } = await transformReactLynx(inputContent, {
      syntaxConfig: { syntax: 'typescript', tsx: false },
    });
    expect(code).toMatchInlineSnapshot(`
      "export { };
      "
    `);
  });

  it('import {  } from "lynx-js/react-runtime"', async () => {
    const inputContent = `
import {  } from "lynx-js/react-runtime";
`;
    const { code } = await transformReactLynx(inputContent, {
      syntaxConfig: { syntax: 'typescript', tsx: false },
    });
    expect(code).toMatchInlineSnapshot(`
      "import "lynx-js/react-runtime";
      "
    `);
  });
});
