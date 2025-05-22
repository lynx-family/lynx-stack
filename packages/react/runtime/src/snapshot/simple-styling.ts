import type { SnapshotInstance } from '../snapshot.js';

function updateSimpleStyle(
  snapshotInstance: SnapshotInstance,
  dynamicStyleList: (object | false)[],
): void {
  if (__MAIN_THREAD__) {
    for (let i = 0; i < dynamicStyleList.length; i++) {
      let style = dynamicStyleList[i];
      __UpdateStyleObject(
        snapshotInstance.__dy_styles![i]!,
        {
          ...snapshotInstance.__dy_init![i],
          ...(style || {}),
        },
      );
    }
  }
}

export { updateSimpleStyle };
