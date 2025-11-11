"main thread";
export function FakeMTC(props) {
    const componentInstanceId = ReactLynx.useMemo(ReactLynx.genMTCInstanceId, []);
    const [jsxs, transformedProps] = ReactLynx.pickJSXFromProps(props);
    transformedProps.__MTCProps = {
        componentTypeId: "$$mtc_2d408_test_1",
        componentInstanceId
    };
    return ReactLynx.createElementLepus('mtc-container', {
        values: [
            transformedProps
        ]
    }, ReactLynx.renderFakeMTCSlot(jsxs));
}
ReactLynx.loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
function $$mtc_FakeMTC({ p3, children }) {
    return <view>
      <view>123 + {ReactLynx.renderMTCSlot(p3)}</view>
      {ReactLynx.renderMTCSlot(children)}
    </view>;
}
ReactLynx.registerMTC("$$mtc_2d408_test_1", $$mtc_FakeMTC);
