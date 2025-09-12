let c = 1;
class A extends Component {
    render() {
        return <view/>;
    }
    state = {
        ...lynx.__initData,
        ...__REACTLYNX3__ ? lynx.__initData : {},
        ...a,
        c
    };
}
