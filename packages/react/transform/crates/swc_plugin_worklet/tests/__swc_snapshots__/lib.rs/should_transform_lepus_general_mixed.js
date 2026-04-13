import "@lynx-js/react/worklet-runtime/init?owner=a77b-test";
let worklet = {
    _c: {
        y1
    },
    _wkltId: "a77b:test:1",
    ...{
        y1: this.y1
    }
};
registerWorkletInternal("main-thread", "a77b:test:1", function(event: Event) {
    const worklet = lynxWorkletImpl._workletMap["a77b:test:1"].bind(this);
    let { y1 } = this["_c"];
    "main thread";
    console.log(y1);
    console.log(this.y1);
    let a: object = y1;
});
