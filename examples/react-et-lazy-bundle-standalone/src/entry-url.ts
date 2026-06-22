export function createProducerBundleUrl(bundleFileName: string): string {
  if (process.env.NODE_ENV === 'production') {
    return `http://${process.env.LYNX_STANDALONE_PRODUCER_HOST}:${process.env.LYNX_STANDALONE_PRODUCER_PORT}/${bundleFileName}`;
  }
  return `${__webpack_public_path__}producer/${bundleFileName}`;
}
