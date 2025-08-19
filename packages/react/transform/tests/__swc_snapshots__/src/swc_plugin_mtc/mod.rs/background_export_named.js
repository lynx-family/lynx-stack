function FakeMTC(props) {
    const [jsxs, transformedProps] = require('@lynx-js/react/internal').pickJSXfromProps(props);
    return <mtc-container _p={transformedProps} _mtcId="$$mtc_2d408_test_1">{require('@lynx-js/react/internal').renderFakeMTCSlot(jsxs)}</mtc-container>;
}
function FakeMTC2(props) {
    const [jsxs, transformedProps] = require('@lynx-js/react/internal').pickJSXfromProps(props);
    return <mtc-container _p={transformedProps} _mtcId="$$mtc_2d408_test_2">{require('@lynx-js/react/internal').renderFakeMTCSlot(jsxs)}</mtc-container>;
}
export { FakeMTC, FakeMTC2 };
