import "@lynx-js/react/worklet-runtime/init";
let a = 1;
class App extends Component {
    onTapLepus = {
        _c: {
            a
        },
        _wkltId: "a77b:test:1",
        ...{
            a: this.a
        }
    };
}
registerWorkletInternal("main-thread", "a77b:test:1", function(event) {
    let { a } = this["_c"];
    "main thread";
    console.log(a);
    console.log(this.a);
});
