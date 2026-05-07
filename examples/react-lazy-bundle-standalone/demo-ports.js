import os from 'node:os';

export const producerDevPort = Number(
  process.env['LYNX_STANDALONE_PRODUCER_PORT'] ?? '43721',
);

export function detectLanHost() {
  if (process.env['LYNX_STANDALONE_PRODUCER_HOST']) {
    return process.env['LYNX_STANDALONE_PRODUCER_HOST'];
  }
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}
