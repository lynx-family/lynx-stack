import { Component } from "@lynx-js/react-runtime";
export class A extends Component {
    renderA() {}
    renderC = ()=>{};
    getSrc() {}
    render() {
        this.renderA();
        this.renderC();
        return <image src={this.getSrc()}></image>;
    }
}
