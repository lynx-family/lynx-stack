export function FakeMTC() {
    const [jsxs, transformedProps] = ReactLynx.pickJSXfromProps(props);
    return <mtc-container _p={transformedProps} _mtcId="$$mtc_2d408_test_1">{ReactLynx.renderFakeMTCSlot(jsxs)}</mtc-container>;
}
