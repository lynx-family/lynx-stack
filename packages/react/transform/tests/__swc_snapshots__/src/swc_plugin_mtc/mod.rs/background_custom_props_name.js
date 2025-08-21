export function FakeMTC(customPropsName) {
    const componentInstanceId = ReactLynx.useMemo(ReactLynx.genMTCInstanceId, []);
    const [jsxs, transformedProps] = ReactLynx.pickJSXFromProps(customPropsName);
    transformedProps.__MTCProps = {
        componentTypeId: "$$mtc_2d408_test_1",
        componentInstanceId
    };
    return ReactLynx._jsx('mtc-container', {
        values: [
            transformedProps
        ]
    }, ReactLynx.renderFakeMTCSlot(jsxs));
}
