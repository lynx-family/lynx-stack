import { prettyFormatSnapshotPatch } from '../../src/debug/formatPatch';

export function formattedPatch() {
  const calls = lynx.getNativeApp().callLepusMethod.mock.calls;
  return calls.map((call) => {
    if (call[0] === 'rLynxChange') {
      const data = JSON.parse(call[1].data).patchList[0].snapshotPatch;
      return prettyFormatSnapshotPatch(data);
    } else {
      return call;
    }
  });
}
