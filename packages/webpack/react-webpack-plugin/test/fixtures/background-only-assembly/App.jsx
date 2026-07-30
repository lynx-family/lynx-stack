import { Shared } from './Shared.jsx';
import { Feed } from './Feed.jsx';
import * as UI from './ui.jsx';

// A structural component with NO annotations: it renders on the main thread
// and composes children from other modules. It evaluates `Feed` and `UI.Card`
// as values while rendering (`jsx(Feed, …)`), which is why background-only
// modules compile as stub shells instead of disappearing from the main-thread
// graph.
export function App() {
  const title = `APP_BODY_LOGIC_MARKER`;
  return (
    <view>
      <text>{title}</text>
      <Shared />
      <UI.Card />
      <Feed />
    </view>
  );
}
