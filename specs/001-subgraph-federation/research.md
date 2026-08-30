# Research: Subgraph portals and open-node federation

**Feature**: `001-subgraph-federation` | **Date**: 2026-08-30

Findings from reading the toolkit at `main` (5af76bd) and its two active consumers
(`cern-it-governance-graph`, `PAFE-Portal/wiki`, both pinned to 9249934).

## What already exists

- **Multi-graph loading in the explorer**. A view mode may declare `graph`, and
  `explorer.html` fetches it lazily and caches it (`grafoDe`, `CACHE_GRAFOS`,
  `cargarGrafo`, mode change handler around line 1040, `activarModo`). The dive into a
  subgraph reuses this machinery with a node instead of a mode as the trigger.
- **Per-node `url` honoured by the explorer**. `indexar()` reads `n.url || "/" + id`;
  the reading panel (`showPeek`) and modifier-click use it as is. Federated nodes with
  absolute URLs need no explorer change to be clickable.
- **Properties projected from frontmatter**. `propertyGroups` in the consumer profile
  project authored fields into `node.properties`; the open filter reads one of these
  (e.g. `visibility`) without the engine knowing its name.
- **Radius and colour per type** (`radius.byType`, `typeColors`), so a consumer can
  already make a portal note visually distinct with configuration alone.
- **Inverse derivation** lives inline in `buildGraph` (`core/lib/graph.js` 99–118);
  federation needs the same derivation for its edges.

## Corrections to earlier assumptions

- **`site` in `okf-graph/v1` is a title, not a URL.** The Quartz emitter fills it with
  `cfg.configuration.pageTitle` and the exporter with `branding.site` ("CERN IT
  Governance & Identity"). Absolute URLs for federated nodes therefore need a new
  input: the child's canonical origin. Decision: add `baseUrl` to the emitted graph
  (from Quartz `configuration.baseUrl`, e.g. `cern.zetesis.xyz`, normalised to
  `https://…`) and let the federation config override it with `site`.
- **The explorer plugin is built by the consumer, not shipped built.**
  `plugins/quartz-okf-explorer/dist/` is gitignored; `quartz plugin install
  --from-config` runs the package's `prepare` (`tsup`) inside the consumer's Quartz
  cache. Changes to `src/assets/explorer.html` and `src/index.ts` are enough; no dist
  to commit. `plugins/quartz-okf/dist/index.js`, on the other hand, IS the source
  (plain JS, committed).

## Decisions

### D1. Federation is a site-build composition; bundles stay per-corpus

`okf-export` keeps producing one unfederated bundle per repository. Federation runs in
the Quartz emitter (`OkfEmitter`) because that is where a *site* is assembled and where
the child graph must be copied to be same-origin. **Rejected**: federating inside
`exportBundle` — it would make a bundle depend on other repositories' state and break
Principle I (a bundle regenerable from its own notes).

### D2. The portal is identified by configuration, not by type

`federation.subgraphs[].node` names the portal note by slug. The engine marks it with a
`subgraph` object in the emitted graph; the explorer keys its behaviour on that marker.
No type name appears in engine code (Principle IV). Consumers are advised, in docs, to
model portals with a dedicated type (e.g. `graph`) for colour and radius.

### D3. Namespacing with `<id>:<child-slug>`

A child slug can coincide with a parent slug; the colon cannot appear in a Quartz slug,
so the prefixed identifier never collides with a local note. Explorer lookups
(`clavesDe`, `buscarNodo`, `?focus=`) compare lowercased identifiers and keep working.
**Rejected**: `<id>/<slug>` — a legal path in the parent corpus, so collisions would be
silent.

### D4. Open filter = one property equality

`preview: { property: "visibility", equals: "open" }`, read from the child node's
`properties` (which the child projects through its own `propertyGroups`). Simple,
declarative, and mirrors how modes already colour by property. **Rejected**: filtering
by tag (tags are free-form, no validation in the child) and by type (too coarse).

### D5. Edges

- Portal → federated: declared with the configured label (default `Contains`), inverse
  derived through the parent's `inverseLabels`. The label must exist in the parent's
  `edgeLabels`; otherwise strict build error.
- Child edges between two open notes: preserved, both ends prefixed, label kept even if
  the parent's vocabulary lacks it (the explorer assigns palette colours to unknown
  labels; the panels render any label). Edges reaching a closed note are dropped.

To reuse the derivation, `deriveInverseEdges(edges, profile)` is extracted from
`buildGraph` behind a characterization test; `buildGraph` output is byte-identical
before and after.

### D6. Fetching and copying the child

At emit time the child graph is fetched (`https://…` via injected `fetch`, or read from
a path relative to the content root for monorepos and tests). It is written to
`static/okf-subgraphs/<id>.json` with every node `url` absolutised to the child site so
the explorer can swap it in without CORS. Fetch failure: strict → error naming id and
location; non-strict → warning, portal emitted with `previewed: 0`.

### D7. Drift

`pin` (child `source_head`) is optional; mismatch is a warning, never an error. The
child's actual `source_head` is always recorded on the portal marker. The rebuild
coupling is accepted for v1; removing it is the database-ingest follow-up.

### D8. Explorer behaviour

- Portal nodes: drawn in the `sueltos` path (already used for special states) with a
  double ring and always-on label; tooltip second line from a built-in template
  `{subgraph.notes} notes · {subgraph.previewed} previewed` unless the consumer's
  `tooltip` overrides it.
- Dive: a button in the reading panel header ("Explore subgraph") calls
  `cargarGrafo(n.subgraph.graph)`, pushes `{url, selectedId, mode}` on a navigation
  stack, resets mode pills to the generic full view (the child's modes are not known to
  the parent) and renders the breadcrumb `<parent title> › <child title>`. Back pops the
  stack and re-selects the portal.
- Federated nodes: same fill as their type, dashed outer ring; search results carry the
  subgraph id as a small badge. `?graph=<id>` opens the explorer already inside a child.

### D9. Out of scope (recorded so they are not re-litigated)

- Nested federation (depth > 1).
- Parent topology edges to federated nodes (`[[id:slug]]`).
- Private child sites (auth at fetch time).
- Database-backed federation — proposed as `002-bundle-ingest` with SurrealDB server
  as the candidate store; git stays the source of truth and the store is rebuildable
  from bundles (Principle I).

## Consumer impact

| Consumer | Ref today | Role | Change needed |
|---|---|---|---|
| `cern-it-governance-graph` | 9249934 | first child | bump ref (publishes `baseUrl`); add a `visibility` propertyGroup and mark the open notes |
| `cern-graph` (new, decided 2026-08-30) | — | first parent | new umbrella repo from the child's skeleton: `graph` type + portal note + `federation` block + one line in `okf/quartz.ts` |
| `PAFE-Portal/wiki` | 9249934 | later | bump ref only at first; builds inside its devcontainer |

Both consumers copy `okf/quartz.ts` from their own repo, so the new config block is
wired there: `componentRegistry.setOptionOverrides("quartz-okf", { profile, federation })`.
