export class A extends Component {
    a = 1;
    state = ((()=>{
        this.a;
    })(), {
        a: 1
    });
    render() {
        return <></>;
    }
}
