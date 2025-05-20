/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
/* v8 ignore start */
import { useState } from '../../src/index';

export let setStr;
export let setObj;

function SubCompBG(props) {
  return <view attr={props}></view>;
}

function CompBG() {
  const [v, setV_] = useState('World');
  const [v2, setV2_] = useState({ dataX: 'WorldX' });

  setStr = setV_;
  setObj = setV2_;

  return (
    <view>
      <text>{lynx.__initData.text}</text>
      <text>{v}</text>
      <view attr={v2}></view>
      <SubCompBG attr={v2} />
    </view>
  );
}

export const BasicBG = <CompBG />;

export const ViewBG = (
  <view>
    <CompBG />
  </view>
);

function ListItem(props) {
  return <view attr={props.attr}></view>;
}

function CompList() {
  const [data, setData_] = useState(['a', 'b', 'c']);
  setObj = setData_;
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

export const ListBG = <CompList />;

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

export const ListConditionalBG = <CompListConditional />;
/* v8 ignore stop */
