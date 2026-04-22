/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
function snapshotInstanceToJSON() {
  if (this.type === null) {
    return this.__values[0];
  }
  const json = {
    type: this.type,
    children: this.childNodes,
    props: Object.fromEntries(
      this.__values?.map((v, i) => [`__${i}`, v]) ?? [],
    ),
  };
  Object.defineProperty(json, '$$typeof', {
    value: Symbol.for('react.test.json'),
  });
  return json;
}

function backgroundSnapshotInstanceToJSON() {
  if (this.type === null) {
    return this.__values[0];
  }
  const json = {
    type: this.type,
    children: this.childNodes,
    props: Object.fromEntries(
      this.__values?.map((v, i) => [`${i}`, v]) ?? [],
    ),
    __slotIndex: this.__slotIndex,
  };
  Object.defineProperty(json, '$$typeof', {
    value: Symbol.for('react.test.json'),
  });
  return json;
}

export { snapshotInstanceToJSON, backgroundSnapshotInstanceToJSON };
