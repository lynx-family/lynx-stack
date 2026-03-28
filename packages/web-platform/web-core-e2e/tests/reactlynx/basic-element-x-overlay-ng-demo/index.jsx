// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Component, root } from '@lynx-js/react';

import './index.css';

export default class App extends Component {
  render() {
    const { show, showAnim, cnt = 1, top } = this.state;

    let style = top
      ? 'background:red;top:300px;width:100%;'
      : 'background:red;top:1000px;width:100%;';
    return (
      <view style='width:100%;height:100%;display:linear;'>
        <view
          style='width:50px;height:50px;background:blue;'
          bindtap={() => {
            this.setState({ show: true, top: true, showAnim: true });
            setTimeout(() => {
              this.setState({ showAnim: false });
            }, 250);
          }}
        >
        </view>

        <x-overlay-ng
          id='overlay-ng'
          custom-layout={true}
          mode='page'
          visible={show}
          style='overflow:visible;'
        >
          <view
            block-native-event={true}
            style='overflow:visible;background:#33333333;'
            className='ani'
            bindtap={() => {
              this.setState({ top: false, showAnim: true });
              setTimeout(() => {
                this.setState({ show: false, showAnim: false });
              }, 250);
            }}
          >
            <view
              id='dragcontainer'
              catchtap={() => {}}
              style={style}
              className={showAnim ? 'ani' : 'noani'}
            >
              <view style='width:100%;height:50px;background:gray;'>
                <scroll-view style='width:100%;height:100%;' scroll-x>
                  <text style='margin-left:50px;background:blue;'>
                    Hello Mfs
                  </text>

                  <text style='margin-left:50px;background:yellow;'>
                    Hello Mfs
                  </text>

                  <text style='margin-left:50px;background:gray;'>
                    Hello Mfs
                  </text>

                  <text style='margin-left:50px;background:green;'>
                    Hello Mfs
                  </text>

                  <text style='margin-left:50px;background:blue;'>
                    Hello Mfs
                  </text>

                  <text style='margin-left:50px;background:yellow;'>
                    Hello Mfs
                  </text>

                  <text style='margin-left:50px;background:green;'>
                    Hello Mfs
                  </text>
                </scroll-view>
              </view>
              <scroll-view
                id='aa'
                style='width:100%;height:100%;flex:1;'
                bounces={false}
                scroll-y
              >
                <text style='margin-top:50px;background:blue;'>Hello Mfs</text>

                <text style='margin-top:150px;background:yellow;'>
                  Hello Mfs
                </text>

                <scroll-view style='width:100%;height:60px;' scroll-x>
                  <text style='margin-left:50px;background:blue;'>
                    Hello Mfs
                  </text>

                  <text style='margin-left:50px;background:yellow;'>
                    Hello Mfs
                  </text>

                  <text style='margin-left:50px;background:gray;'>
                    Hello Mfs
                  </text>

                  <text style='margin-left:50px;background:green;'>
                    Hello Mfs
                  </text>

                  <text style='margin-left:50px;background:blue;'>
                    Hello Mfs
                  </text>

                  <text style='margin-left:50px;background:yellow;'>
                    Hello Mfs
                  </text>

                  <text style='margin-left:50px;background:green;'>
                    Hello Mfs
                  </text>
                </scroll-view>

                <text
                  style='margin-top:250px;background:gray;'
                  bindtap={() => {
                    console.log('wtf');
                    this.setState({
                      cnt: cnt + 1,
                    });
                  }}
                >
                  {cnt + ''}
                </text>

                <text style='margin-top:350px;background:green;'>
                  Hello Mfs
                </text>

                <text style='margin-top:450px;background:blue;'>Hello Mfs</text>

                <text style='margin-top:550px;background:yellow;'>
                  Hello Mfs
                </text>

                <text style='margin-top:650px;background:green;'>
                  Hello Mfs
                </text>
              </scroll-view>
            </view>
            <view />
            <view />
          </view>
        </x-overlay-ng>
      </view>
    );
  }
}

root.render(<App></App>);
