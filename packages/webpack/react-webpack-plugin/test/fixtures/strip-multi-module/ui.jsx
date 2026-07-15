// A namespace-imported module (`import * as UI from './ui.jsx'`), rendered as
// a member-expression component (`<UI.Card/>`): the keep-alive must pin the
// namespace root so this module's snapshot definitions survive the strip.
export function Card() {
  const label = `UI_CARD_BODY_LOGIC_MARKER`;
  return (
    <view>
      <text>UI_CARD_SNAPSHOT_STATIC_MARKER</text>
      <text>{label}</text>
    </view>
  );
}
