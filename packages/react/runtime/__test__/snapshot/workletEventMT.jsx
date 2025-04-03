// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** @jsxImportSource ../../lepus */

import { Component } from '../../src/index';

const events = [{
  _wkltId: '835d:450ef:0',
}, {
  _wkltId: '835d:450ef:1',
}, {
  _wkltId: '835d:450ef:2',
}];

class ListItem extends Component {
  render() {
    return <view main-thread:bindtap={this.props._event}></view>;
  }
}

class Comp extends Component {
  render() {
    return (
      <list>
        {[0, 1, 2].map((index) => {
          return (
            <list-item item-key={index}>
              <ListItem _event={events[index]}></ListItem>
            </list-item>
          );
        })}
      </list>
    );
  }
}

export const ListMT = <Comp />;
