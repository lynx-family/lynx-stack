// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { createSocketURL } from '../../client/createSocketURL.js';
import { parseURL } from '../../client/parseURL.js';

describe('\'createSocketURL\' function', () => {
  const samples = [
    // __resourceQuery, location and socket URL
    [
      '?hostname=example.com&pathname=/ws',
      'http://example.com',
      'ws://example.com/ws',
    ],
    ['?protocol=auto:', 'http://example.com', 'ws://example.com/ws'],
    ['?protocol=auto:', 'https://example.com', 'wss://example.com/ws'],
    ['?protocol=wss:', 'http://example.com', 'wss://example.com/ws'],
    ['?protocol=https:', 'https://example.com', 'wss://example.com/ws'],
    ['?protocol=http:', 'https://example.com', 'ws://example.com/ws'],
    ['?hostname=example.com', 'http://example.com', 'ws://example.com/ws'],
    [
      '?username=username&password=password',
      'http://example.com',
      'ws://username:password@example.com/ws',
    ],
    [
      '?hostname=example.com&port=80',
      'http://example.com',
      'ws://example.com:80/ws',
    ],
    ['?port=0', 'http://example.com:8080', 'ws://example.com:8080/ws'],
    ['?port=80', 'http://example.com:8080', 'ws://example.com:80/ws'],
    ['?hostname=0.0.0.0', 'http://127.0.0.1', 'ws://127.0.0.1/ws'],
    ['?hostname=0.0.0.0', 'http://192.168.0.1', 'ws://192.168.0.1/ws'],
    ['?hostname=0.0.0.0', 'https://192.168.0.1', 'wss://192.168.0.1/ws'],
    ['?hostname=0.0.0.0', 'https://example.com', 'wss://example.com/ws'],
    [
      '?hostname=0.0.0.0',
      'http://example.com:8080',
      'ws://example.com:8080/ws',
    ],
    [
      '?hostname=0.0.0.0',
      'http://example.com:8080',
      'ws://example.com:8080/ws',
    ],
    [
      '?hostname=0.0.0.0',
      'https://example.com:8080',
      'wss://example.com:8080/ws',
    ],
    ['?hostname=::', 'http://example.com:8080', 'ws://example.com:8080/ws'],
    ['?hostname=[::]', 'http://example.com:8080', 'ws://example.com:8080/ws'],
    ['?hostname=[::]', 'http://example.com:8080', 'ws://example.com:8080/ws'],

    ['?hostname=%3A%3A', 'http://example.com:8080', 'ws://example.com:8080/ws'],
    // ['?hostname=%3A%3A1', 'http://example.com:8080', 'ws://[::1]:8080/ws'],
    // ['?hostname=%3A%3A1', 'https://example.com:8080', 'wss://[::1]:8080/ws'],
    [
      '?hostname=%3A%3A',
      'https://example.com:8080',
      'wss://example.com:8080/ws',
    ],
    [
      '?hostname=%3A%3A',
      'https://example.com:8080',
      'wss://example.com:8080/ws',
    ],
    [
      '?pathname=/custom-ws',
      'http://example.com',
      'ws://example.com/custom-ws',
    ],
    [
      '?protocol=wss:&username=user&password=password&hostname=localhost&port=8080&pathname=/ws',
      'http://user:password@localhost/',
      'wss://user:password@localhost:8080/ws',
    ],
    [null, 'http://example.com', 'ws://example.com/ws'],
    [null, 'https://example.com', 'wss://example.com/ws'],
    [null, 'http://example.com:8080', 'ws://example.com:8080/ws'],
    [null, 'http://example.com/foo/bar', 'ws://example.com/ws'],
    [
      null,
      'http://user:password@localhost/',
      'ws://user:password@localhost/ws',
    ],
    [null, 'http://user@localhost:8080/', 'ws://user@localhost:8080/ws'],
    [
      null,
      'http://user:password@localhost:8080/',
      'ws://user:password@localhost:8080/ws',
    ],
    [null, 'https://localhost:8080', 'wss://localhost:8080/ws'],
    [null, 'http://127.0.0.1', 'ws://127.0.0.1/ws'],
    [null, 'http://127.0.0.1:8080', 'ws://127.0.0.1:8080/ws'],
    [null, 'https://127.0.0.1', 'wss://127.0.0.1/ws'],
    [null, 'http://[::1]:8080/ws', 'ws://[::1]:8080/ws'],
    [null, 'https://[::1]:8080/ws', 'wss://[::1]:8080/ws'],
    [null, 'file:///home/user/project/index.html', 'ws://localhost/ws'],
    [null, 'chrome-extension://localhost', 'ws://localhost/ws'],
    [null, 'file://localhost', 'ws://localhost/ws'],
  ] as const;

  samples.forEach(([__resourceQuery, location, expected]) => {
    test(
      `should return '${expected}' socket URL when '__resourceQuery' is '${__resourceQuery}' and 'self.location' is '${location}'`,
      () => {
        if (location.startsWith('file://')) {
          return;
        }
        const parsedURL = parseURL(__resourceQuery);

        const { hostname, port, protocol, username, password } = new URL(
          decodeURIComponent(location),
        );
        parsedURL.hostname = hostname;
        if (!parsedURL.port || parsedURL.port === '0') {
          parsedURL.port = port;
        }
        parsedURL.username ??= username;
        parsedURL.password ??= password;

        if (
          (!parsedURL.protocol || parsedURL.protocol === 'auto:') && location
        ) {
          parsedURL.protocol = protocol === 'https:'
            ? 'wss:'
            : 'ws:';
        }

        expect(
          createSocketURL(
            parsedURL as unknown as Parameters<typeof createSocketURL>[0],
          ),
        ).toBe(expected);
      },
    );
  });
});
