export class A extends Component {
    constructor(props){
        super(props);
        this.c = "cc";
        this["d"] = "dd";
    }
    c = "c";
    d = "d";
    render() {
        return <></>;
    }
}
