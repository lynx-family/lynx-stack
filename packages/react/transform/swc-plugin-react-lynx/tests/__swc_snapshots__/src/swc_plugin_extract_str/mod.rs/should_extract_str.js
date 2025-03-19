var _EXTRACT_STR = [
    "123",
    "456",
    "789",
    "!@#@#$!!@#!#!3sasdega!!23!#$!@#%%",
    "000"
];
const qq = {
    a: _EXTRACT_STR[0],
    b: false ? _EXTRACT_STR[1] : _EXTRACT_STR[2]
};
console.log(_EXTRACT_STR[3]);
globalThis.abc = ()=>{
    return {
        _EXTRACT_STR: _EXTRACT_STR
    };
};
console.log(_EXTRACT_STR[0]);
let q = fun(_EXTRACT_STR[1]);
let a = _EXTRACT_STR[2];
const b = _EXTRACT_STR[0] + _EXTRACT_STR[4];
