// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { JSX } from '../../jsx-runtime/index.js';
import type { MainThread, NodesRef, Target, TouchEvent } from '@lynx-js/types';
import { assertType, describe, test } from 'vitest';
import { useMainThreadRef } from '../../src/lynx-api.js';
import { useRef } from '../../src/hooks/react.js';

describe('JSX Runtime Types', () => {
  test('should support basic JSX element', () => {
    const viewEle = (
      <view>
        <text>child node</text>
      </view>
    );
    assertType<JSX.Element>(viewEle);
  });

  test('should validate the required props for raw-text', () => {
    // @ts-expect-error: Missing required prop 'text'
    const shouldError = <raw-text></raw-text>;

    const rawTextELe = <raw-text text={'text'}></raw-text>;
    assertType<JSX.Element>(rawTextELe);
  });

  test('should support JSX.Elements', () => {
    function App() {
      function renderFoo(): JSX.Element {
        return <text></text>;
      }
      return renderFoo();
    }
    assertType<JSX.Element>(App());
  });

  test('should error on unsupported tags', () => {
    // @ts-expect-error: Unsupported tag
    const divElement = <div></div>;
  });

  test('should support event handlers', () => {
    const viewWithBind = (
      <view
        bindtap={(e) => {
          assertType<number>(e.detail.x);
          assertType<TouchEvent>(e);
        }}
      >
      </view>
    );
    const viewWithCatch = (
      <view
        catchtap={(e) => {
          assertType<Target>(e.currentTarget);
          assertType<TouchEvent>(e);
        }}
      >
      </view>
    );
    assertType<JSX.Element>(viewWithBind);
    assertType<JSX.Element>(viewWithCatch);
  });

  test('should support main-thread event handlers', () => {
    const viewWithMainThreadEvent = (
      <view
        main-thread:bindtap={(e) => {
          assertType<number>(e.detail.x);
          assertType<MainThread.Element>(e.currentTarget);
        }}
      >
      </view>
    );
    assertType<JSX.Element>(viewWithMainThreadEvent);
  });

  test('should support ref prop with ref object', () => {
    const ref = useRef<NodesRef>(null);
    const viewWithRefObject = <view ref={ref}></view>;
    assertType<JSX.Element>(viewWithRefObject);
  });

  test('should support ref prop with function', () => {
    const ref = useRef<NodesRef>(null);
    const viewWithRefCallback = (
      <view
        ref={(n) => {
          assertType<NodesRef | null>(n);
          ref.current = n;
        }}
      >
      </view>
    );
    assertType<JSX.Element>(viewWithRefCallback);
  });

  test('should support main-thread ref', () => {
    const mtRef = useMainThreadRef<MainThread.Element>(null);
    const viewWithMainThreadRef = <view main-thread:ref={mtRef}></view>;
    assertType<JSX.Element>(viewWithMainThreadRef);
  });
});
