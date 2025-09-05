# UI Variants

## Summary

The UI Variants plugin (`uiVariants`) enables Tailwind-compatible variants based on a component's internal state or configuration using a unified class-based `ui-*` prefix.

This mirrors patterns found in Headless UI or Radix UI, where internal states like `open`, `disabled`, or layout configurations like `side="left"` are surfaced via attribute selectors for styling purposes. Since Lynx doesn't support attribute selectors, this plugin provides a class-based alternative: instead of `[data-state="open"]`, you can write `.ui-open:*`.

## How to Enable and Customize

### Enable with Default Values

Enable the plugin with built-in `ui-*` prefixes and common component states:

```ts
createLynxPreset({
  lynxUIPlugins: {
    uiVariants: true,
  },
});
```

### Customize Prefixes and Values

Use a custom mapping to align with your component state structure (e.g., data-* patterns):

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

### Advanced: Extend or Override Defaults Programmatically

For full control while preserving built-in defaults, pass a function to prefixes. This allows extending, overriding, or merging prefix-value maps:

```ts
createLynxPreset({
  lynxUIPlugins: {
    uiVariants: {
      prefixes: (defaults) => ({
        ...defaults,
        ui: [...defaults.ui, 'expanded'], // extend existing
        'ui-side': ['top', 'bottom'], // override
        'aria-expanded': ['true', 'false'], // add new prefix
      }),
    },
  },
});
```

This approach ensures forward compatibility while allowing you to tailor variants to your component system.

### Default Prefixes and Values

When enabled with `true`, the plugin registers the following default variants:

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
  ],
  'ui-side': ['left', 'right', 'top', 'bottom'],
  'ui-align': ['start', 'end', 'center'],
}
```

These defaults are designed to support common component states and layout roles found in design systems and headless UI libraries.

## Usage Examples

```tsx
// Generates: .ui-open:bg-blue-500
<Popover className="ui-open:bg-blue-500" />

// Generates: .ui-side-left:border-l
<Popover className="ui-side-left:border-l" />

// Generates: .ui-align-end:text-right
<Popover className="ui-align-end:text-right" />
```

These variants enable component-aware styling by aligning Tailwind utilities with a component's runtime state or role in a scalable, declarative way.

To make these variants effective, your component needs to append the corresponding `ui-*` class dynamically based on its internal state or configuration. For example:

```tsx
<Popover className={isOpen ? 'ui-open container' : 'container'}>
  <div className='ui-open:bg-blue-500 ui-side-left:border-l' />
</Popover>;
```
