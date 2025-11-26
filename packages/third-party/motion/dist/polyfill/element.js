export class ElementCompt {
    element;
    constructor(element) {
        this.element = element;
    }
    getComputedStyle() {
        const styleObject = {};
        return new Proxy(styleObject, {
            get: (_target, prop) => {
                // @ts-expect-error Expected
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                return __GetComputedStyleByKey(this.element.element, prop);
            },
        });
    }
    get style() {
        const styleObject = {};
        styleObject.setProperty = (property, value) => {
            this.element.setStyleProperty(property, value);
        };
        return new Proxy(styleObject, {
            set: (target, prop, value) => {
                if (typeof prop === 'string' && prop !== 'setProperty') {
                    this.element.setStyleProperty(prop, String(value));
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    target[prop] = value;
                }
                return true;
            },
            get: (_target, prop) => {
                if (typeof prop === 'string' && prop !== 'setProperty') {
                    return this.getStyleProperty(prop);
                }
                return undefined;
            },
        });
    }
    set style(styles) {
        this.element.setStyleProperties(styles);
    }
    // Individual style property getters and setters
    getStyleProperty(name) {
        // @ts-expect-error Expected
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return __GetComputedStyleByKey(this.element.element, name);
    }
    // Common style properties
    get backgroundColor() {
        return this.getStyleProperty('backgroundColor');
    }
    set backgroundColor(value) {
        this.element.setStyleProperty('backgroundColor', value);
    }
    get color() {
        return this.getStyleProperty('color');
    }
    set color(value) {
        this.element.setStyleProperty('color', value);
    }
    get fontSize() {
        return this.getStyleProperty('fontSize');
    }
    set fontSize(value) {
        this.element.setStyleProperty('fontSize', value);
    }
    get width() {
        return this.getStyleProperty('width');
    }
    set width(value) {
        this.element.setStyleProperty('width', value);
    }
    get height() {
        return this.getStyleProperty('height');
    }
    set height(value) {
        this.element.setStyleProperty('height', value);
    }
    get margin() {
        return this.getStyleProperty('margin');
    }
    set margin(value) {
        this.element.setStyleProperty('margin', value);
    }
    get padding() {
        return this.getStyleProperty('padding');
    }
    set padding(value) {
        this.element.setStyleProperty('padding', value);
    }
    get display() {
        return this.getStyleProperty('display');
    }
    set display(value) {
        this.element.setStyleProperty('display', value);
    }
    get position() {
        return this.getStyleProperty('position');
    }
    set position(value) {
        this.element.setStyleProperty('position', value);
    }
    get top() {
        return this.getStyleProperty('top');
    }
    set top(value) {
        this.element.setStyleProperty('top', value);
    }
    get left() {
        return this.getStyleProperty('left');
    }
    set left(value) {
        this.element.setStyleProperty('left', value);
    }
    get right() {
        return this.getStyleProperty('right');
    }
    set right(value) {
        this.element.setStyleProperty('right', value);
    }
    get bottom() {
        return this.getStyleProperty('bottom');
    }
    set bottom(value) {
        this.element.setStyleProperty('bottom', value);
    }
}
//# sourceMappingURL=element.js.map