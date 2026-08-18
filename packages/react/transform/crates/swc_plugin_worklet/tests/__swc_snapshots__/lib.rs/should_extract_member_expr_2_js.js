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
                cccc: {
                    dddd: __mainThreadObjectSource.cccc.dddd
                }
            })(this.bbbb),
        eeee: this.eeee,
        ffff: this.ffff,
        hhhh: ((__mainThreadObjectSource)=>captureMainThreadObject(__mainThreadObjectSource) ?? {
                'iiii': __mainThreadObjectSource['iiii'],
                kkkk: __mainThreadObjectSource.kkkk
            })(this.hhhh),
        llll: this.llll,
        mmmm: ((__mainThreadObjectSource)=>captureMainThreadObject(__mainThreadObjectSource) ?? {
                nnnn: {
                    'oooo': __mainThreadObjectSource.nnnn['oooo']
                }
            })(this.mmmm)
    }
};
