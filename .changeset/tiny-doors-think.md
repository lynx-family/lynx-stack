---
"@lynx-js/react": minor
---

Support `React.createElement(type, props, children)` API.

```jsx
React.createElement('view', { style }, <text>hello</text>);
// equivalent to
<view style={style}>
  <text>hello</text>
</view>;

React.createElement(MyComponent, { style }, <view />);
// equivalent to
<MyComponent style={style}>
  <view />
</MyComponent>;
```
