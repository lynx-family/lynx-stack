export class A extends Component {
    a = "should keep";
    render() {
        class foo extends bar {
            render() {
                return <></>;
            }
        }
        return new foo(this.a).render();
    }
}
