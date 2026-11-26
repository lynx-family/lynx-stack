// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const trap = require('./trap.cjs')('node:net');

const IPV4 =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
const isIPv4 = (input) => IPV4.test(String(input));
const isIPv6 = (input) =>
  String(input).includes(':') && /^[\da-f:.]+$/i.test(String(input));

module.exports = {
  isIP: (input) => {
    if (isIPv4(input)) return 4;
    return isIPv6(input) ? 6 : 0;
  },
  isIPv4,
  isIPv6,
  createServer: trap.createServer,
  createConnection: trap.createConnection,
  connect: trap.connect,
};
