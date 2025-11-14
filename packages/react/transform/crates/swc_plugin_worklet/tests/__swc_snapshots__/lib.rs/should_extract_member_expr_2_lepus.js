import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
var loadWorkletRuntime = __loadWorkletRuntime;
let onTapLepus = {
    _c: {
        aaaa,
        bbbb,
        eeee,
        ffff
    },
    _wkltId: "a123:test:1"
};
loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "a123:test:1", function() {
    const onTapLepus = lynxWorkletImpl._workletMap["a123:test:1"].bind(this);
    let { __aaaa = aaaa, __bbbb = bbbb, __eeee = eeee, __ffff = ffff } = this["_c"];
    {
        let aaaa = __aaaa;
        let bbbb = __bbbb;
        let eeee = __eeee;
        let ffff = __ffff;
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
    }
});
