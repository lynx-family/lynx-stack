# UI Variants

## Summary

The UI Variants plugin (`uiVariants`) enables Tailwind-compatible variants based on a component's internal state or configuration using a unified class-based `ui-*` prefix.

This mirrors patterns found in Headless UI or Radix UI, where internal states like `open`, `disabled`, or layout configurations like `side="left"` are surfaced via attribute selectors for styling purposes. Since Lynx doesn't support attribute selectors, this plugin provides a class-based alternative: instead of `[data-state="open"]`, you can write `ui-open:*`.

## Default Behavior

Before **v0.4.0**, `uiVariants` was **disabled by default** and had to be enabled manually.

Starting with **v0.4.0**, `uiVariants` is **enabled by default**.
You only need to configure it explicitly if you want to disable it or customize its options.
With the default options, only the `ui` prefix is registered. The built-in `ui-side` and `ui-align` prefix value maps are available as explicit opt-ins.

## How to Customize

### Enable (for < v0.4.0, or explicit opt-in)

```ts
createLynxPreset({
  lynxUIPlugins: {
    uiVariants: true,
  },
});
```

### Disable

```ts
createLynxPreset({
  lynxUIPlugins: {
    uiVariants: false,
  },
});
```

### Configure Options

```ts
createLynxPreset({
  lynxUIPlugins: {
    uiVariants: {
      prefixes: {
        ui: ['open', 'checked'],
      },
    },
  },
});
```

> Tip: `uiVariants: {}` (empty object) and `uiVariants: true` both enable the plugin with the default `ui` prefix.
> Note: Passing an object replaces the default prefixes.
> To extend or merge built-in prefix value maps, use the function form shown below.

### Customize Prefixes and Values

Use a custom mapping to align with your component state structure (e.g., `data-*` patterns):

```ts
createLynxPreset({
  lynxUIPlugins: {
    uiVariants: {
      prefixes: {
        data: ['open', 'checked'],
        'data-side': ['left', 'right'],
      },
    },
  },
});
```

### Advanced: Extend or Override Built-ins Programmatically

For full control, pass a function to `prefixes`. The function receives all built-in prefix value maps, including the opt-in `ui-side` and `ui-align` maps. This allows enabling, extending, overriding, or merging them:

```ts
createLynxPreset({
  lynxUIPlugins: {
    uiVariants: {
      prefixes: (builtins) => ({
        ...builtins, // explicitly enable all built-in prefixes
        ui: [...builtins.ui, 'expanded'], // extend existing
        'ui-side': ['top', 'bottom'], // override
        'aria-expanded': ['true', 'false'], // add new prefix
      }),
    },
  },
});
```

This approach ensures forward compatibility while allowing you to tailor variants to your component system.

### Built-in Prefixes and Values

The plugin provides the following built-in prefix value maps:

```ts
{
  'ui': [
    'active',
    'disabled',
    'readonly',
    'checked',
    'selected',
    'indeterminate',
    'invalid',
    'initial',
    'open',
    'closed',
    'leaving',
    'entering',
    'animating',
    'busy',
    'focused',
    'complete',
    'filled',
    'dragging',
  ],
  'ui-side': ['left', 'right', 'top', 'bottom'],
  'ui-align': ['start', 'end', 'center'],
}
```

Only `ui` is registered by default. To register the other built-in prefixes, pass them explicitly:

```ts
createLynxPreset({
  lynxUIPlugins: {
    uiVariants: {
      prefixes: ['ui', 'ui-side', 'ui-align'],
    },
  },
});
```

These built-ins are designed to support common component states and optional layout roles found in design systems and headless UI libraries.

## Basic Usage Examples

```tsx
// Generates: .ui-open:bg-blue-500
<Popover className='ui-open:bg-blue-500' />;
```

The `ui-side` and `ui-align` examples require explicitly enabling their built-in prefixes as shown above:

```tsx
// Generates: .ui-side-left:border-l
<Popover className='ui-side-left:border-l' />;

// Generates: .ui-align-end:text-right
<Popover className='ui-align-end:text-right' />;
```

These variants enable component-aware styling by aligning Tailwind utilities with a component's runtime state or role in a scalable, declarative way.

To make these variants effective, your component needs to append the corresponding `ui-*` class dynamically based on its internal state or configuration. For example:

```tsx
<Popover className={clsx('ui-open:bg-blue-500', isOpen && 'ui-open')} />;
```

## Advanced Usage Examples

Beyond the **self state** shown in the basic examples, the `uiVariants` plugin defines **three scopes in total** for styling based on context:

- **Self state** → `ui-*` variants

  Never prefixed. Behaves like `data-*` / `aria-*`.

- **Direct parent scope** → `parent-*` modifiers

  Style an element based on its immediate parent's `ui-*` state.

- **Ancestor / sibling scopes** → `group-*` and `peer-*` modifiers

  Require a marker class on the ancestor (`group`) or sibling (`peer`).
  These **scope markers adopt your project prefix**, while `ui-*` state markers remain unprefixed.

Learn more in Tailwind's own docs [`group-*`](https://v3.tailwindcss.com/docs/hover-focus-and-other-states#styling-based-on-parent-state) and [`peer-*`](https://v3.tailwindcss.com/docs/hover-focus-and-other-states#styling-based-on-sibling-state) modifiers, as well as the underlying [plugin mechanism for parent and sibling states](https://v3.tailwindcss.com/docs/plugins#parent-and-sibling-states).

### Self

```tsx
// Styles apply when the same element has `ui-open`
<view className='ui-open:bg-blue-500' />;
```

Compiles to:

```css
.ui-open\:bg-blue-500.ui-open {
  background-color: #3b82f6;
}
```

### Direct-parent: `parent-*`

Style a child based on its **direct parent's** state. The parent carries the `ui-*` class; you use `parent-ui-*:...` on the child. There is **no** `parent` marker class to add.

```tsx
<view className='ui-open'>
  <view className='parent-ui-open:bg-emerald-500' />
</view>;
```

Compiles to:

```css
.ui-open > .parent-ui-open\:bg-emerald-500 {
  background-color: #10b981;
}
```

#### Why add `parent-*`?

The `parent-*` modifier fills the gap between self and group scopes.
It lets a child react to its **immediate container's** state without requiring any extra marker class:

- **Clear mental model** — "my direct parent controls me."
- **Safer matching** — avoids accidental wide matches that ancestor‐based `group-*` could introduce.
- **Efficient** — one level lookup is cheaper than scanning arbitrary ancestor chains.
- **Prefix simplicity** — no special prefixing rules are needed beyond the parent's `ui-*` state.

> Note: Tailwind itself does not provide a `parent-*` modifier.
> This scope is introduced by `uiVariants` plugin to complement Tailwind's existing `group-*` (ancestor) and `peer-*` (sibling) patterns.

### Ancestor: `group-*`

Add a **marker class** to any ancestor and style descendants based on that ancestor’s `ui-*` state.

- In **prefixed** projects the marker is **prefixed**: `.tw-group`.
- The `ui-*` **state** remains **unprefixed** (behaves like `data-*` / `aria-*`)
- The `group-ui-*` variant label also remains **unprefixed**, following Tailwind's own `group-*` pattern.

```tsx
<Ancestor className='group ui-open'>
  <view>
    {/* Somewhere inside the tree */}
    <Self className='group-ui-open:bg-indigo-500' />
  </view>
</Ancestor>;
```

Compiles to:

```css
.group.ui-open .group-ui-open\:bg-indigo-500 {
  background-color: #6366f1;
}
```

> Mental model: **scope markers are part of your app shell** (and adopt your project prefix); **states are part of the component library** (and must be portable → never prefixed).

### Sibling: `peer-*`

Add a **marker class** to the peer element and style siblings after it.

- In **prefixed** projects the marker is **prefixed**: `.tw-peer`.
- The `ui-*` **state** remains **unprefixed** (behaves like `data-*` / `aria-*`)
- The `peer-ui-*` variant label also remains **unprefixed**, following Tailwind's own `peer-*` pattern.

```tsx
<Field className='flex items-center gap-2'>
  <Checkbox className='peer ui-checked' />
  <Label className='peer-ui-checked:text-rose-600'>Enable alerts</Label>
</Field>;
```

Compiles to:

```css
.peer.ui-checked ~ .peer-ui-checked\:text-rose-600 {
  color: #e11d48;
}
```

### Named `group-*`/`peer-*` with slash `/`

You can create **named scope markers** to disambiguate multiple groups/peers. Slash labels are **kept** for scoped markers (standard Tailwind pattern), and the marker still respects your project prefix.

```tsx
{/* Mark two separate groups */}
<Dialog className='group/dialog ui-open'>
  <Menu className='group/menu ui-open'>
    <Button className='group-ui-open/menu:bg-amber-500'>Menu Button</Button>
  </Menu>
  <Button className='group-ui-open/dialog:bg-sky-500'>Dialog Button</Button>
</Dialog>;
```

### Mixed example

```tsx
<Ancestor className='tw-group/sheet ui-open'>
  <Parent className={open ? 'ui-open' : 'ui-closed'}>
    {/* highlights only when this node is open */}
    <StylingOnSelf className='ui-open:ring-2 ui-closed:opacity-60' />

    {/* highlights ONLY when the direct parent is open */}
    <StylingOnParent className='parent-ui-open:bg-green-500' />

    {/* requires an ancestor with .group/sheet somewhere above */}
    <StylingOnAncestor className='group-ui-open/sheet:shadow-lg' />

    {/* needs a preceding sibling with the .peer marker */}
    <StylingOnSibling className='peer-ui-open:shadow-sm' />
  </Parent>
</Ancestor>;
```

### Prefix behavior at a glance

| What                                         | Gets project prefix? | Example marker class                   | Why                                                         |
| -------------------------------------------- | -------------------- | -------------------------------------- | ----------------------------------------------------------- |
| `ui-*` states                                | **No**               | `ui-open`, `ui-checked`                | Behave like `data-*`/`aria-*`; must be portable across apps |
| Scope markers: `group`, `peer` (incl. named) | **Yes**              | `tw-group`, `tw-group/menu`, `tw-peer` | Part of app structure; align with Tailwind prefixing        |

**Do**:

```tsx
// Prefix ON markers and utilities (assuming tailwind.config.ts has: prefix: 'tw-'):
<view className="tw-group ui-selected">
  <view className="group-ui-selected:tw-bg-blue-500" />
</view>

// Prefix OFF on states:
<view className="ui-selected">
  <view className="group-ui-selected:tw-text-blue-500 ui-active:tw-text-red-500 ui-active" />
</view>
```

**Don't**:

```tsx
// 🚫 Wrong: prefixed state class (would break library portability)
<view className='tw-ui-active' />;
```

### Why `ui-*` is never prefixed

We treat `ui-*` as a **state surface**, equivalent to `data-*` / `aria-*`. Libraries can ship `ui-*` classes in their markup without worrying about the host app's Tailwind `prefix`. Meanwhile, **scope markers** (`group`, `peer`) belong to the **host layout**, so they follow your `prefix`.

Under the hood the plugin ensures `ui-*` selectors are never prefixed, while `group`/`peer` markers respect your project prefix.

### Quick reference

- **Self**: `ui-open:bg-*`
- **Parent**: `parent-ui-open:bg-*` (parent has `ui-open`)
- **Group**: `group-ui-open:bg-*` (ancestor has `.group` / `.tw-group`)
- **Peer**: `peer-ui-checked:bg-*` (sibling has `.peer` / `.tw-peer`)
- **Named scopes**: `group-ui-open/menu:*`, `peer-ui-active/tab:*` (marker on DOM: `.group/menu` / `.tw-group/menu`, `.peer/tab` / `.tw-peer/tab`)
