// A namespace-imported module (`import * as UI from './ui.jsx'`), rendered as
// a member-expression component (`<UI.Card/>`). Every export carries the
// component-level directive, so the module compiles as a stub shell for the
// main thread and its snapshot definitions arrive through assembly.
export function Card() {
  'background only';
  const label = `UI_CARD_BODY_LOGIC_MARKER`;
  return (
    <view>
      <text>UI_CARD_SNAPSHOT_STATIC_MARKER</text>
      <text>{label}</text>
    </view>
  );
}
