// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path';

import { describe, expect, test } from '@rstest/core';

import { resourcesToLazyBundleName } from '../src/LynxTemplatePlugin.js';

const context = path.join(path.sep, 'project');
const resolve = (...segments: string[]) => path.join(context, ...segments);

describe('resourcesToLazyBundleName', () => {
  test('keeps a short path readable', () => {
    expect(resourcesToLazyBundleName([resolve('src', 'Foo.tsx')], context))
      .toBe('src/Foo.tsx');
  });

  test('escapes `..` so the bundle stays under the output directory', () => {
    expect(resourcesToLazyBundleName([resolve('..', 'Foo.tsx')], context))
      .toBe('__/Foo.tsx');
  });

  test('joins the resources of one chunk group', () => {
    expect(
      resourcesToLazyBundleName(
        [resolve('src', 'a.tsx'), resolve('src', 'b.tsx')],
        context,
      ),
    ).toBe('src/a.tsx_src/b.tsx');
  });

  test('replaces the directories of an overlong path with a digest', () => {
    const deep = resolve(...Array.from({ length: 8 }, () => 'a'.repeat(16)));
    const name = resourcesToLazyBundleName(
      [path.join(deep, 'Foo.tsx')],
      context,
    );

    expect(name).toMatch(/^Foo\.tsx-[0-9a-f]{8}$/);
    expect(name).not.toContain('/');
  });

  test('is stable for the same resolved path', () => {
    const deep = resolve(...Array.from({ length: 8 }, () => 'b'.repeat(16)));
    const of = () =>
      resourcesToLazyBundleName([path.join(deep, 'Foo.tsx')], context);

    expect(of()).toBe(of());
  });
});
