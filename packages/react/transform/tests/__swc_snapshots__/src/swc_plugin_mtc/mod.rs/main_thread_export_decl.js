"main thread";
export function RealMTC(props) {
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
function $$mtc_RealMTC(props) {
    return <view>
      {ReactLynx.renderMTCSlot(props.p3)}
    </view>;
}
ReactLynx.registerMTC("$$mtc_2d408_test_1", $$mtc_RealMTC);
