// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Component, root } from '@lynx-js/react';
import './index.css';
import Img from './img.png';

class App extends Component {
  state = {
    items: [],
  };

  onstartrefresh(e) {
    console.log('on start refresh');

    setTimeout(() => this.setState({ items: [0, 0] }), 1000);
    setTimeout(
      () =>
        lynx
          .createSelectorQuery()
          .select('#refresh-view')
          .invoke({
            method: 'finishRefresh',
          })
          .exec(),
      1000,
    );
  }

  onstartloadmore(e) {
    console.log('on start loadmore');

    setTimeout(
      () => this.setState({ items: this.state.items.concat([0, 0]) }),
      1000,
    );
    setTimeout(
      () =>
        lynx
          .createSelectorQuery()
          .select('#refresh-view')
          .invoke({
            method: 'finishLoadMore',
            params: { has_more: true },
          })
          .exec(),
      1000,
    );
  }

  render() {
    return (
      <x-refresh-view
        class='refresh-view'
        id='refresh-view'
        enable-footer-rebound={true}
        enable-auto-loadmore={false}
        bindstartrefresh={this.onstartrefresh.bind(this)}
        bindstartloadmore={this.onstartloadmore.bind(this)}
      >
        <x-refresh-header class='refresh-header'>
          <image src={Img} style='width:30px;height:30px;' />
        </x-refresh-header>

        <scroll-view class='scroll-view' scroll-y={true} bounces={true}>
          <image
            src={Img}
            style='width:100%;height:50%;background-color:#0ff;'
          />
          {this.state.items
            && this.state.items.map((item, index) => (
              <view class='item'>
                <text style='width:100%;height:100%;font-size:18px;'>
                  {`item-${index + 1}`}
                </text>
              </view>
            ))}
        </scroll-view>

        <x-refresh-footer class='refresh-footer'>
          <image src={Img} style='width:30px;height:30px;' />
        </x-refresh-footer>
      </x-refresh-view>
    );
  }
}

root.render(<App></App>);
