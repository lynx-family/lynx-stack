// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

async function findIp(
  family: 'v4' | 'v6',
  isInternal = false,
): Promise<string> {
  const [
    { default: ipaddr },
    os,
  ] = await Promise.all([
    import('ipaddr.js'),
    import('node:os'),
  ])

  let host: string | undefined

  Object.values(os.networkInterfaces())
    .flatMap((networks) => networks ?? [])
    .filter((network) => {
      if (!network || !network.address) {
        return false
      }

      if (network.family !== `IP${family}`) {
        return false
      }

      if (network.internal !== isInternal) {
        return false
      }

      if (family === 'v6') {
        const range = ipaddr.parse(network.address).range()

        if (range !== 'ipv4Mapped' && range !== 'uniqueLocal') {
          return false
        }
      }

      return network.address
    })
    .forEach((network) => {
      host = network.address
      if (host.includes(':')) {
        host = `[${host}]`
      }
    })

  if (!host) {
    throw new Error(`No valid IP found`)
  }

  return host
}

const ip = await findIp('v4')

export function getIp(): string {
  return ip
}
