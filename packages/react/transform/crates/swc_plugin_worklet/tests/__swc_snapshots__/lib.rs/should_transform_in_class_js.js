class App extends Component {
    a = 1;
    get onTapLepus() {
        return {
            _wkltId: "a77b:test:1",
            ...{
                a: this.a
            }
        };
    }
}
