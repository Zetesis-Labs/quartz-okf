# @zetesis/quartz-okf-explorer

Full-page explorer for an `okf-graph/v1` bundle: **declarative view modes**, filters by node
type and by edge label, search across every graph the site publishes, and a reading dock
that opens notes without leaving the graph.

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
| `id`, `label`, `desc` | identity and the help text, shown on demand behind `?` in the views island |
| `edges` | `"*"` or a list of edge labels to keep |
| `sourceType` / `targetType` | restrict edges by the type at either end |
| `colorBy.countEdge` + `scale` | colour nodes by how many edges of a label they declare; the scale is the legend, reachable from the relations menu |
| `colorBy.property` + `map` | colour nodes by a profile property (`properties.x.y`) — **and group the type filter by it**, so the reader isolates states rather than types |
| `sizeBy.indegree` / `sizeBy.countEdge` | what drives node radius |

Anything not declared falls back to node type colours, so a mode can be one line.

## Anatomy of the HUD

The canvas takes the whole viewport; every control floats over it as an *island* and no
island reserves layout space. An island with nothing to say is not rendered.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [ CERN graph › CERN IT Governance & Identity   (⇥ this graph|Search…) ← home ] │  top bar
│              [ ● Selected note · Part of …  · ← Contains … · Explore ↘ ]│  selection capsule
│                                                                         │
│                          ·  ·   ●━━━ Explore ↘                          │  portal door
│                       ·    ●    ·      ·                                │
│                                                         ┌──────────────┐│
│  ┌ ↘ IT governance  Full view ┐ ┌ Types ──────────────┐ │ dock         ││
│  │ Chain of authority      ?  │ │ ☑ ● Service     33  │ │ tabs + note  ││
│  ├ Types 19 › Relations 33 › ─┤ │ ☑ ● Concept     18  │ │              ││
│  │ 274 nodes · 806 links Fit  │ └─────────────────────┘ └──────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

- **Top bar**. Left, the *trail*: the graph on screen and every ancestor as a control
  that returns to it, with the whole width to itself so long titles read in full.
  Right, the **omnibar** — search box plus, with more than one graph published, a `⇥`
  key that cycles the scope between *this graph* and *all graphs* — and the way home
  (`backTo`). Results carry a colour dot, the kind label and — for notes of another
  graph — that graph's badge; activating one enters that graph with the note selected.
  A graph that could not be loaded is named at the top of the list, never skipped in
  silence. Framed by the note-page modal, the trail and the home link move to the
  modal's own bar (the explorer posts them; clicking a level there navigates the
  explorer) and the bar keeps only the search, centred.
- **Selection capsule** (under the omnibar). The selected note with its relations grouped
  by label — incoming ones marked `←` — each group listing up to six notes and a `+n`;
  clicking a note selects it and opens it in the dock. A portal offers *Explore subgraph*.
- **Portal doors**. Every portal (a node that stands for another graph) gets an `Explore ↘`
  pill glued to it on the canvas and a `↘ <graph>` chip at the top of the views island,
  whatever the current mode hides. Double-click on the node does the same.
- **Views island**: the modes of the graph on screen as chips, preceded inside a subgraph
  by `‹ <parent>`; `?` toggles the active mode's description.
- **Filters island**: `Types n ›` and `Relations m ›` open side menus with a row per
  group — colour, label, count, checkbox — plus *All* / *None*; the chip's count reads
  `checked/total` while filtered and turns to the warning colour when nothing is checked.
  The relations menu is hidden when the mode fixes a single label. The mode's legend
  (`colorBy.scale`) sits under the rows of the relations menu, or of the types menu when
  there is no relations menu. The footer shows what is on screen, *Fit* and *Clear*.
- **Dock** (right): the reading panel, floating over the canvas. Clicking a node opens its
  page in a *temporary* tab that the next click replaces; pinning it (double click or the
  pin) keeps it. Each tab holds its own frame, so scroll position survives switching.
  Under 900px the dock takes the screen.
- **A stable camera.** The view never recentres on its own: fitting is a decision the
  reader takes, from the button, a search result, or a `?focus=<slug>` entry link. Fitting
  targets the part of the canvas the islands leave free.

### Keyboard

| Key | Where | Does |
|---|---|---|
| `/` or any printable key | anywhere | focuses the search and types into it |
| `⇥` | search box | cycles the scope (only with more than one graph) |
| `↑` `↓` | search box | move the highlighted result |
| `⏎` | search box | activates the highlighted result; with no list, frames the matches |
| `Esc` | search box | clears the search and restores the camera saved when it began, unless the reader moved it |
| `Esc` | anywhere else | closes, in order: the open menu, the results, the selection, the dock |

## Options

| Option | Default | Meaning |
|---|---|---|
| `graphInput` | `static/okf-graph.json` | the `okf-graph/v1` document |
| `output` | `static/explorer.html` | path of the emitted page |
| `injectAccess`, `accessTitle`, `mountSelector` | `true`, catalogue, `.right.sidebar` | the note-page widget and modal (see below) |
| `title`, `backTo` | `accessTitle`, `/` | root of the trail and the way home in the top bar |
| `typeColors`, `typeLabels`, `edgeColors`, `knowledgeTypes`, `typeOrder` | — | vocabulary |
| `layout`, `radius`, `tooltip` | — | shape (see below) |
| `modes` | one *full graph* mode | the questions |
| `locale` | the site's Quartz `locale` | wording catalogue: `es` or `en` (language part of the tag); anything else falls back to `en` with a build warning |
| `wording` | `{}` | per-key overrides of the engine wording; an unknown key is a build warning |
| `hud.surfaces` | `"flat"` | `"glass"` blurs the islands; always flat under `prefers-reduced-transparency` |
| `hud.tokens` | `{}` | CSS custom properties set on `:root`: `--accent`, `--hud-bg`, `--hud-border`, `--hud-fg`, `--hud-radius`, `--hud-font`, `--hud-mono`, … |

### Wording

Every visible word of the engine — placeholders, chip labels, hints, counts, the
note-page widget's buttons — comes from a catalogue (`lib/i18n.js`). Keys and their
English text:

`access.title` Knowledge graph · `access.open` Open the graph · `access.expand` /
`access.reduce` / `access.close` · `access.loading` · `access.stats` `{notes|note|notes} ·
{edges|typed relation|typed relations}` · `search.placeholder` Search notes… ·
`search.placeholder.all` · `search.hint` · `scope.this` this graph · `scope.all` all graphs ·
`results.none` · `results.unavailable` `Not searched: {graph}` · `results.loading` ·
`views.back` `‹ {graph}` · `views.about` · `mode.full` Full graph · `mode.full.desc` ·
`filters.types` Types · `filters.edges` Relations · `filters.all` · `filters.none` ·
`filters.legend` · `stats` `{nodes|node|nodes} · {links|link|links}` · `fit` · `clear` ·
`trail.back` `Back to {graph}` · `trail.subgraph` · `tooltip.incoming` · `tooltip.portal` ·
`tooltip.portal.hint` · `selection.incoming` `← {label}` · `selection.explore` Explore
subgraph ↘ · `portal.explore` Explore ↘ · `portal.enter` `↘ {graph}` · `portal.title` ·
`dock.open` · `dock.close` · `dock.tab.pin` / `dock.tab.unpin` / `dock.tab.close` /
`dock.tab.temp` · `focus.missing`.

Templates use the same syntax as tooltips: `{path}` and `{path|singular|plural}`.

```js
export const explorer = {
  locale: "es",
  wording: { "search.placeholder": "Buscar una nota…", "scope.all": "todo el sitio" },
  hud: { surfaces: "glass", tokens: { "--accent": "#b3541e" } },
}
```

## Access from every note

With `injectAccess: true` the plugin adds a small preview and an **Open the graph** button to
`mountSelector`, and mounts the explorer in a maximised modal. The modal passes
`?focus=<slug>`, so the reader enters the graph at the note they were on rather than in the
middle of the whole map — and if that note lives only inside a federated subgraph, the
explorer enters that subgraph by itself.

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
  their label at every zoom, with an `Explore ↘` door pinned to them. The tooltip reads how
  many notes the child holds and how many are previewed (a consumer rewords it through
  `tooltip.<type>`, e.g. `"{subgraph.notes|note|notes} · {subgraph.previewed} previewed"`).
  Entering swaps the canvas to the child graph published same-origin at
  `static/okf-subgraphs/<id>.json`, resets the camera and fits it as soon as the layout
  takes shape.
- **Federated notes** (`node.federated`) wear a dashed ring and a badge with their subgraph
  id in the tooltip and the search results. Their pages are mounted in this site
  (`/<id>/<slug>`), so the dock shows them like any other note; modifier-click opens them
  in a new tab. Their types and relations take the child's colours and labels when the
  consumer did not declare them (`display` on the graph root).

Inside a subgraph the explorer is the child's: its colours, labels, tooltips and **its own
view modes** replace the consumer's for as long as you stay. The top bar's trail reads
`parent › child` — in the note-page modal, the modal's bar does — every earlier level
returning to that graph (several levels at once), and the views island starts with
`‹ parent`. Entering pushes `?graph=<id>` to the browser
history, so the browser's back button also returns to the parent — always with the portal
selected and the previous mode restored. `?graph=<id>` opens the explorer already inside a
subgraph; the copied graph knows its parent (`federatedFrom`) so the way back still works.

The *all graphs* scope of the omnibar and `?focus=` both walk the graphs the root reaches
through its portals (and their portals), loading each `static/okf-subgraphs/<id>.json` once.

## Layout of the package

```
lib/        pure decisions, no DOM: model, display, view, style, search, registry, route,
            focus, hud, i18n, template, emit-config — covered by test/*.test.js (node --test)
src/index.ts       the emitter (Node): inlines the configuration and the shell into the page
src/hud/main.js    the browser shell: canvas, d3, DOM, fetch, history — bundled by tsup to
                   dist/assets/hud.js and inlined at emit time
src/assets/        explorer.html (markup + tokens + CSS) and access.js (note-page widget)
```

## Input

Reads the `okf-graph/v1` document emitted by `@zetesis/quartz-okf` (`static/okf-graph.json`).
That document already resolves aliases, carries `types`/`edgeLabels` from the profile, marks
`derived` edges and reports `unresolved` ones — the explorer renders it, it does not re-derive
it.
