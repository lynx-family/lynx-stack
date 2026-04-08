---
"@lynx-js/web-core": patch
---

Added support for the `global-bind` event handling modifier in the web platform runtime.

This mechanism enables seamless cross-element event communication without requiring a formal DOM tree relationship, allowing decoupled elements to observe and respond to standard events occurring anywhere within the component tree.

### Usage

Global bindings allow an observer element to react to events triggered on another target element.

#### 1. Define the Global Subscription

Attach `global-bindTap` (or any equivalent standard event alias) to your observer element:

```jsx
<view
  id='observer'
  global-bindTap={(event) => {
    // This will trigger whenever 'tap' is caught by a globally bound event.
    console.log('Global tap handled!', event);
  }}
/>;
```

#### 2. Trigger the Event anywhere

The event will be triggered via normal user interaction (such as `tap`) on any other constituent elements:

```jsx
<view
  id='target'
  bindTap={(event) => {
    // Note: To successfully propagate globally, ensure the event bubbles.
  }}
/>;
```
