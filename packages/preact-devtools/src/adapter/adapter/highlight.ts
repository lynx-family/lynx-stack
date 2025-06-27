import { Renderer } from '../renderer';
import { render, h } from 'preact';
// import { getNearestElement, measureNode, mergeMeasure } from "../dom";
import { ID } from '../../view/store/types';
import { Highlighter, style } from '../../view/components/Highlighter';
import { PortPageHook } from './port';

/**
 * This module is responsible for displaying the transparent element overlay
 * inside the user's web page.
 */
export function createHightlighter(
  renderers: Map<number, Renderer>,
  port: PortPageHook,
  getRendererByVnodeId: (id: ID) => Renderer | null,
) {
  /**
   * Reference to the DOM element that we'll render the selection highlighter
   * into. We'll cache it so that we don't unnecessarily re-create it when the
   * hover state changes. We only destroy this element once the user stops
   * hovering a node in the tree.
   */
  let highlightRef: HTMLDivElement | null = null;

  function destroyHighlight() {
    if (highlightRef) {
      document.body.removeChild(highlightRef!);
    }
    highlightRef = null;
  }

  function highlight(id: ID) {
    const renderer = getRendererByVnodeId(id);
    if (!renderer) {
      return destroyHighlight();
    }

    const vnode = renderer.getVNodeById(id);
    if (!vnode) {
      return destroyHighlight();
    }
    const dom = renderer.findDomForVNode(id);

    if (dom != null) {
      // if (highlightRef == null) {
      // 	highlightRef = document.createElement("div");
      // 	highlightRef.id = "preact-devtools-highlighter";
      // 	highlightRef.className = style.outerContainer;

      // 	document.body.appendChild(highlightRef);
      // }

      // eslint-disable-next-line prefer-const
      let [first, last] = dom;
      if (first === null) return;

      // @ts-expect-error This is ReactLynx BackgroundSnapshotInstance
      const snapshotId = first.__id;
      const rendererList = [...renderers.values()];
      // Unlike Chrome extension, we only have one renderer here
      const id = rendererList[0].getUniqueListIdBySnapshotId(snapshotId);
      if (id?.[0] == null) {
        // It is as expected when list-item that is not in the viewport
        // since lynx uses a virtual list, so it is not rendered in to main-thread
        // but the vdom exists in the background thread
        // TODO: can we recognize this case and only warn on non-virtual list situations
        // console.warn("Failed to get unique id for snapshot", snapshotId);
        return;
      }
      port.send('preact-devtools-highlight', {
        snapshotId,
        uniqueId: id[0],
      });

      // // @ts-expect-error type error
      // lynx
      // 	.getNativeApp()
      // 	.callLepusMethod(
      // 		"getSnapshotElementUniqueID",
      // 		{ snapshotId },
      // 		(ret: { unique_id: number }) => {
      // 			if (ret?.unique_id == null) {
      // 				console.warn("Failed to get unique id for snapshot", snapshotId);
      // 				return;
      // 			}
      // 			port.send("preact-devtools-highlight", {
      // 				snapshotId,
      // 				uniqueId: ret.unique_id,
      // 			});
      // 		},
      // 	);

      // const node = getNearestElement(first);
      // const nodeEnd = last ? getNearestElement(last) : null;
      // if (node != null) {
      // 	let label = renderer.getDisplayName(vnode);

      // 	// Account for HOCs
      // 	const lastOpenIdx = label.lastIndexOf("(");
      // 	const firstCloseIdx = label.indexOf(")");
      // 	if (lastOpenIdx > -1 && lastOpenIdx < firstCloseIdx) {
      // 		label = label.slice(lastOpenIdx + 1, firstCloseIdx) || "Anonymous";
      // 	}

      // 	let size = measureNode(node);
      // 	if (nodeEnd !== null) {
      // 		const sizeLast = measureNode(nodeEnd);
      // 		size = mergeMeasure(size, sizeLast);
      // 	}

      // 	// If the current DOM is inside an iframe, the position data
      // 	// is relative to the content inside the iframe. We need to
      // 	// add the position of the iframe in the parent document to
      // 	// display the highlight overlay at the correct place.
      // 	if (document !== first?.ownerDocument) {
      // 		let iframe;
      // 		const iframes = Array.from(document.querySelectorAll("iframe"));
      // 		for (let i = 0; i < iframes.length; i++) {
      // 			const w = iframes[i].contentWindow;
      // 			if (w && w.document === first?.ownerDocument) {
      // 				iframe = iframes[i];
      // 				break;
      // 			}
      // 		}

      // 		if (iframe) {
      // 			const sizeIframe = measureNode(iframe);
      // 			size.top += sizeIframe.top;
      // 			size.left += sizeIframe.left;
      // 		}
      // 	}

      // 	let height = size.height;
      // 	let width = size.width;
      // 	if (size.boxSizing === "border-box") {
      // 		height += size.marginTop + size.marginBottom;
      // 		width += size.marginLeft + size.marginRight;
      // 	}

      // 	render(
      // 		h(Highlighter, {
      // 			label,
      // 			...size,
      // 			top: size.top - size.marginTop,
      // 			left: size.left - size.marginLeft,
      // 			height,
      // 			width,
      // 		}),
      // 		highlightRef,
      // 	);
      // }
    }
  }

  return { highlight, destroy: destroyHighlight };
}
