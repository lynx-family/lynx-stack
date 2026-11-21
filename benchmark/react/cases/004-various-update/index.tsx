// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { root, useEffect, useState } from '@lynx-js/react';
import {
  BackgroundSnapshotInstance,
  SnapshotInstance,
} from '@lynx-js/react/internal';
import type { CSSProperties, MainThread, NodesRef } from '@lynx-js/types';

import { hook, isMainThread } from '../../src/hook.js';

if (typeof Codspeed !== 'undefined' && __MAIN_THREAD__) {
  hook(
    SnapshotInstance.prototype,
    'setAttribute',
    function(this: SnapshotInstance, old, key, value) {
      if (!this.__elements) {
        // skip when there is no underlying FiberElement
        return old!.call(this, key, value);
      }

      let name = '';
      switch (key) {
        case 0:
          name = 'Attr';
          break;
        case 1:
          name = 'Dataset';
          break;
        case 2:
          name = 'Event';
          break;
        case 3:
          name = 'MT_Event';
          break;
        case 4:
          name = 'StyleString';
          break;
        case 5:
          name = 'StyleObject';
          break;
        case 6:
          name = 'Class';
          break;
        case 7:
          name = 'Id';
          break;
        case 8:
          name = 'Ref';
          break;
        case 9:
          name = 'TimingFlag';
          break;
        case 10:
          name = 'MT_Ref';
          break;
        case 11:
          name = 'ListItemPlatformInfo';
          break;
        case 12:
          name = 'ListItemPlatformInfoSpread';
          break;
        case 13:
          name = 'Spread';
          break;
        case 'values':
          name = 'BatchedValues';
          break;
      }

      if (!name) {
        // skip what we are not concerned
        return old!.call(this, key, value);
      }

      Codspeed.startBenchmark();
      const ret = old!.call(this, key, value);
      Codspeed.stopBenchmark();
      Codspeed.setExecutedBenchmark(
        `${__REPO_FILEPATH__}::${__webpack_chunkname__}-setAttribute__${name}`,
      );

      return ret;
    },
  );
}

if (typeof Codspeed !== 'undefined' && __BACKGROUND__) {
  hook(
    BackgroundSnapshotInstance.prototype,
    'setAttribute',
    function(this: BackgroundSnapshotInstance, old, key, value) {
      const values = value as unknown[];
      if (
        key === 'values' && values[values.length - 1] === 'stop-benchmark-true'
      ) {
        // we only care about the update that stops the benchmark

        Codspeed.startBenchmark();
        const ret = old!.call(this, key, value);
        Codspeed.stopBenchmark();
        Codspeed.setExecutedBenchmark(
          `${__REPO_FILEPATH__}::${__webpack_chunkname__}-setAttribute__BatchedValues`,
        );
        return ret;
      }

      return old!.call(this, key, value);
    },
  );
}

/**
 * How many update passes to drive before ending the run.
 *
 * Each pass commits one `setAttribute` per attribute kind, and every one of
 * those calls is a round of the corresponding benchmark. With a single pass the
 * `setAttribute__*` benchmarks were single samples of a ~2us operation, which
 * WallTime cannot resolve — they drifted in and out of CodSpeed's 5% threshold
 * on unrelated commits. The measured operation is unchanged; only the number of
 * rounds it is averaged over grows.
 */
const UPDATE_PASSES = 100;

function F() {
  const [pass, setPass] = useState(0);
  const [values, setValues] = useState(
    [
      'some-exposure-id' as string,
      'some-dataset' as string,
      () => {},
      () => {
        'main thread';
      },
      'width: 100rpx; height: 100rpx; background-color: #FACE00;' as string,
      {
        width: '100rpx',
        height: '100rpx',
        backgroundColor: '#FACE00',
      } as CSSProperties,
      'some-css-class' as string,
      'some-id' as string,
      (_e: NodesRef) => {},
      'some_lynx_timing_flag' as string,
      (_e: MainThread.Element) => {
        'main thread';
      },
      'some-item-key' as string,
    ] as const,
  );

  useEffect(() => {
    if (pass >= UPDATE_PASSES) {
      return;
    }
    // Every value differs from the previous pass, so each pass really does
    // reach `setAttribute` instead of being skipped as unchanged.
    setValues([
      `some-other-exposure-id-${pass}`,
      `some-other-dataset-${pass}`,
      () => {},
      () => {
        'main thread';
      },
      `width: ${200 + pass}rpx; height: 100rpx; background-color: #FACE00;`,
      {
        width: `${200 + pass}rpx`,
        height: '100rpx',
        backgroundColor: '#FACE00',
      },
      `some-other-css-class-${pass}`,
      `some-other-id-${pass}`,
      (_e: NodesRef) => {},
      `some_other_lynx_timing_flag_${pass}`,
      (_e: MainThread.Element) => {
        'main thread';
      },
      `some-other-item-key-${pass}`,
    ]);
    setPass(pass + 1);
  }, [pass]);

  if (isMainThread) {
    return null;
  }

  return (
    <view>
      <view exposure-id={values[0]} />
      <view data-xxx={values[1]} />
      <view bindtap={values[2]} />
      <view main-thread:bindtap={values[3]} />
      <view style={values[4]} />
      <view style={values[5]} />
      <view className={values[6]} />
      <view id={values[7]} />
      <view ref={values[8]} />
      <view __lynx_timing_flag={values[9]} />
      <view main-thread:ref={values[10]} />
      <list-item
        item-key={values[11]}
        full-span={false}
        estimated-main-axis-size-px={100}
        sticky-top={false}
        sticky-bottom={false}
        recyclable={false}
      />
      <list-item
        {
          ...({
            'item-key': values[11],
            'full-span': false,
            'estimated-main-axis-size-px': 100,
            'sticky-top': false,
            'sticky-bottom': false,
            'recyclable': false,
          }) /* 12 */
        }
      />
      <view
        {
          ...(
            {
              'exposure-id': values[0],
              'data-xxx': values[1],
              'bindtap': values[2],
              'main-thread:bindtap': values[3],
              // 'style': values[4],
              'style': values[5],
              'className': values[6],
              'id': values[7],
              'ref': values[8],
              '__lynx_timing_flag': values[9],
              'main-thread:ref': values[10],
            }
          ) /* 13 */
        }
      />

      <view id={`stop-benchmark-${pass >= UPDATE_PASSES}`} />
    </view>
  );
}

runAfterLoadScript(() => {
  root.render(
    <F />,
  );
});
