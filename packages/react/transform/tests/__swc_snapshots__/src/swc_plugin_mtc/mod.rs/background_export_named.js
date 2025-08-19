function RealMTC(props) {
    const [jsxs, transformedProps] = require('@lynx-js/react/internal').pickJSXfromProps(props);
    return <mtc-container _p={transformedProps}>{jsxs.map((jsx)=><mtc-slot>{jsx}</mtc-slot>)}</mtc-container>;
}
export { RealMTC };
