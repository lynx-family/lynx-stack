// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Component, createRef } from '../../src/index';

export const refsBG = [createRef(), createRef(), createRef()];

class ListItem extends Component {
  render() {
    return <view ref={this.props._ref}></view>;
  }
}

class Comp extends Component {
  render() {
    return (
      <list>
        {[0, 1, 2].map((index) => {
          return (
            <list-item item-key={index}>
              <ListItem _ref={refsBG[index]}></ListItem>
            </list-item>
          );
        })}
      </list>
    );
  }
}

export const ListBG = <Comp />;
