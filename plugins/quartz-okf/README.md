---
type: component
title: quartz-okf plugin
description: Thin Quartz adapter over the renderer-independent OKF contract, raw markdown and typed graph exports
tags: [okf, documentation, gitops, fleet]
aliases: [quartz-okf]
---

# quartz-okf

Local Quartz v5 adapter over the shared contract in `okf/lib/`. Validation, topology parsing, resolution and graph construction do not live in this plugin; `okf-check`, `okf-export` and Quartz execute the same implementation.

# Responsibilities

| Capability | Behavior |
|---|---|
| Validation adapter | Converts Quartz files into core documents and reports the shared core/profile/hygiene rules. |
| Type indexes | Injects `type/<type>` tags for Quartz tag pages. |
| Typed graph | Emits `static/okf-graph.json`, including `unresolved` edges. |
| Raw source | Emits `/raw/<slug>.md` and `static/okf-alternates.json`. |
| Alternate discovery | The production build finalizer inserts `<link rel="alternate" type="text/markdown">` into pages that have a raw counterpart. |

# Graph shape

```json
{
  "schema": "okf-graph/v1",
  "okf_version": "0.1",
  "okf_profile": "https://zetesis-labs.github.io/okf/profiles/typed-topology/v1",
  "stats": { "notes": 53, "edges": 88, "unresolvedEdges": 3 },
  "nodes": [
    {
      "slug": "tl-pizarro/pizarro",
      "title": "pizarro — platform cluster",
      "type": "cluster",
      "tags": ["pizarro", "type/cluster"],
      "path": "tl-pizarro/pizarro.md"
    },
    {
      "slug": "services/example",
      "title": "Example service",
      "type": "service",
      "tags": ["example"],
      "path": "services/example.md",
      "properties": {
        "runtime": { "tier": "edge" }
      }
    }
  ],
  "propertyGroups": [
    {
      "id": "service-runtime",
      "label": "Runtime",
      "appliesTo": ["service"],
      "fields": [
        { "path": ["runtime", "tier"], "label": "Service tier" }
      ]
    }
  ],
  "edges": [
    {
      "source": "tl-pizarro/pizarro",
      "target": "docs/technologies/talos",
      "label": "Uses",
      "iri": "https://zetesis-labs.github.io/okf/profiles/typed-topology/v1#uses"
    }
  ],
  "unresolved": []
}
```

## Additive fields since 0.1

- Graph root `baseUrl`: the site's canonical origin (`https://…`), taken from Quartz
  `configuration.baseUrl`. Absent when the site declares none. Lets other corpora
  address this one's notes without extra configuration.
- Node `subgraph` (portal to another corpus, see Federation):
  `{ id, title, site, graph, source_head, notes, previewed }`.
- Node `federated` + `url`: a note copied from another corpus' graph, namespaced as
  `<id>:<child-slug>`, addressed absolutely on the child's site.
- Edge `federated`: the edge was added by federation (portal edges and preserved child
  edges); `derived` keeps its meaning.
- `stats.federatedNodes` / `stats.federatedEdges`: what federation added. `notes` and
  `edges` keep counting everything.

# Federation

A site may declare that one of its notes stands for another published corpus and
compose that corpus' *open* notes into its own graph at build time. Bundles produced
by `okf-export` stay per-corpus; federation is a property of the rendered site.

```js
// okf.config.mjs
export const federation = {
  subgraphs: [
    {
      node: "topics/it-governance",                              // portal note of THIS corpus
      graph: "https://cern.zetesis.xyz/static/okf-graph.json",  // or a path relative to content/
      preview: { property: "visibility", equals: "open" },      // which child notes to show
      // id: "it-governance",    defaults to the last segment of `node`
      // site: "https://…",      defaults to the child graph's baseUrl
      // edge: "Contains",       must be one of this corpus' edgeLabels
      // pin: "<source_head>",   warns when the child moved on
    },
  ],
}
```

```ts
// okf/quartz.ts
componentRegistry.setOptionOverrides("quartz-okf", { profile, federation })
```

The emitter fetches each child graph (`fetchBundle` is injectable), validates the
declaration (`federation/node-unknown`, `edge-unknown`, `preview-required`,
`id-duplicate`, `site-required`, `slug-collision` — all fatal in strict mode), marks
the portal node, adds the open child notes with namespaced slugs and absolute URLs,
declares `portal → note` edges with the configured label (inverse derived), keeps the
child's edges between two open notes, and republishes the whole child graph
same-origin at `static/okf-subgraphs/<id>.json` for the explorer to dive into. An
unreachable child fails a strict build; otherwise the portal is emitted empty with a
`federation/child-unreachable` warning. Empty previews and pin drift are warnings.

The child only needs to publish `baseUrl` (automatic) and project the property the
parent filters on through a `propertyGroup`.

# Companion renderer

Node coloring and the legend remain in `okf/quartz-graph-okf/`. The companion
panels plugin renders any node `properties` recursively and omits absent fields;
when `propertyGroups` metadata is present it uses the profile-provided section
and field labels. It does not contain profile-specific property names or values.
Renderer-specific interaction work is gated: substantial UI evolution belongs
in a future viewer consuming the stable graph export, not in a deeper
graph-plugin fork.
