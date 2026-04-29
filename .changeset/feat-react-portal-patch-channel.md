---
"@lynx-js/react": patch
---

Add `createPortal` for rendering a subtree into a different ReactLynx element identified by a `NodesRef`.

```tsx
function App() {
  const [host, setHost] = useState(null);
  return (
    <view>
      <view ref={setHost} />
      {host && createPortal(<text>hi</text>, host)}
    </view>
  );
}
```
