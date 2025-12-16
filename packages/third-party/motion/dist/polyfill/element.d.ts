import type { MainThread } from '@lynx-js/types';
interface StyleObject {
    [key: string]: string | ((property: string, value: string) => void);
    setProperty(property: string, value: string): void;
}
export declare class ElementCompt {
    private element;
    constructor(element: MainThread.Element);
    getComputedStyle(): Record<string, string>;
    get style(): StyleObject;
    set style(styles: Record<string, string>);
    private getStyleProperty;
    get backgroundColor(): string;
    set backgroundColor(value: string);
    get color(): string;
    set color(value: string);
    get fontSize(): string;
    set fontSize(value: string);
    get width(): string;
    set width(value: string);
    get height(): string;
    set height(value: string);
    get margin(): string;
    set margin(value: string);
    get padding(): string;
    set padding(value: string);
    get display(): string;
    set display(value: string);
    get position(): string;
    set position(value: string);
    get top(): string;
    set top(value: string);
    get left(): string;
    set left(value: string);
    get right(): string;
    set right(value: string);
    get bottom(): string;
    set bottom(value: string);
    getBoundingClientRect(): {
        left: number;
        top: number;
        right: number;
        bottom: number;
        width: number;
        height: number;
        x: number;
        y: number;
    };
}
export {};
