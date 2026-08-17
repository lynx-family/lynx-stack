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
        bbbb: captureMainThreadObject(this.bbbb) ?? {
            cccc: {
                dddd: this.bbbb.cccc.dddd
            }
        },
        eeee: this.eeee,
        ffff: this.ffff,
        hhhh: captureMainThreadObject(this.hhhh) ?? {
            'iiii': this.hhhh['iiii'],
            kkkk: this.hhhh.kkkk
        },
        llll: this.llll,
        mmmm: captureMainThreadObject(this.mmmm) ?? {
            nnnn: {
                'oooo': this.mmmm.nnnn['oooo']
            }
        }
    }
};
