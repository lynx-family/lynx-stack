// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type WASMModule = typeof import('./standard.js');
export declare let wasm: WASMModule;
export declare function initWasm(): Promise<void>;

// Main API functions
export declare function prepareMainThreadAPIs(config: any): any;
export declare function createMainThreadGlobalThis(config: any): any;
export declare function createMainThreadLynx(config: any, systemInfo: any): any;

// Pure element APIs
export declare const __AppendElement: (parent: Element, child: Element) => void;
export declare const __ElementIsEqual: (left: Element, right: Element) => boolean;
export declare const __FirstElement: (element: Element) => Element | null;
export declare const __GetChildren: (element: Element) => Element[] | null;
export declare const __GetParent: (element: Element) => Element | null;
export declare const __InsertElementBefore: (parent: Element, child: Element, ref?: Element | null) => void;
export declare const __LastElement: (element: Element) => Element | null;
export declare const __NextElement: (element: Element) => Element | null;
export declare const __RemoveElement: (parent: Element, child: Element) => void;
export declare const __ReplaceElement: (newElement: Element, oldElement: Element) => void;
export declare const __ReplaceElements: (parent: Element, newChildren: Element | Element[], oldChildren?: Element | Element[] | null) => void;

// Attribute and property APIs
export declare const __GetComponentID: (element: Element) => string | null;
export declare const __GetElementUniqueID: (element: Element) => number;
export declare const __GetID: (element: Element) => string | null;
export declare const __SetID: (element: Element, id?: string | null) => void;
export declare const __GetTag: (element: Element) => string | null;
export declare const __GetClasses: (element: Element) => string[];
export declare const __SetClasses: (element: Element, className?: string | null) => void;
export declare const __AddClass: (element: Element, className: string) => void;
export declare const __AddInlineStyle: (element: HTMLElement, key: string, value?: string | number | null) => void;
export declare const __SetInlineStyles: (element: HTMLElement, styles?: string | Record<string, any> | null) => void;
export declare const __GetDataset: (element: Element) => Record<string, any>;
export declare const __SetDataset: (element: Element, dataset: Record<string, any>) => void;
export declare const __AddDataset: (element: Element, key: string, value: any) => void;
export declare const __GetDataByKey: (element: Element, key: string) => any;
export declare const __GetAttributes: (element: Element) => Record<string, string>;
export declare const __GetElementConfig: (element: Element) => Record<string, any>;
export declare const __SetConfig: (element: Element, config: Record<string, any>) => void;
export declare const __AddConfig: (element: Element, type: string, value: any) => void;
export declare const __GetAttributeByName: (element: Element, name: string) => string | null;
export declare const __UpdateComponentID: (element: Element, componentId: string) => void;
export declare const __SetCSSId: (elements: Element[], cssId: number) => void;
export declare const __UpdateComponentInfo: (element: Element, params: any) => void;

// Template APIs
export declare const __GetTemplateParts: (templateElement: Element) => Record<string, Element>;
export declare const __MarkTemplateElement: (element: Element) => void;
export declare const __MarkPartElement: (element: Element, partId: string) => void;

// Utility functions
export declare function createCrossThreadEvent(event: Event, eventName: string): any;
export declare function createExposureService(rootDom: EventTarget, postExposure: Function): any;
export declare function decodeCssOG(classes: string, styleInfo: any, cssId?: string | null): string;

// Style processing functions
export declare function flattenStyleInfo(styleInfo: any, enableCssSelector: boolean): void;
export declare function transformToWebCss(styleInfo: any): void;
export declare function genCssContent(styleInfo: any, pageConfig: any, entryName?: string): string;
export declare function genCssOGInfo(styleInfo: any): any;
export declare function appendStyleElement(
  styleInfo: any,
  pageConfig: any,
  rootDom: Node,
  document: Document,
  entryName?: string,
  ssrHydrateInfo?: any
): any;

// CSS property map functions
export declare function queryCSSProperty(index: number): { name: string; dashName: string; isX: boolean } | null;
export declare function queryCSSPropertyNumber(name: string): number | null;

// Style transformation functions
export declare function transformInlineStyleString(input: string): string;
export declare function transformParsedStyles(styles: [string, string][]): {
  transformedStyle: [string, string][];
  childStyle: [string, string][];
};

// Tokenizer functions
export declare function tokenizeCSS(input: string): any[];
export declare function parseCSSDeclarations(cssText: string): [string, string][];
export declare function serializeCSSDeclarations(declarations: [string, string][]): string;
