export function FakeMTC() {
    const componentInstanceId = ReactLynx.useMemo(ReactLynx.genMTCInstanceId, []);
    const [jsxs, transformedProps] = ReactLynx.pickJSXFromProps(props);
    transformedProps.__MTCProps = {
        componentTypeId: "$$mtc_2d408_test_1",
        componentInstanceId
    };
    return createElement('mtc-container', {
        values: [
            transformedProps
        ]
    }, ReactLynx.renderFakeMTCSlot(jsxs));
}
