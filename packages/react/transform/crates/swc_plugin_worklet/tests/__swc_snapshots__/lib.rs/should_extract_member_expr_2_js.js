import { captureMainThreadObject as __captureMainThreadObject } from "@lynx-js/react";
var captureMainThreadObject = __captureMainThreadObject;
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
