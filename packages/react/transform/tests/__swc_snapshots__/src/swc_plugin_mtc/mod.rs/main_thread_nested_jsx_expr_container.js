"main thread";
function $$mtc_FakeMTC({ p3, children }) {
    return <view>
      <view>123 + {ReactLynx.renderMTCSlot(p3)}</view>
      {ReactLynx.renderMTCSlot(children)}
    </view>;
}
export const FakeMTC = /*#__PURE__*/ ReactLynx.registerMTC("$$mtc_2d408_test_1", $$mtc_FakeMTC);
