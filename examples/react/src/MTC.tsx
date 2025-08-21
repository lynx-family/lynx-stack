import { createElement } from '@lynx-js/react';
import {
  pickJSXFromProps,
  registerMTC,
  renderFakeMTCSlot,
  renderMTCSlot,
} from '@lynx-js/react/internal';
import { MainThread } from '@lynx-js/types';

const componentInstanceId = 1;

let MTC;

if (__MAIN_THREAD__) {
  function $$mtc_RealMTC(props) {
    return (
      <view>
        <text
          bindtap={(e: MainThread.TouchEvent) => {
            console.log('click');
            e.currentTarget.setStyleProperties({
              'background-color': 'red',
            });
          }}
        >
          MTC
        </text>
        {renderMTCSlot(props.btc1)}
        {renderMTCSlot(props.btc2)}
      </view>
    );
  }

  MTC = /*#__PURE__*/ registerMTC(
    '$$mtc_2d408_test_1',
    $$mtc_RealMTC,
  );
} else {
  MTC = (customPropsName) => {
    const [jsxs, transformedProps] = pickJSXFromProps(customPropsName);
    transformedProps.__MTCProps = {
      componentInstanceId,
      componentTypeId: '$$mtc_2d408_test_1',
    };
    return (
      createElement('mtc-container', {
        values: [transformedProps],
      }, renderFakeMTCSlot(jsxs))
    );
  };
}

export { MTC };
