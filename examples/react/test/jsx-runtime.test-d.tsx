// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { assertType, describe, expectTypeOf, test } from 'vitest';

import {
  Component,
  forwardRef,
  Fragment,
  memo,
  Suspense,
  useMainThreadRef,
  useRef,
} from '@lynx-js/react';
import type { FC, JSX, ReactNode } from '@lynx-js/react';
import type { MainThread, NodesRef, Target, TouchEvent } from '@lynx-js/types';

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
    const _shouldError = <raw-text></raw-text>;

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
    const _divElement = <div></div>;
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
    const viewWithRefCallback = (
      <view
        ref={(n) => {
          assertType<NodesRef | null>(n);
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

  test('should support Suspense', () => {
    const jsx = (
      <Suspense fallback={<text>Loading...</text>}>
        <text>Hello, World!</text>
      </Suspense>
    );
    assertType<JSX.Element>(jsx);
  });

  test('should support Fragment', () => {
    const jsx = (
      <>
        <text>Hello, World!</text>
        <Fragment>
          <text>Hello, World!</text>
        </Fragment>
      </>
    );
    assertType<JSX.Element>(jsx);
  });

  test('should support class attributes', () => {
    class Foo extends Component {
      override render(): ReactNode {
        return <text>Hello, World!</text>;
      }
    }

    assertType<JSX.Element>(
      <Foo
        ref={(foo) => {
          assertType<Foo | null>(foo);
        }}
      />,
    );

    const ref = useRef<Foo>(null);
    assertType<JSX.Element>(
      <Foo ref={ref} />,
    );
  });

  test('should support memo()', () => {
    interface Props {
      foo: string;
    }

    const MemoComponent = memo<Props>((props) => {
      assertType<Props>(props);
      return <text>Hello, World!</text>;
    });

    assertType<JSX.Element>(<MemoComponent foo='bar' />);
  });

  test('should support forwardRef()', () => {
    interface Props {
      foo: string;
    }
    const ForwardRefComponent = forwardRef<NodesRef, Props>((props, ref) => {
      assertType<Props>(props);
      return <text ref={ref}>Hello, World!</text>;
    });

    assertType<JSX.Element>(
      <ForwardRefComponent
        foo='bar'
        ref={(node) => {
          assertType<NodesRef | null>(node);
        }}
      />,
    );
  });

  test('should support key on JSX elements', () => {
    assertType<JSX.Element>(<text key='foo'>Hello, World!</text>);
    assertType<JSX.Element>(<text key={null}>Hello, World!</text>);
  });

  test('should support key on Components', () => {
    class Foo extends Component {
      override render(): ReactNode {
        expectTypeOf(this.props).not.toHaveProperty('key');
        return <text>Hello, World!</text>;
      }
    }
    const Bar: FC = function Bar(props) {
      expectTypeOf(props).not.toHaveProperty('key');
      return <text>Hello, World!</text>;
    };
    const ForwardRefComponent = forwardRef<NodesRef>((props, ref) => {
      expectTypeOf(props).not.toHaveProperty('key');
      return <text ref={ref}>Hello, World!</text>;
    });
    assertType<JSX.Element>(<Foo key={null} />);
    assertType<JSX.Element>(<Foo key='foo' />);
    assertType<JSX.Element>(<Bar key='bar' />);
    assertType<JSX.Element>(<ForwardRefComponent key='forward' />);
  });
});
