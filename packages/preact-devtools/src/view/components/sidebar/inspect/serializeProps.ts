export interface JSONVNode {
  readonly type: 'vnode';
  readonly name: string;
}

export interface JSONFunction {
  readonly type: 'function';
  readonly name: string;
}

export interface JSONBigint {
  readonly type: 'bigint';
  readonly value: string;
}

export interface JSONSet {
  readonly type: 'set';
}

export type JSONValue =
  | string
  | boolean
  | number
  | null
  | undefined
  | JSONVNode
  | JSONFunction
  | JSONBigint
  | { readonly [index: string]: JSONValue }
  | readonly JSONValue[];

export function serializeProps(value: JSONValue): any {
  if (Array.isArray(value)) {
    return value.map(serializeProps);
  } else if (
    value !== null
    && typeof value === 'object'
    && Object.keys(value).length === 2
    && 'type' in value
    && typeof value.type === 'string'
  ) {
    if ('name' in value && typeof value.name === 'string') {
      if (value.type === 'function') {
        return value.name + '()';
      } else if (value.type === 'vnode') {
        return `<${value.name} />`;
      }
    } else if (
      'value' in value
      && typeof value.value === 'string'
      && value.type === 'bigint'
    ) {
      return `${value.value}n`;
    }
  }
  return value;
}

export function isSerializedBigint(value: unknown): value is JSONBigint {
  return (
    typeof value === 'object'
    && value !== null
    && Object.keys(value).length === 2
    && 'type' in value
    // @ts-ignore can remove after TypeScript 4.9.x: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#unlisted-property-narrowing-with-the-in-operator
    && value.type === 'bigint'
    && 'value' in value
    // @ts-ignore can remove after TypeScript 4.9.x: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#unlisted-property-narrowing-with-the-in-operator
    && typeof value.value === 'string'
  );
}
