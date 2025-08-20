export function FakeMTC(customPropsName) {
    const [jsxs, transformedProps] = ReactLynx.pickJSXFromProps(customPropsName);
    return <mtc-container _p={transformedProps} _mtcId="$$mtc_2d408_test_1">{ReactLynx.renderFakeMTCSlot(jsxs)}</mtc-container>;
}
