export function isMainThreadElement(ele) {
    'main thread';
    // @ts-expect-error error
    if (ele && 'element' in ele) {
        return true;
    }
    else {
        return false;
    }
}
export function isMainThreadElementArray(eleArr) {
    'main thread';
    return Array.isArray(eleArr) && eleArr.every(ele => isMainThreadElement(ele));
}
//# sourceMappingURL=isMainThreadElement.js.map