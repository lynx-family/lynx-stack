function f() {
    registerWorklet("57ba11b1", function(event) {
        const elementOnTextLayout = lynxWorkletImpl._workletMap["57ba11b1"].bind(this);
        let { _jsFn1 } = this._jsFn;
        "main thread";
        runOnBackground(_jsFn1)(true);
    });
    registerWorklet("57ba11b2", function(event) {
        const elementOnTextLayout2 = lynxWorkletImpl._workletMap["57ba11b2"].bind(this);
        let { _jsFn1 } = this._jsFn;
        "main thread";
        runOnBackground(_jsFn1)(true);
    });
}
