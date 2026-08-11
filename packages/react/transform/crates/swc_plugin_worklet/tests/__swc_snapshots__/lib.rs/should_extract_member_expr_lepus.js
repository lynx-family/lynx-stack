import { captureMainThreadObject as __captureMainThreadObject, loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var captureMainThreadObject = __captureMainThreadObject, loadWorkletRuntime = __loadWorkletRuntime;
let onTapLepus = {
    _c: {
        aaaa: captureMainThreadObject(aaaa, {
            bbbb: aaaa.bbbb
        }),
        cccc: captureMainThreadObject(cccc, {
            dddd: cccc.dddd
        }),
        hhhh: captureMainThreadObject(hhhh, {
            iiii: hhhh.iiii
        }),
        llll,
        oooo: captureMainThreadObject(oooo, {
            pppp: oooo.pppp,
            qqqq: oooo.qqqq
        }),
        rrrr,
        uuuu: captureMainThreadObject(uuuu, {
            "__??__": uuuu["__??__"]
        })
    },
    _wkltId: "a123:test:1"
};
const __workletRuntimeLoaded = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
__workletRuntimeLoaded && registerWorkletInternal("main-thread", "a123:test:1", function() {
    const onTapLepus = lynxWorkletImpl._workletMap["a123:test:1"].bind(this);
    let { aaaa, cccc, hhhh, llll, oooo, rrrr, uuuu } = this["_c"];
    "main thread";
    aaaa.bbbb[cccc.dddd].eeee;
    aaaa.bbbb[cccc.dddd].eeee;
    aaaa.bbbb[cccc.dddd].eeee;
    hhhh.iiii.current.jjjj;
    hhhh.iiii.current.jjjj;
    llll.mmmm.nnnn;
    llll.mmmm;
    llll;
    oooo.pppp.qqqq;
    oooo.pppp;
    oooo.qqqq;
    rrrr;
    rrrr.ssss;
    rrrr.ssss.tttt;
    uuuu["__??__"];
});
