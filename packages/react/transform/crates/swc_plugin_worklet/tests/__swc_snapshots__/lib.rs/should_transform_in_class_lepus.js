import "@lynx-js/react/worklet-runtime/init";
class App extends Component {
    a = 1;
    onTapLepus = {
        _wkltId: "a77b:test:1",
        ...{
            a: this.a
        }
    };
}
registerWorkletInternal("main-thread", "a77b:test:1", function(event) {
    this["onTapLepus"] = lynxWorkletImpl._workletMap["a77b:test:1"].bind(this);
    "main thread";
    console.log(this.a);
});
