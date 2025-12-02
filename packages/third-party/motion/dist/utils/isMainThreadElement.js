export function isMainThreadElement(ele) {
    'main thread';
    // @ts-expect-error error
    // biome-ignore lint/complexity/useOptionalChain: <explanation>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (ele && ele.element && ele.element.elementRefptr) {
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