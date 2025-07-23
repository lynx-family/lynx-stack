/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { noop } from './hook';

import { render } from 'preact';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { setupDocument } from '../../src/document';
import { setupPage, snapshotInstanceManager } from '../../src/snapshot';
import { initProfileHook } from '../../src/debug/profile';

describe('profile', () => {
  let scratch;
  beforeAll(() => {
    initProfileHook();
    setupDocument();
    setupPage(__CreatePage('0', 0));
  });

  beforeEach(() => {
    snapshotInstanceManager.clear();
    scratch = document.createElement('root');
  });

  test('original options hooks should be called', async () => {
    vi.stubGlobal('__JS__', true);

    render(
      null,
      scratch,
    );

    expect(noop).toBeCalledTimes(3);
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

    // render::
    expect(lynx.performance.profileStart).toBeCalledWith(`render::Foo`);
    expect(lynx.performance.profileStart).not.toBeCalledWith(`render::Bar`);
    expect(lynx.performance.profileStart).toBeCalledWith(`render::Baz`);
    expect(lynx.performance.profileStart).not.toBeCalledWith(`render::ClassComponent`);
    expect(lynx.performance.profileStart).toBeCalledWith(`render::Clazz`);

    // diff::
    expect(lynx.performance.profileStart).toBeCalledWith(`diff::Foo`);
    expect(lynx.performance.profileStart).not.toBeCalledWith(`diff::Bar`);
    expect(lynx.performance.profileStart).toBeCalledWith(`diff::Baz`);
    expect(lynx.performance.profileStart).not.toBeCalledWith(`diff::ClassComponent`);
    expect(lynx.performance.profileStart).toBeCalledWith(`diff::Clazz`);
  });
});
