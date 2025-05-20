import * as ReactLynx from "@lynx-js/react";
const __snapshot_da39a_test_1 = ReactLynx.createSnapshot("__snapshot_da39a_test_1", function() {
    const pageId = ReactLynx.__pageId;
    const el = __CreateView(pageId);
    const el1 = __CreateView(pageId);
    __SetClasses(el1, "123 456");
    __AppendElement(el, el1);
    const el2 = __CreateView(pageId);
    __SetClasses(el2, "123 456");
    __AppendElement(el, el2);
    const el3 = __CreateView(pageId);
    __SetClasses(el3, "123  456");
    __AppendElement(el, el3);
    const el4 = __CreateView(pageId);
    __SetClasses(el4, "123\\n456");
    __AppendElement(el, el4);
    const el5 = __CreateView(pageId);
    __SetClasses(el5, "123 456");
    __AppendElement(el, el5);
    const el6 = __CreateView(pageId);
    __SetClasses(el6, "123  456");
    __AppendElement(el, el6);
    const el7 = __CreateView(pageId);
    __SetClasses(el7, "123\\t456");
    __AppendElement(el, el7);
    const el8 = __CreateElement("svg", pageId);
    __SetAttribute(el8, "content", '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"> <path d="M14.3723 11.9999L7.53902 5.16659C7.34376 4.97133 7.34376 4.65475 7.53902 4.45948L8.45826 3.54025C8.65353 3.34498 8.97011 3.34498 9.16537 3.54025L17.2714 11.6463C17.4667 11.8416 17.4667 12.1582 17.2714 12.3534L9.16537 20.4595C8.97011 20.6547 8.65353 20.6547 8.45826 20.4595L7.53902 19.5402C7.34376 19.345 7.34376 19.0284 7.53903 18.8331L14.3723 11.9999Z" fill="white"/> </svg>');
    __SetInlineStyles(el8, "width:24rpx;height:24rpx;opacity:0.4");
    __SetID(el8, "x y");
    __AddDataset(el8, "attr", "x y");
    __AppendElement(el, el8);
    return [
        el,
        el1,
        el2,
        el3,
        el4,
        el5,
        el6,
        el7,
        el8
    ];
}, [
    function(ctx) {
        if (ctx.__elements) {
            __SetAttribute(ctx.__elements[8], '__lynx_timing_flag', ctx.__values[0].__ltf);
        }
    }
], null, undefined, globDynamicComponentEntry);
<__snapshot_da39a_test_1 values={[
    {
        __ltf: " aaaaa "
    }
]}/>;
