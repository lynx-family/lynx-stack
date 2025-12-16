import { isMainThreadElement, isMainThreadElementArray, } from './isMainThreadElement.js';
import { ElementCompt } from '../polyfill/element.js' with { runtime: 'shared' };
export function elementOrSelector2Dom(nodesOrSelector) {
    'main thread';
    let domElements = undefined;
    if (typeof nodesOrSelector === 'string'
        || isMainThreadElement(nodesOrSelector)
        || isMainThreadElementArray(nodesOrSelector)) {
        let elementNodes;
        if (typeof nodesOrSelector === 'string') {
            elementNodes = lynx.querySelectorAll(nodesOrSelector);
        }
        else {
            elementNodes = nodesOrSelector;
        }
        domElements = (Array.isArray(elementNodes)
            ? elementNodes.map(el => new ElementCompt(el))
            : new ElementCompt(elementNodes));
    }
    return domElements;
}
//# sourceMappingURL=elementHelper.js.map