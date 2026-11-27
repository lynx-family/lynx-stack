// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Checks of IP addresses work; servers and sockets throw on use.
import { trap } from './trap.js';

const sockets = trap<typeof import('node:net')>('node:net');

const IPV4 =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
const isIPv4 = (input: unknown) => IPV4.test(String(input));
const isIPv6 = (input: unknown) =>
  String(input).includes(':') && /^[\da-f:.]+$/i.test(String(input));

const net = {
  isIP: (input: unknown) => {
    if (isIPv4(input)) return 4;
    return isIPv6(input) ? 6 : 0;
  },
  isIPv4,
  isIPv6,
  createServer: sockets.createServer,
  createConnection: sockets.createConnection,
  connect: sockets.connect,
};

export const { isIP, createServer, createConnection, connect } = net;
export { isIPv4, isIPv6 };
export default net;
