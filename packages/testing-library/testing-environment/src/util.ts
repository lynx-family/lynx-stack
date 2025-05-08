/**
 * Define a set of properties on an object, by copying the property descriptors
 * from the original object.
 *
 * - `object` {Object} the target object
 * - `properties` {Object} the source from which to copy property descriptors
 */
export function define(object: any, properties: any) {
  for (const name of Object.getOwnPropertyNames(properties)) {
    const propDesc = Object.getOwnPropertyDescriptor(properties, name);
    // @ts-ignore
    Object.defineProperty(object, name, propDesc);
  }
}
