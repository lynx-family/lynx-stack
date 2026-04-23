---
"@lynx-js/react": minor
---

Add `createPortal` support. Mark the host element with `portal-container` and pass its ref:

```tsx
function App() {
  const hostRef = useRef(null);
  const [host, setHost] = useState(null);
  useEffect(() => setHost(hostRef.current), []);
  return (
    <view>
      <view portal-container ref={hostRef} />
      {host && createPortal(<text>hi</text>, host)}
    </view>
  );
}
```

The `portal-container` element must have no children. Refs must come from a ReactLynx element — `lynx.createSelectorQuery()` / third-party refs are rejected.

You can also pass the framework-internal `__root` directly to render at the page root:

```tsx
import { __root } from '@lynx-js/react/internal';

function App() {
  return (
    <view>
      <text>in-tree</text>
      {createPortal(<text>under page root</text>, __root)}
    </view>
  );
}
```
