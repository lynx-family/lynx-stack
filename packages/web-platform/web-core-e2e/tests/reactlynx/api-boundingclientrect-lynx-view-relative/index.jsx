// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Component, root } from '@lynx-js/react';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = { match: false };
  }

  componentDidMount() {
    // Delay so the test has time to apply the lynx-view offset before the
    // SelectorQuery fires.
    setTimeout(() => {
      lynx.createSelectorQuery()
        .select('#measured')
        .invoke({
          method: 'boundingClientRect',
          success: (res) => {
            if (
              res.left === 50 && res.top === 50
              && res.right === 150 && res.bottom === 150
              && res.width === 100 && res.height === 100
            ) {
              this.setState({ match: true });
            }
          },
        })
        .exec();
    }, 500);
  }

  render() {
    return (
      <view style={{ display: 'flex', flexDirection: 'column' }}>
        <view
          id='measured'
          style={{
            width: '100px',
            height: '100px',
            margin: '50px',
            backgroundColor: 'blue',
          }}
        />
        <view
          id='target'
          style={{
            width: '100px',
            height: '100px',
            backgroundColor: this.state.match ? 'green' : 'pink',
          }}
        />
      </view>
    );
  }
}

root.render(
  <page>
    <App></App>
  </page>,
);
