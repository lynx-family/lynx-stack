/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
/* v8 ignore start */
/** @jsxImportSource ../../lepus */

import { useState } from '../../src/index';

function SubCompMT(props) {
  return <view attr={props}></view>;
}

function CompMT() {
  const [v, setV] = useState('World');
  const [v2, setV2] = useState({ dataX: 'WorldX' });

  return (
    <view>
      <text>{lynx.__initData.text}</text>
      <text>{v}</text>
      <view attr={v2}></view>
      <SubCompMT attr={v2} />
    </view>
  );
}

export const BasicMT = <CompMT />;

export const ViewMT = (
  <view>
    <CompMT />
  </view>
);

function ListItem(props) {
  return <view attr={props.attr}></view>;
}

function CompList() {
  const [data, setData] = useState(['a', 'b', 'c']);
  return (
    <list>
      {[0, 1, 2].map((index) => {
        return (
          <list-item item-key={index}>
            <ListItem attr={data[index]}></ListItem>
          </list-item>
        );
      })}
    </list>
  );
}

export const ListMT = <CompList />;

function CompListConditional() {
  const [data] = useState(['a', 'b', 'c']);

  return (
    lynx.__initData.shouldRender && (
      <list>
        {[0, 1, 2].map((index) => {
          return (
            <list-item item-key={index}>
              <ListItem attr={data[index]}></ListItem>
            </list-item>
          );
        })}
      </list>
    )
  );
}

export const ListConditionalMT = <CompListConditional />;
/* v8 ignore stop */
