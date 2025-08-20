export function FakeMTC(customPropsName) {
    const [jsxs, transformedProps] = ReactLynx.pickJSXfromProps(customPropsName);
    return <mtc-container _p={transformedProps} _mtcId="$$mtc_2d408_test_1">{ReactLynx.renderFakeMTCSlot(jsxs)}</mtc-container>;
}
