export function FakeMTC(customPropsName) {
    const [jsxs, transformedProps] = ReactLynx.pickJSXFromProps(customPropsName);
    transformedProps.__MTCProps = {
        componentTypeId: "$$mtc_2d408_test_1"
    };
    return createElement('mtc-container', {
        values: [
            transformedProps
        ]
    }, ReactLynx.renderFakeMTCSlot(jsxs));
}
