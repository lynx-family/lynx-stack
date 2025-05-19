/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/

/** @jsxImportSource ../../lepus */

import { useMainThreadRef } from '../../src/worklet/workletRef';

/* v8 ignore start */
let ref1;
let ref2;
function Comp1(props) {
  ref1 = useMainThreadRef();
  ref2 = useMainThreadRef();

  let ref;
  if (props.ref_ === 'ref1') {
    ref = ref1;
  } else if (props.ref_ === 'ref2') {
    ref = ref2;
  } else if (props.ref_ === 'null') {
    ref = null;
  } else if (props.ref_ === 'number') {
    ref = 1;
  } else if (props.ref_ === 'mts') {
    ref = {
      _wkltId: 233,
    };
  } else {
    throw new Error();
  }

  return (
    <view>
      <view main-thread:ref={ref} />
    </view>
  );
}

export const createCompMT1 = (ref) => {
  return <Comp1 ref_={ref} />;
};

function ListItem(props) {
  return <view main-thread:ref={props.ref_}></view>;
}

function CompList(props) {
  return (
    <list>
      {props.ref_.map((elem, index) => {
        return (
          <list-item item-key={index}>
            <ListItem ref_={elem}></ListItem>
          </list-item>
        );
      })}
    </list>
  );
}

export const createCompMTList = (ref) => {
  return <CompList ref_={ref} />;
};

function CompSpread(props) {
  ref1 = useMainThreadRef();

  let spread;
  if (props.spread === 'ref') {
    spread = {
      'main-thread:ref': ref1,
    };
  } else if (props.spread === 'null') {
    spread = {};
  } else if (props.spread === 'mts') {
    spread = {
      'main-thread:ref': {
        _wkltId: 233,
      },
    };
  } else {
    throw new Error();
  }

  return (
    <view>
      <view {...spread} />
    </view>
  );
}

export const createCompMTSpread = (spread) => {
  return <CompSpread spread={spread} />;
};

/* v8 ignore stop */
