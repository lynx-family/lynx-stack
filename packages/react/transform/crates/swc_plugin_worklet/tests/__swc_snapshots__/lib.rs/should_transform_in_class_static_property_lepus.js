import "@lynx-js/react/worklet-runtime/init?owner=a77b-test";
let a = 1;
class App extends Component {
    static onTapLepus = {
        _c: {
            a
        },
        _wkltId: "a77b:test:1"
    };
}
registerWorkletInternal("main-thread", "a77b:test:1", function(event) {
    let { a } = this["_c"];
    "main thread";
    console.log(a);
});
