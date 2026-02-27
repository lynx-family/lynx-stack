// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const throttle = function(
  func: () => unknown,
  wait: number,
  options?: { leading: boolean; trailing: boolean },
) {
  let timeout: NodeJS.Timeout | null;
  let context: any;
  let args: any;
  let result: any;
  let previous = 0;

  var later = function() {
    previous = options?.leading === false ? 0 : new Date().getTime();
    timeout = null;
    result = func.apply(context, args);
    if (!timeout) context = args = null;
  };

  return function(this: unknown) {
    var now = new Date().getTime();
    if (!previous && options?.leading === false) previous = now;
    var remaining = wait - (now - previous);
    context = this;
    args = arguments;

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    } else if (!timeout && options?.trailing !== false) {
      timeout = setTimeout(later, remaining);
    }
    return result;
  };
};
