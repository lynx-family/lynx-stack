---
"@lynx-js/react": patch
---

Release the children of a list that a `reloadTemplate` replaces. An item the
list still shows or has pooled is kept for one reuse, as after `removeChild`;
the other old children are released, and a list the new tree drops is
destroyed with its recycling state. A removed list item that is reused applies
the same rule to the lists nested in it.
