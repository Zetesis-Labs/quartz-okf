# @zetesis/quartz-okf-explorer

In-page explorer for an `okf-graph/v1` bundle, as a Quartz component: **declarative view
modes**, filters by node type and by edge label, search across every graph the site
publishes, a command palette, and a reading dock that opens notes without leaving the graph.
It opens over the page the reader is on — one document, no frame.

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

## In the site

The plugin is a Quartz **component**: the layout places its access widget (preview, *Open the
graph*, the graph's counts) and the explorer opens over the page.

```yaml
# quartz.config.yaml
- source: "./quartz-okf-explorer"
  enabled: true
  layout:
    position: right
    priority: 15
```

```ts
// quartz.ts — the consumer's explorer block reaches the component as its options
componentRegistry.setOptionOverrides("quartz-okf-explorer", explorer)
```

The reader opens the explorer from any note and lands on that note (`?explorer&focus=<slug>`
in the page's URL); if the note lives only inside a federated subgraph, the explorer enters
that subgraph by itself. `Esc`, the `✕` in the bar or the browser's back button return to the
page as it was — no reload. Entering a subgraph pushes `graph=<id>`, so back undoes each step.
A link with `?explorer[&graph=<id>][&focus=<slug>]` reopens the same view; the old
`/static/explorer?graph=&focus=` page still exists and forwards there.

## Anatomy of the HUD

The canvas takes the whole viewport; every control floats over it as an *island* and no
island reserves layout space. An island with nothing to say is not rendered.

```
┌───────────────────────────────────────────────────────────────────────────┐
│ [ CERN graph › CERN IT Governance   ● WLCG IAM ✕  ● Data privacy ✕      ✕ ] │  bar: trail · pins · close
│                 ( ⇥ this graph | Search notes…  > commands )              │  omnibar
│                                                                           │
│                          ·  ·   ●━━━ Explore ↘             ┌────────────┐ │
│                       ·    ●    ·      ·                   │ ● Note  📍 »│ │  dock: one note
│  ┌ ● Selected · Part of … · ← Contains … · Explore ↘ ┐     │ the article │ │
│  ├ ↘ IT governance  Full view  Chain of authority ?  ┤     │ (fetched)   │ │
│  ├ Types 19 › Relations 33 › ── 274 nodes · 806 links ┤     └────────────┘ │
│                        ⇥ walk · arrows · ⏎ open · space menu               │
└───────────────────────────────────────────────────────────────────────────┘
```

- **Bar** — always on screen, the whole width. Left, the *trail*: the graph on screen and
  every ancestor as a control that returns to it; it never truncates. Middle, the **pinned
  notes** as chips (dot, title, `✕`; the one being read is highlighted; they scroll sideways
  when they do not fit). Right, the `✕` that closes the explorer.
- **Omnibar** — a floating capsule centred under the bar, on the part of the canvas the dock
  leaves free: search box plus, with more than one graph published, a `⇥` key that cycles
  the scope between *this graph* and *all graphs*. Results carry a colour dot, the kind
  label and — for notes of another graph — that graph's badge; activating one enters that
  graph with the note selected. A graph that could not be loaded is named at the top of the
  list, never skipped in silence. `>` turns the box into the **command palette**: the modes,
  *Fit*, *Clear*, *Enter <portal>*, *Back to <parent>*, open / pin / explore the selected
  note, close the dock, copy the link to this view.
- **Portal doors**. Every portal (a node that stands for another graph) gets an `Explore ↘`
  pill glued to it on the canvas and a `↘ <graph>` chip at the top of the views island,
  whatever the current mode hides. Double-click does the same. If the selected note is on
  loan from that subgraph, entering keeps it selected and framed inside.
- **Bottom-left stack**: the **selection capsule** (the selected note with its relations
  grouped by label — incoming ones marked `←` — up to six notes and a `+n` per group;
  clicking one opens it in the dock; a portal offers *Explore subgraph*), the **views
  island** (the modes as chips, preceded inside a subgraph by `‹ <parent>`; `?` shows the
  active mode's description) and the **filters island** (`Types n ›` and `Relations m ›`
  open side menus with a row per group — colour, label, count, checkbox — plus *All* /
  *None*; the chip's count reads `checked/total` while filtered and turns to the warning
  colour when nothing is checked; the mode's legend sits under the rows; the footer shows
  what is on screen, *Fit* and *Clear*).
- **Dock** (right, under the bar; the whole width under 900px). Clicking a node opens its
  note — the site's own article, fetched like Quartz's popovers, scripts stripped — as the
  *temporary* note the next click replaces. `📍` pins it: it moves to the bar and comes back
  on a click; `📌` unpins. `Open ↗` navigates to the page (and closes the explorer); `»`
  tucks the dock away, the pins stay.
- **Context menu** — right-click on a node: open, open in a new tab, pin, frame its
  neighbourhood, explore its subgraph, copy link; on the background: fit, clear. `Space` on
  the keyboard-focused node opens the same menu.
- **A stable camera.** A graph appears already laid out and fitted — the simulation is
  warmed up before the first frame, in a bounded slice of time — and from then on the view
  never recentres on its own: fitting is a decision the reader takes, from the button, a
  search result, or a `focus=` entry link. Changing mode or filter keeps the positions of
  the notes that stay. Fitting targets the part of the canvas the islands leave free.
- **Ground** (`hud.ground: "dots"`): a dot grid with half-speed parallax and a soft vignette;
  flat by default.

### Keyboard

| Key | Where | Does |
|---|---|---|
| `/` or any printable key | anywhere | focuses the search and types into it |
| `>` | search box | opens the command palette in the same list |
| `⇥` | search box | cycles the scope (only with more than one graph) |
| `↑` `↓` | search box | move the highlighted result or command |
| `⏎` | search box | activates it; with no list, frames the matches |
| `Esc` | search box | clears the search and restores the camera saved when it began, unless the reader moved it |
| `←` `→` `↑` `↓` | canvas | move the focus to the nearest node in that direction (a dashed ring marks it) |
| `⏎` / `Space` | focused node | open its note / open its menu |
| `⇥` / `⇧⇥` | anywhere | move between the explorer's controls; the focus never leaves the explorer while it is open |
| `Esc` | anywhere else | closes, in order: the context menu, the side menu, the results, the selection, the keyboard focus, the dock — and then the explorer |

The explorer takes the focus when it opens (the canvas, so the arrows answer at once) and
gives it back to the control the reader came from when it closes. The canvas is focusable,
so `⇥` reaches the HUD and comes back to the graph without a pointer.

## Options

| Option | Default | Meaning |
|---|---|---|
| `graphInput` | `static/okf-graph.json` | the `okf-graph/v1` document |
| `output` | `static/explorer.html` | path of the redirect page kept for old links |
| `injectAccess`, `accessTitle` | `true`, catalogue | the widget in the sidebar (`false` hides it; `?explorer` still works) |
| `title` | `accessTitle` | root of the trail |
| `typeColors`, `typeLabels`, `edgeColors`, `knowledgeTypes`, `typeOrder` | — | vocabulary |
| `layout`, `radius`, `tooltip` | — | shape (see below) |
| `modes` | one *full graph* mode | the questions |
| `locale` | the site's Quartz `locale` | wording catalogue: `es` or `en` (language part of the tag); anything else falls back to `en` with a build warning |
| `wording` | `{}` | per-key overrides of the engine wording; an unknown key is a build warning |
| `hud.surfaces` | `"flat"` | `"glass"` blurs the islands; always flat under `prefers-reduced-transparency` |
| `hud.ground` | `"flat"` | `"dots"` draws the ground |
| `hud.tokens` | `{}` | CSS custom properties set on the explorer's stage: `--accent`, `--hud-bg`, `--hud-border`, `--hud-fg`, `--hud-radius`, `--hud-font`, `--hud-mono`, `--dock-w`, … |

`mountSelector` (pre-004) is ignored with a build warning — the layout places the widget;
`backTo` is accepted but no longer shown — the explorer closes in place.

### Wording

Every visible word of the engine — placeholders, chip labels, hints, counts, the widget's
buttons — comes from a catalogue (`lib/i18n.ts`, `es` and `en`). Keys and their English text:

`access.title` Knowledge graph · `access.open` Open the graph · `access.close` Close the
explorer · `access.loading` · `access.stats` `{notes|note|notes} · {edges|typed relation|typed
relations}` · `search.placeholder` Search notes… · `search.placeholder.all` · `search.hint` ·
`scope.this` this graph · `scope.all` all graphs · `results.none` · `results.unavailable`
`Not searched: {graph}` · `results.loading` · `views.back` `‹ {graph}` · `views.about` ·
`mode.full` Full graph · `mode.full.desc` · `filters.types` Types · `filters.edges`
Relations · `filters.all` · `filters.none` · `filters.legend` · `stats` `{nodes|node|nodes} ·
{links|link|links}` · `fit` · `clear` · `trail.back` `Back to {graph}` · `trail.subgraph` ·
`tooltip.incoming` · `tooltip.portal` · `tooltip.portal.hint` · `selection.incoming`
`← {label}` · `selection.explore` Explore subgraph ↘ · `portal.explore` Explore ↘ ·
`portal.enter` `↘ {graph}` · `portal.title` · `dock.open` · `dock.close` · `dock.tab.pin` /
`dock.tab.unpin` / `dock.tab.close` / `dock.tab.temp` · `dock.error` · `dock.missing` ·
`menu.open` · `menu.open.new` · `menu.pin` · `menu.frame` · `menu.copy` · `menu.copied` ·
`cmd.mode` `View: {label}` · `cmd.enter` `Enter {graph}` · `cmd.open` · `cmd.pin` ·
`cmd.explore` · `cmd.close.dock` · `cmd.copy` · `palette.label` · `palette.none` ·
`keyboard.hint` · `focus.missing` · `error.load` · `route.missing`.

Templates use the same syntax as tooltips: `{path}` and `{path|singular|plural}`.

```js
export const explorer = {
  locale: "es",
  wording: { "search.placeholder": "Buscar una nota…", "scope.all": "todo el sitio" },
  hud: { surfaces: "glass", ground: "dots", tokens: { "--accent": "#b3541e" } },
}
```

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
  consumer did not declare them (`display` on the graph root). Selected when the reader
  enters their subgraph, they stay selected inside it.

Inside a subgraph the explorer is the child's: its colours, labels, tooltips and **its own
view modes** replace the consumer's for as long as you stay. The bar's trail reads
`parent › child`, every earlier level returning to that graph (several levels at once), and
the views island starts with `‹ parent`. Entering pushes `graph=<id>` to the browser
history, so the browser's back button also returns to the parent — always with the portal
selected and the previous mode restored. `?explorer&graph=<id>` opens the explorer already
inside a subgraph; the copied graph knows its parent (`federatedFrom`) so the way back still
works.

The *all graphs* scope of the omnibar and `focus=` both walk the graphs the root reaches
through its portals (and their portals), loading each `static/okf-subgraphs/<id>.json` once.

## Layout of the package

```
lib/                 pure decisions, no DOM: model, display, view, style, search, registry,
                     route, focus, hud, i18n, template, viewport, dock, navigation, url-state,
                     commands, spatial-nav, canvas-rules, emit-config — test/*.test.ts (node --test)
src/index.ts         entry: the redirect emitter for /static/explorer, type re-exports
src/components/      OkfExplorer.tsx (SSR: widget + data-cfg), styles/explorer.css (Tailwind v4),
                     scripts/explorer.inline.ts (browser boot: widget, URL, history, mount)
src/hud/             the Preact HUD: state.ts (signals), controller.ts (fetch, navigation),
                     actions.ts (commands, keyboard), canvas/engine.ts (d3, draw loop), components/
tsup.config.ts       esm dist (Preact external) + loaders: *.inline.ts → bundled string,
                     *.css → Tailwind (no preflight, no layers) → string
```

`preact`, `@preact/signals` and the `d3-*` modules are bundled into the browser script at the
plugin's build (`quartz plugin install` runs it); the SSR module only expects Quartz's Preact.

## Input

Reads the `okf-graph/v1` document emitted by `@zetesis/quartz-okf` (`static/okf-graph.json`).
That document already resolves aliases, carries `types`/`edgeLabels` from the profile, marks
`derived` edges and reports `unresolved` ones — the explorer renders it, it does not re-derive
it.
