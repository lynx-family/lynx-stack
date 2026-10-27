import { registerWorklet as __registerWorklet } from "@lynx-js/react/worklet-runtime/init";
import { captureMainThreadObject as __captureMainThreadObject } from "@lynx-js/react";
var captureMainThreadObject = __captureMainThreadObject;
let onTapLepus = {
    _c: {
        aaaa: aaaa == null ? aaaa : captureMainThreadObject(aaaa) ?? {
            bbbb: aaaa.bbbb
        },
        cccc: cccc == null ? cccc : captureMainThreadObject(cccc) ?? {
            dddd: cccc.dddd
        },
        hhhh: hhhh == null ? hhhh : captureMainThreadObject(hhhh) ?? {
            iiii: hhhh.iiii
        },
        llll,
        oooo: oooo == null ? oooo : captureMainThreadObject(oooo) ?? {
            pppp: oooo.pppp,
            qqqq: oooo.qqqq
        },
        rrrr,
        uuuu: uuuu == null ? uuuu : captureMainThreadObject(uuuu) ?? {
            "__??__": uuuu["__??__"]
        },
        enabled,
        handlers: handlers == null ? handlers : captureMainThreadObject(handlers) ?? {
            start: handlers.start
        },
        vvvv: vvvv == null ? vvvv : captureMainThreadObject(vvvv) ?? {
            wwww: ((__mainThreadObjectSource)=>__mainThreadObjectSource == null ? __mainThreadObjectSource : captureMainThreadObject(__mainThreadObjectSource) ?? {
                    xxxx: __mainThreadObjectSource.xxxx
                })(vvvv.wwww)
        }
    },
    _wkltId: "a123:test:1"
};
__registerWorklet("main-thread", "a123:test:1", function() {
    const onTapLepus = lynxWorkletImpl._workletMap["a123:test:1"].bind(this);
    let { aaaa, cccc, hhhh, llll, oooo, rrrr, uuuu, enabled, handlers, vvvv } = this["_c"];
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
    if (enabled && handlers?.start) handlers.start();
    vvvv?.wwww?.xxxx;
});
