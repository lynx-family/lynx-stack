let a = 1;
class App extends Component {
    get x() {
        "main thread";
        return a;
    }
}
class Bpp extends Component {
    set x(n) {
        "main thread";
        this.a = n;
    }
}
