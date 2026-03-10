import { workletCapture as __workletCapture } from "@lynx-js/react";
var workletCapture = __workletCapture;
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
        bbbb: {
            cccc: {
                dddd: this.bbbb.cccc.dddd
            }
        },
        eeee: this.eeee,
        ffff: this.ffff,
        hhhh: {
            'iiii': this.hhhh['iiii'],
            kkkk: this.hhhh.kkkk
        },
        llll: this.llll,
        mmmm: {
            nnnn: {
                'oooo': this.mmmm.nnnn['oooo']
            }
        }
    }
};
