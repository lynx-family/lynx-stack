export class AnimaXViewElement extends HTMLElement {}

if (!customElements.get('animax-view')) {
  customElements.define('animax-view', AnimaXViewElement);
}
