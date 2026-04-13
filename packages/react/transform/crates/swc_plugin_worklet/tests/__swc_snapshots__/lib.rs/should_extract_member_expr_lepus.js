import "@lynx-js/react/worklet-runtime/init?owner=a123-test";
let onTapLepus = {
    _c: {
        aaaa: {
            bbbb: aaaa.bbbb
        },
        cccc: {
            dddd: cccc.dddd
        },
        hhhh: {
            iiii: hhhh.iiii
        },
        llll,
        oooo: {
            pppp: oooo.pppp,
            qqqq: oooo.qqqq
        },
        rrrr,
        uuuu: {
            "__??__": uuuu["__??__"]
        }
    },
    _wkltId: "a123:test:1"
};
registerWorkletInternal("main-thread", "a123:test:1", function() {
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
