let a = 1;
class App extends Component {
    get onTapLepus() {
        return {
            _c: {
                a
            },
            _wkltId: "a77b:test:1",
            ...{
                a: this.a
            }
        };
    }
}
