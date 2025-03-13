import ngrok from '@ngrok/ngrok'
import { describe, expect, test, vi } from 'vitest'
import { connectNgrokTunnel } from '../src/tunnel.js'
import type { TunnelData } from '../src/tunnel.js'

vi.mock('@ngrok/ngrok')

describe('connectNgrokTunnel', () => {
  const baseTunnelData: TunnelData = {
    url: '',
    isOpen: false,
    port: 3000,
    tunnelConfig: {
      authtoken: '5W1bR67GNbWcXqmxZzBG1_56GezNeaX6sSRvn8npeQ8',
      protocol: 'http',
      region: 'in',
    },
  }

  test('successfully connects to ngrok tunnel', async () => {
    const expectedUrl = 'https://example.ngrok.io'
    vi.mocked(ngrok.forward).mockResolvedValue({
      url: () => expectedUrl,
    } as unknown as ngrok.Listener)

    const tunnelData = { ...baseTunnelData }
    const url = await connectNgrokTunnel(tunnelData)

    expect(ngrok.forward).toHaveBeenCalledWith({
      addr: tunnelData.port,
      authtoken: tunnelData.tunnelConfig.authtoken,
      proto: tunnelData.tunnelConfig.protocol,
      region: tunnelData.tunnelConfig.region,
    })
    expect(url).toBe(expectedUrl)
  })

  test('handles ngrok connection error', async () => {
    vi.mocked(ngrok.forward).mockRejectedValue(new Error('Connection failed'))

    const tunnelData = { ...baseTunnelData }
    const url = await connectNgrokTunnel(tunnelData)

    expect(url).toBeNull()
  })
  test('uses provided protocol', async () => {
    const expectedUrl = 'https://protocol.ngrok.io'
    vi.mocked(ngrok.forward).mockResolvedValue({
      url: () => expectedUrl,
    } as unknown as ngrok.Listener)
    const tunnelData: TunnelData = {
      ...baseTunnelData,
      tunnelConfig: {
        ...baseTunnelData.tunnelConfig,
        protocol: 'https',
      },
    }
    const url = await connectNgrokTunnel(tunnelData)
    expect(ngrok.forward).toHaveBeenCalledWith({
      addr: tunnelData.port,
      authtoken: tunnelData.tunnelConfig.authtoken,
      proto: 'https',
      region: tunnelData.tunnelConfig.region,
    })
    expect(url).toBe(expectedUrl)
  })
  test('uses provided region', async () => {
    const expectedUrl = 'https://region.ngrok.io'
    vi.mocked(ngrok.forward).mockResolvedValue({
      url: () => expectedUrl,
    } as unknown as ngrok.Listener)
    const tunnelData: TunnelData = {
      ...baseTunnelData,
      tunnelConfig: {
        ...baseTunnelData.tunnelConfig,
        region: 'us', // i used us as user provided region change it to check for any other regions
      },
    }
    const url = await connectNgrokTunnel(tunnelData)
    expect(ngrok.forward).toHaveBeenCalledWith({
      addr: tunnelData.port,
      authtoken: tunnelData.tunnelConfig.authtoken,
      proto: tunnelData.tunnelConfig.protocol,
      region: 'us',
    })
    expect(url).toBe(expectedUrl)
  })
})
