---
"@lynx-js/react": patch
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

The `portal-container` element must have no children. Refs must come from a ReactLynx element — `lynx.createSelectorQuery()` / third-party refs are rejected. `null`/`undefined` container renders nothing.
