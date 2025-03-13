// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
import ngrok from '@ngrok/ngrok'

export interface TunnelData {
  url: string
  isOpen: boolean
  port: number
  tunnelConfig: TunnelConfig
}
export interface TunnelConfig {
  authtoken?: string
  protocol?: 'http' | 'https'
  region?: string
}

// Big thanks to expo for the authtoken :)
const defaultNgrokAuthToken = '5W1bR67GNbWcXqmxZzBG1_56GezNeaX6sSRvn8npeQ8'
const defaultNgrokProtocol = 'http'
const defaultNgrokRegion = 'in'

export async function connectNgrokTunnel(
  tunnel: TunnelData,
): Promise<string | null> {
  const ngrokConfig = tunnel.tunnelConfig
  try {
    // config ngrok and start the tunnel
    const listener = await ngrok.forward({
      addr: tunnel.port,
      authtoken: ngrokConfig.authtoken ?? defaultNgrokAuthToken,
      proto: ngrokConfig.protocol ?? defaultNgrokProtocol,
      region: ngrokConfig.region ?? defaultNgrokRegion,
    })
    return listener.url()
  } catch (_error) {
    return null
  }
}
