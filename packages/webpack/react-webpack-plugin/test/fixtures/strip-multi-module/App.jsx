import { Feed } from './Feed.jsx';
import * as UI from './ui.jsx';

// A structural component with NO annotations: it only composes children from
// other modules. The strip empties its body, and the component references the
// body held (`Feed`, `UI`) are handed to the module-level keep-alive — that is
// what pins './Feed.jsx' and './ui.jsx' (and their hoisted definitions) into
// the main-thread bundle.
export function App() {
  const title = `APP_BODY_LOGIC_MARKER`;
  return (
    <view>
      <text>{title}</text>
      <UI.Card />
      <Feed />
    </view>
  );
}
