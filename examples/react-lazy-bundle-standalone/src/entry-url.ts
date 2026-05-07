export function createProducerBundleUrl(bundleFileName: string): string {
  if (process.env.NODE_ENV === 'production') {
    return `http://localhost:${process.env.LYNX_STANDALONE_PRODUCER_PORT}/${bundleFileName}`;
  }
  return `${__webpack_public_path__}producer/${bundleFileName}`;
}
