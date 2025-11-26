export declare function registerCallable(func: CallableFunction, id: string): string;
export declare function runOnRegistered<T extends CallableFunction = CallableFunction>(id: string): T;
declare global {
    var runOnRegistered: <T extends CallableFunction = CallableFunction>(id: string) => T;
}
