export class A extends Component {
    c = 2;
    renderA() {
        this.c = 1;
        this.renderB();
    }
    renderB() {}
    render() {
        this.renderA();
        return <></>;
    }
}
