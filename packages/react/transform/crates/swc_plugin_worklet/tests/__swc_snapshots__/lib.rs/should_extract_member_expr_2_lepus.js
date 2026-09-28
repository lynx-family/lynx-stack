import { captureMainThreadObject as __captureMainThreadObject, loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var captureMainThreadObject = __captureMainThreadObject, loadWorkletRuntime = __loadWorkletRuntime;
let onTapLepus = {
    _c: {
        aaaa,
        bbbb,
        eeee,
        ffff
    },
    _wkltId: "a123:test:1",
    ...{
        aaaa: this.aaaa,
        bbbb: ((__mainThreadObjectSource)=>captureMainThreadObject(__mainThreadObjectSource) ?? {
                cccc: ((__mainThreadObjectSource)=>captureMainThreadObject(__mainThreadObjectSource) ?? {
                        dddd: __mainThreadObjectSource.dddd
                    })(__mainThreadObjectSource.cccc)
            })(this.bbbb),
        eeee: this.eeee,
        ffff: this.ffff,
        hhhh: ((__mainThreadObjectSource)=>captureMainThreadObject(__mainThreadObjectSource) ?? {
                'iiii': __mainThreadObjectSource['iiii'],
                kkkk: __mainThreadObjectSource.kkkk
            })(this.hhhh),
        llll: this.llll,
        mmmm: ((__mainThreadObjectSource)=>captureMainThreadObject(__mainThreadObjectSource) ?? {
                nnnn: ((__mainThreadObjectSource)=>captureMainThreadObject(__mainThreadObjectSource) ?? {
                        'oooo': __mainThreadObjectSource['oooo']
                    })(__mainThreadObjectSource.nnnn)
            })(this.mmmm)
    }
};
const __workletRuntimeLoaded = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
__workletRuntimeLoaded && registerWorkletInternal("main-thread", "a123:test:1", function() {
    const onTapLepus = lynxWorkletImpl._workletMap["a123:test:1"].bind(this);
    let { aaaa, bbbb, eeee, ffff } = this["_c"];
    "main thread";
    this.aaaa;
    this.aaaa;
    this.bbbb.cccc.dddd;
    this.bbbb.cccc.dddd;
    this.eeee.ffff.gggg;
    this.eeee;
    this.ffff;
    this.eeee.ffff.gggg;
    this.hhhh.iiii.jjjj;
    this.hhhh['iiii'];
    this.hhhh.kkkk;
    this.hhhh.iiii.jjjj;
    this.llll[this.mmmm.nnnn['oooo']];
    aaaa;
    bbbb;
    eeee;
    ffff;
});
