/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
expect(requestAnimationFrame).toStrictEqual(expect.any(Function));
expect(cancelAnimationFrame).toStrictEqual(expect.any(Function));
expect(requestAnimationFrame).not.toBe(lynx.requestAnimationFrame);
expect(cancelAnimationFrame).not.toBe(lynx.cancelAnimationFrame);
expect(requestAnimationFrame).not.toBe(globalThis.requestAnimationFrame);
expect(cancelAnimationFrame).not.toBe(globalThis.cancelAnimationFrame);
