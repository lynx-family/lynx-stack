import os from 'node:os';

const DEFAULT_PRODUCER_PORT = 43821;
const parsedProducerPort = Number(
  process.env['LYNX_STANDALONE_PRODUCER_PORT'] ?? DEFAULT_PRODUCER_PORT,
);
// Number('') is 0 and a malformed value is NaN; both make invalid URLs / proxy
// targets downstream, so fall back to the default for anything out of range.
export const producerDevPort = Number.isInteger(parsedProducerPort)
    && parsedProducerPort > 0
    && parsedProducerPort < 65536
  ? parsedProducerPort
  : DEFAULT_PRODUCER_PORT;

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
