import { Renderer } from '../renderer';
import { debounce } from '../../shells/shared/utils';

export function createPicker(
  // window: Window,
  renderers: Map<number, Renderer>,
  onHover: (id: number) => void,
  onStop: () => void,
) {
  let picking = false;
  let lastId = -1;
  let lastTarget: any = null;

  function clicker(e: MouseEvent) {
    console.log('clicker', e);
    // e.preventDefault();
    // e.stopPropagation();
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    stop();
  }

  function listener(e: WindowEventMap['mouseover']) {
    console.log('mouseover', e);
    // e.preventDefault();
    // e.stopPropagation();
    if (picking && e.target != null && lastTarget !== e.target) {
      let id = lastId;
      for (const r of renderers.values()) {
        id = r.findVNodeIdForDom(e.target as any);
        if (id > -1 && lastId !== id) {
          onHover(id);
          break;
        }
      }

      lastTarget = e.target;
      lastId = id;
    }
  }

  function onMouseEvent(e: MouseEvent) {
    console.log('mouse event', e);
    // e.preventDefault();
    // e.stopPropagation();
  }

  const onScroll = debounce(() => {
    console.log('scroll');
    onHover(-1);
    lastId = -1;
    lastTarget = null;
  }, 16);

  function start() {
    if (!picking) {
      lastId = -1;
      picking = true;
      // TODO: make this work
      // lynx.getJSModule('GlobalEventEmitter').addListener("mousedown", onMouseEvent);
      // lynx.getJSModule('GlobalEventEmitter').addListener("mousemove", listener);
      // lynx.getJSModule('GlobalEventEmitter').addListener("mouseup", onMouseEvent);
      // lynx.getJSModule('GlobalEventEmitter').addListener("click", onMouseEvent);
      // document.addEventListener("scroll", onScroll, true);
    }
  }

  function stop() {
    if (picking) {
      lastId = -1;
      picking = false;
      onStop();

      // lynx.getJSModule('GlobalEventEmitter').removeListener("mousedown", onMouseEvent);
      // lynx.getJSModule('GlobalEventEmitter').removeListener("mousemove", listener);
      // lynx.getJSModule('GlobalEventEmitter').removeListener("mouseup", onMouseEvent);
      // lynx.getJSModule('GlobalEventEmitter').removeListener("click", onMouseEvent);
      // document.removeEventListener("scroll", onScroll);
    }
  }

  return { start, stop };
}
