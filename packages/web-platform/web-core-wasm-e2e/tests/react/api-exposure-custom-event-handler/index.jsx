/*
// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component, root } from '@lynx-js/react';
import './index.css';

export class BlockView extends Component {
  state = {
    id: 0,
    exposured: false,
  };

  constructor(props) {
    super(props);
  }

  appear = (e) => {
    this.setState({
      exposured: true,
    });
    console.log('custom-appear', e.target.dataset.id);
  };

  disappear = (e) => {
    this.setState({
      exposured: false,
    });
    console.log('custom-disappear', e.target.dataset.id);
  };

  render() {
    const { item, flag } = this.props;

    return (
      <view
        class='list-view'
        style={`height:${flag ? 125 : 100}px; ${
          this.state.exposured ? 'background-color: #55AA55' : ''
        }`}
        data-id={`component-${item}`}
        binduiappear={this.appear}
        binduidisappear={this.disappear}
      >
      </view>
    );
  }
}

class Page extends Component {
  config = {
    enableListNewArchitecture: true,
  };

  state = {
    flag: true,
    component_flag: false,
    items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  };

  appear(e) {
    console.log('custom-appear', e.target.dataset.id);
  }

  disappear(e) {
    console.log('custom-disappear', e.target.dataset.id);
  }

  ontap(e) {
    this.setState({ flag: !this.state.flag });
  }

  render() {
    return (
      <view class='container'>
        title
        <view class='case'>
          <scroll-view class='list'>
            {this.state.items
              && this.state.items.map((item) => (
                <BlockView
                  item={item}
                  flag={this.state.component_flag}
                  data-id={`root-${item}`}
                  item-key={item}
                  binduiappear={this.appear}
                  binduidisappear={this.disappear}
                />
              ))}
          </scroll-view>
        </view>
        <view class='button' bindtap={this.ontap}>
          <text>dis/exposure view-2</text>
        </view>
      </view>
    );
  }
}

root.render(<Page />);
