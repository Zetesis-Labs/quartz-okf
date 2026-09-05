# Quickstart: Draw a mode as a tree

Name the relation that gives the mode its shape:

```js
modes: [
  {
    id: "tax",
    label: "Taxonomy",
    types: ["standard", "domain", "capability", "component"],
    edges: ["Part of"],
    tree: "Part of",
  },
  {
    id: "mentions",
    label: "Where the notes touch it",
    edges: "*",
    tree: { edge: "Part of", layout: "rings" },
  },
]
```

The root sits at the centre, each depth on its own ring, leaves evenly spaced outside.
Notes that are not part of the hierarchy start next to what they cite and settle freely.
Drag a tree node to look behind it; it returns when released. `layout: "rings"` keeps the
rings but lets the nodes move along them.

Nothing else is needed: `charge`, `gravity` and `layout.link` still apply to the free
nodes, and are ignored by the pinned ones. The console says when the declared relation
does not form a tree on screen and what the explorer did instead.
