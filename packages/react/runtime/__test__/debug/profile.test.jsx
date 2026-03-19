/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { render, options } from 'preact';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { setupPage, snapshotInstanceManager } from '../../src/snapshot';
import { initProfileHook } from '../../src/debug/profileHooks';

describe('profile', () => {
  let scratch;
  beforeAll(() => {
    initProfileHook();
    setupPage(__CreatePage('0', 0));
  });

  beforeEach(() => {
    snapshotInstanceManager.clear();
    scratch = options.setupDom({ type: 'root' });
  });

  test('original options hooks should be called', async () => {
    const noop = vi.fn();
    const oldDiff = options.__b;
    const oldDiff2 = options._diff2;
    const oldRender = options.__r;
    const oldDiffed = options.diffed;

    options.__b = noop;
    options._diff2 = noop;
    options.__r = noop;
    options.diffed = noop;

    render(
      null,
      scratch,
    );

    expect(noop).toBeCalledTimes(4);

    options.__b = oldDiff;
    options._diff2 = oldDiff2;
    options.__r = oldRender;
    options.diffed = oldDiffed;
  });

  test('diff and render should be profiled', async () => {
    class ClassComponent {
      render() {
        return null;
      }

      static displayName = 'Clazz';
    }

    function Bar() {
      return <ClassComponent />;
    }
    Bar.displayName = 'Baz';

    function Foo() {
      return <Bar />;
    }

    render(
      <Foo />,
      scratch,
    );

    // // ReactLynx::render::
    expect(lynx.performance.profileStart).toBeCalledWith(`ReactLynx::render::Foo`);
    expect(lynx.performance.profileStart).not.toBeCalledWith(`ReactLynx::render::Bar`);
    expect(lynx.performance.profileStart).toBeCalledWith(`ReactLynx::render::Baz`);
    expect(lynx.performance.profileStart).not.toBeCalledWith(`ReactLynx::render::ClassComponent`);
    expect(lynx.performance.profileStart).toBeCalledWith(`ReactLynx::render::Clazz`);

    // // ReactLynx::diff::
    expect(lynx.performance.profileStart).toBeCalledWith(`ReactLynx::diff::Foo`, {});
    expect(lynx.performance.profileStart).not.toBeCalledWith(`ReactLynx::diff::Bar`);
    expect(lynx.performance.profileStart).toBeCalledWith(`ReactLynx::diff::Baz`, {});
    expect(lynx.performance.profileStart).not.toBeCalledWith(`ReactLynx::diff::ClassComponent`);
    expect(lynx.performance.profileStart).toBeCalledWith(`ReactLynx::diff::Clazz`, {});
  });
});
