// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { pickJSXFromProps } from '../../src/mtc/pickJSXFromProps';

function BTC1() {
  return <view>BTC1</view>;
}
function BTC2() {
  return <view>BTC2</view>;
}
function BTC3() {
  return <view>BTC3</view>;
}
function BTC4() {
  return <view>BTC4</view>;
}
function BTC5() {
  return <view>BTC5</view>;
}
function BTC6() {
  return <view>BTC6</view>;
}
const mtcProps = {
  p1: <BTC1 />,
  p2: { x1: <BTC2 /> },
  p3: [<BTC3 />, <BTC5 />],
  p4: () => <BTC4 />,
  children: <BTC6 />,
  p5: {
    a: 1,
    b: 'string',
    c: null,
    d: undefined,
    e: true,
    f: false,
    g: () => {},
    h: 123,
    i: { x: 1, y: 2 },
  }
};
function RealMTC(props) {
  const foo = true;
  return (
    <>
      {props.p2.x1}
      {props.children}
      {foo && props.p1}
      {...props.p3}
      {props.p4()}
      {props.p5}
    </>
  );
}
function RootBTC() {
  return (
    <RealMTC {...mtcProps}>
      <BTC6 />
    </RealMTC>
  );
}

it('pickJSXFromProps', () => {
  const result = pickJSXFromProps(mtcProps);
  expect(result).toMatchInlineSnapshot(`
    [
      [
        <BTC1 />,
        <BTC2 />,
        <BTC3 />,
        <BTC5 />,
        <BTC4 />,
        <BTC6 />,
      ],
      {
        "children": {
          "$$typeof": Symbol(mtc-slot),
          "i": 5,
        },
        "p1": {
          "$$typeof": Symbol(mtc-slot),
          "i": 0,
        },
        "p2": {
          "x1": {
            "$$typeof": Symbol(mtc-slot),
            "i": 1,
          },
        },
        "p3": [
          {
            "$$typeof": Symbol(mtc-slot),
            "i": 2,
          },
          {
            "$$typeof": Symbol(mtc-slot),
            "i": 3,
          },
        ],
        "p4": [Function],
        "p5": {
          "a": 1,
          "b": "string",
          "c": null,
          "d": undefined,
          "e": true,
          "f": false,
          "g": [Function],
          "h": 123,
          "i": {
            "x": 1,
            "y": 2,
          },
        },
      },
    ]
  `);
});
