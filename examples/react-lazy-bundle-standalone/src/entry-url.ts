export function createProducerBundleUrl(bundleFileName: string): string {
  return `${__webpack_public_path__}producer/${bundleFileName}`;
}
