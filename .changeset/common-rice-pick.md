---
"@lynx-js/web-elements-reactive": minor
---

feat: add new decorator `registerEventEnableStatusChangeHandler`

example

```typescript
@registerEventEnableStatusChangeHandler('load')
 #enableLoadEvent(status:boolean) {
   if (status) {
     this.#getImg().addEventListener('load', this.#teleportLoadEvent, {
       passive: true,
     });
   } else {
     this.#getImg().removeEventListener('load', this.#teleportLoadEvent);
   }
 }
```

After this commit, we override the `HTMLElement.addEventListener` and the `HTMLElement.removeEventListner` to know if there is any listener attached on current element.

If event should be enabled/disabled, the callback will be invoked.
