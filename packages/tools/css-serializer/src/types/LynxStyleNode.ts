/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/

export interface Location {
  column: number;
  line: number;
}
export interface Value {
  value: string;
  loc: Location;
}
export interface BaseDeclaration {
  name: string;
  value: string;
  keyLoc: Location;
  valLoc: Location;
}
export interface VariableDeclaration extends BaseDeclaration {
  type: 'css_var';
  defaultValue?: string;
  defaultValueMap?: Record<string, string>;
}

export type Declaration = BaseDeclaration | VariableDeclaration;

export interface StyleRule {
  type: 'StyleRule';
  selectorText: Value;
  variables: Record<string, string>;
  style: Declaration[];
}

export interface FontFaceRule {
  type: 'FontFaceRule';
  style: Declaration[];
}

export interface ImportRule {
  type: 'ImportRule';
  href: string;
  origin: string;
}
export interface KeyframesStyle {
  keyText: Value;
  style: Declaration[];
}
export interface KeyframesRule {
  type: 'KeyframesRule';
  name: Value;
  styles: KeyframesStyle[];
}

export interface MediaRule {
  type: 'MediaRule';
  prelude: Value;
  rules: LynxStyleNode[];
}

export interface SupportsRule {
  type: 'SupportsRule';
  prelude: Value;
  rules: LynxStyleNode[];
}

export interface LayerRule {
  type: 'LayerRule';
  prelude?: Value;
  rules: LynxStyleNode[];
}

export type LynxStyleNode =
  | StyleRule
  | FontFaceRule
  | ImportRule
  | KeyframesRule
  | MediaRule
  | SupportsRule
  | LayerRule;
