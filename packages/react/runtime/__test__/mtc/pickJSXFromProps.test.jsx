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
  },
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
        [
          <BTC1 />,
          {
            "$$typeof": "__MTC_SLOT__",
            "i": 0,
          },
        ],
        [
          <BTC2 />,
          {
            "$$typeof": "__MTC_SLOT__",
            "i": 1,
          },
        ],
        [
          <BTC3 />,
          {
            "$$typeof": "__MTC_SLOT__",
            "i": 2,
          },
        ],
        [
          <BTC5 />,
          {
            "$$typeof": "__MTC_SLOT__",
            "i": 3,
          },
        ],
        [
          <BTC4 />,
          {
            "$$typeof": "__MTC_SLOT__",
            "i": 4,
          },
        ],
        [
          <BTC6 />,
          {
            "$$typeof": "__MTC_SLOT__",
            "i": 5,
          },
        ],
      ],
      {
        "children": {
          "$$typeof": "__MTC_SLOT__",
          "i": 5,
        },
        "p1": {
          "$$typeof": "__MTC_SLOT__",
          "i": 0,
        },
        "p2": {
          "x1": {
            "$$typeof": "__MTC_SLOT__",
            "i": 1,
          },
        },
        "p3": [
          {
            "$$typeof": "__MTC_SLOT__",
            "i": 2,
          },
          {
            "$$typeof": "__MTC_SLOT__",
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
  expect(JSON.stringify(result[1])).toMatchInlineSnapshot(`
    "{"p1":{"$$typeof":"__MTC_SLOT__","i":0},"p2":{"x1":{"$$typeof":"__MTC_SLOT__","i":1}},"p3":[{"$$typeof":"__MTC_SLOT__","i":2},{"$$typeof":"__MTC_SLOT__","i":3}],"children":{"$$typeof":"__MTC_SLOT__","i":5},"p5":{"a":1,"b":"string","c":null,"e":true,"f":false,"h":123,"i":{"x":1,"y":2}}}"
  `);
});
