let c = 1;
class A extends Component {
    render() {
        return <view/>;
    }
    state = ((()=>{
        if (__LEPUS__) {
            xxx();
        }
        if (__LE_P_US__) {
            xxx();
        }
        if (!__LE_P_US__) {
            xxx();
        }
    })(), {
        c
    });
}
