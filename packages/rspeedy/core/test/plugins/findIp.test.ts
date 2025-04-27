// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test, vi } from 'vitest'

vi.mock('node:os')

describe('findIp', () => {
  test('v4', async () => {
    const { default: os } = await import('node:os')

    vi.mocked(os.networkInterfaces).mockReturnValue({
      eth0: [
        {
          address: '192.168.1.1',
          family: 'IPv4',
          internal: false,
          netmask: '255.255.255.0',
          mac: '00:00:00:00:00:00',
          cidr: '192.168.1.1/24',
        },
      ],
    })

    const { findIp } = await import('../../src/plugins/dev.plugin.js')

    const ip = await findIp('v4')
    expect(ip).toBe('192.168.1.1')
  })

  test('v6', async () => {
    const { default: os } = await import('node:os')

    vi.mocked(os.networkInterfaces).mockReturnValue({
      eth0: [
        {
          address: 'fd00::1',
          family: 'IPv6',
          internal: false,
          netmask: 'ffff:ffff:ffff:ffff::',
          mac: '00:00:00:00:00:00',
          cidr: 'fd00::1/64',
          scopeid: 0,
        },
      ],
    })

    const { findIp } = await import('../../src/plugins/dev.plugin.js')

    const ip = await findIp('v6')
    expect(ip).toBe('[fd00::1]')
  })

  test('multiple ips (should use the first ip)', async () => {
    const { default: os } = await import('node:os')

    vi.mocked(os.networkInterfaces).mockReturnValue({
      eth0: [
        {
          address: '192.168.1.1',
          family: 'IPv4',
          internal: false,
          netmask: '255.255.255.0',
          mac: '00:00:00:00:00:00',
          cidr: '192.168.1.1/24',
        },
        {
          address: '192.168.2.1',
          family: 'IPv4',
          internal: false,
          netmask: '255.255.255.0',
          mac: '00:00:00:00:00:00',
          cidr: '192.168.2.1/24',
        },
      ],
    })

    const { findIp } = await import('../../src/plugins/dev.plugin.js')

    const ip = await findIp('v4')
    expect(ip).toBe('192.168.1.1') // should use the first ip
  })

  test('multiple ips (should ignore internal ips)', async () => {
    const { default: os } = await import('node:os')

    vi.mocked(os.networkInterfaces).mockReturnValue({
      eth0: [
        {
          address: '192.168.2.1',
          family: 'IPv4',
          internal: true,
          netmask: '255.255.255.0',
          mac: '00:00:00:00:00:00',
          cidr: '192.168.2.1/24',
        },
        {
          address: '192.168.1.1',
          family: 'IPv4',
          internal: false,
          netmask: '255.255.255.0',
          mac: '00:00:00:00:00:00',
          cidr: '192.168.1.1/24',
        },
      ],
    })

    const { findIp } = await import('../../src/plugins/dev.plugin.js')

    const ip = await findIp('v4')
    expect(ip).toBe('192.168.1.1') // should ignore internal ips
  })

  test('no v4 ips', async () => {
    const { default: os } = await import('node:os')

    vi.mocked(os.networkInterfaces).mockReturnValue({
      eth0: [
        {
          address: 'fd00::1',
          family: 'IPv6',
          internal: false,
          netmask: 'ffff:ffff:ffff:ffff::',
          mac: '00:00:00:00:00:00',
          cidr: 'fd00::1/64',
          scopeid: 0,
        },
      ],
    })

    const { findIp } = await import('../../src/plugins/dev.plugin.js')

    await expect(findIp('v4')).rejects.toThrow(
      'No valid IP found',
    )
  })

  test('no ips', async () => {
    const { default: os } = await import('node:os')

    vi.mocked(os.networkInterfaces).mockReturnValue({})

    const { findIp } = await import('../../src/plugins/dev.plugin.js')

    await expect(findIp('v4')).rejects.toThrow(
      'No valid IP found',
    )
  })

  test('invalid network interfaces', async () => {
    const { default: os } = await import('node:os')

    vi.mocked(os.networkInterfaces).mockReturnValue({
      // @ts-expect-error mocked invalid network interfaces
      eth0: null,
    })

    const { findIp } = await import('../../src/plugins/dev.plugin.js')

    await expect(findIp('v4')).rejects.toThrow(
      'No valid IP found',
    )
  })

  test('invalid ip address', async () => {
    const { default: os } = await import('node:os')

    vi.mocked(os.networkInterfaces).mockReturnValue({
      eth0: [
        {
          // @ts-expect-error invalid ip address
          address: null,
        },
      ],
    })

    const { findIp } = await import('../../src/plugins/dev.plugin.js')

    await expect(findIp('v4')).rejects.toThrow(
      'No valid IP found',
    )
  })
})
