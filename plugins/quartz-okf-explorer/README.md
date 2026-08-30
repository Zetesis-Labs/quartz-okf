# @zetesis/quartz-okf-explorer

Full-page explorer for an `okf-graph/v1` bundle: **declarative view modes**, filters by node
type and by edge label, and a tabbed reading panel that opens notes without leaving the graph.

Complements `@zetesis/quartz-graph-okf`, which renders the Obsidian-style *panel* graph next to
a note. This one is the map you open to think: it takes the whole screen, keeps the typed
topology visible, and lets a consumer declare **what questions the graph should answer**.

## Why modes are data

A graph view is only useful if it answers a question. The engine ships none: the consumer
declares its modes in `okf.config.mjs`, and the plugin renders them. Two sites with the same
engine can therefore ask completely different things of their corpus.

```js
// okf.config.mjs
export const explorer = {
  typeColors: { concept: "#4c7ecf", protocol: "#4caf7c", claim: "#c2544d" },
  typeLabels: { concept: "concepto", protocol: "protocolo", claim: "tesis" },
  knowledgeTypes: ["concept", "protocol", "topic", "claim"],
  modes: [
    {
      id: "full",
      label: "Grafo completo",
      desc: "<b>El grafo entero, con sus relaciones tipadas.</b> …",
      edges: "*",                       // every label in the profile
    },
    {
      id: "grounding",
      label: "Fundamentación",
      desc: "<b>Cuántas obras sostienen cada nota.</b> …",
      edges: ["Cites"],
      colorBy: {
        countEdge: "Cites",             // colour a node by how many of these it declares
        scale: [
          { max: 3, color: "#c2544d", label: "3 obras o menos" },
          { max: 99, color: "#3fa34d", label: "7 o más" },
        ],
      },
    },
    {
      id: "claims",
      label: "Tesis",
      desc: "…",
      edges: ["Depends on"],
      targetType: "claim",              // keep only edges landing on this type
      sizeBy: { indegree: true },
    },
  ],
}
```

### Mode fields

| Field | Meaning |
|---|---|
| `id`, `label`, `desc` | identity and the help text shown while the mode is active |
| `edges` | `"*"` or a list of edge labels to keep |
| `sourceType` / `targetType` | restrict edges by the type at either end |
| `colorBy.countEdge` + `scale` | colour nodes by how many edges of a label they declare |
| `colorBy.property` + `map` | colour nodes by a profile property (`properties.x.y`) — **and group the filter pills by it**, so the reader isolates states rather than types |
| `sizeBy.indegree` / `sizeBy.countEdge` | what drives node radius |

Anything not declared falls back to node type colours, so a mode can be one line.

## What the reader gets

- **Filters** for node type and edge label, each with a live count of what is on screen.
- **A legend** that lists only what the current mode actually draws — colours of relations in
  the full view, the grounding scale in a `colorBy` mode, node types otherwise.
- **A reading panel with tabs.** Clicking a node opens its page in a *temporary* tab that the
  next click replaces; pinning it (double click or the pin) keeps it. Each tab holds its own
  frame, so scroll position survives switching.
- **A stable camera.** The view never recentres on its own: fitting is a decision the reader
  takes, from the button, a search result, or a `?focus=<slug>` entry link.
- **Selection is visible.** The node being read carries its own ring and keeps its label even
  when the rest dims.

## Access from every note

With `injectAccess: true` the plugin adds a small preview and an **Open the graph** button to
`mountSelector`, and mounts the explorer in a maximised modal. The modal passes
`?focus=<slug>`, so the reader enters the graph at the note they were on rather than in the
middle of the whole map.

Disable it and link `/static/explorer.html` yourself if the site wants another entry point.

## Shape

Modes decide *what* is on screen; these decide *how it reads*. Both are engine-neutral —
the consumer knows which relation is a spine and which is a cross-link, the engine does not.

```js
export const explorer = {
  // Short identifiers next to each node; the long title goes to the tooltip and the panel.
  // Comes from the graph document: a node may carry `label` besides `title`.
  layout: {
    charge: -55,
    link: {
      "*": { distance: 30, strength: 0.65 },   // the spine: short and firm
      Cita: { distance: 62, strength: 0.15 },  // cross-links: long and slack
    },
  },
  radius: {
    byType: { herm: 14, note: 5.5 },           // wins over the property map
    property: "rank",
    map: { root: 10, mid: 6.5, leaf: 3.8 },
  },
  typeOrder: ["guide", "claim", "topic"],      // priority in the search results
}
```

Without `layout`/`radius` the graph falls back to in-degree sizing and uniform springs,
which suits a corpus with no declared hierarchy.

## Subgraphs

When the site federates other corpora (see `@zetesis/quartz-okf` → Federation) the graph
carries two kinds of marked nodes, and the explorer reads the marks — no configuration here:

- **Portals** (`node.subgraph`) are drawn with a second ring in their type colour and keep
  their label at every zoom. The tooltip reads how many notes the child holds and how many
  are previewed (a consumer rewords it through `tooltip.<type>`, e.g.
  `"{subgraph.notes|note|notes} · {subgraph.previewed} previewed"`) and says how to enter.
  **Double-click** a portal to enter its graph; the same action sits in the relation bar
  when the portal is selected and in the header of its reading panel (**Explorar
  subgrafo**). Entering swaps the canvas to the child graph published same-origin at
  `static/okf-subgraphs/<id>.json`, resets the camera and fits it as soon as the layout
  takes shape.
- **Federated notes** (`node.federated`) wear a dashed ring and a badge with their subgraph
  id in the tooltip and the search results. Their pages are mounted in this site
  (`/<id>/<slug>`), so the reading panel shows them like any other note; modifier-click
  opens them in a new tab. Their types and relations take the child's colours and labels
  when the consumer did not declare them (`display` on the graph root).

Inside a subgraph the explorer is the child's: its colours, labels and **its own view
modes** replace the consumer's for as long as you stay, and the panel shows the path
`parent › child` with **← Volver**. Entering pushes `?graph=<id>` to the browser history,
so the browser's back button also returns to the parent, with the portal selected and the
previous mode restored. `?graph=<id>` opens the explorer already inside a subgraph; the
copied graph knows its parent (`federatedFrom`) so the way back still works.

## Input

Reads the `okf-graph/v1` document emitted by `@zetesis/quartz-okf` (`static/okf-graph.json`).
That document already resolves aliases, carries `types`/`edgeLabels` from the profile, marks
`derived` edges and reports `unresolved` ones — the explorer renders it, it does not re-derive
it.
