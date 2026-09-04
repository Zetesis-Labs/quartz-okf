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
- Node `label`: short text the canvas draws when the title is too long to be a name.
  Absent when it would repeat the title.
- Node `row`: `{ note, anchor }` — this node is a row of a catalog table, so it lives
  inside that note's page and its `url` carries the anchor (see Catalog rows).
- `stats.rows`: how many nodes are catalog rows. `notes` keeps counting every node.

# Catalog rows

A note may hold a table whose rows are the real entities — a standard's catalogue, a
register, an inventory. Marking the table turns every row into a node addressed inside
the page, `<note-slug>#<anchor>`:

```markdown
---
okf_rows: { id: Code, label: Name }
---

<!-- okf:rows type=component properties="Gloss=gloss" -->

| Code | Name | Gloss | Uses |
|---|---|---|---|
| AC001 | Reader recruitment | Brings readers in. | [[tools/quartz]] |
```

The marker sits on the line above the table (blank lines allowed) and takes
`type`, `id`, `ref`, `label`, `description`, `properties` (`Header` or `Header=key`,
comma-separated), `pattern` (a regular expression over the identifier cell with named
groups `id` and optional `label`) and `edge`. Note-wide defaults go in the frontmatter's
`okf_rows` as one inline mapping; a marker's key wins over them.

Edges come from three places: every row is `Part of` its note unless the table says
`edge=none` or another label; clauses after the keys apply to every row of the table
(`<!-- okf:rows type=component edge=none; Part of: [[AP001]] -->`); and a column whose
header is one of the profile's `edgeLabels` declares that row's own edges.

A table that declares `ref` instead of `id` annotates nodes declared elsewhere: its rows
resolve to existing nodes, their `properties` are merged in, and the annotating note gains
an edge (`edge` is required) to each. Creation is processed before annotation, corpus-wide.

Identity: `anchor` is the GitHub heading slug of the id — the same one Quartz derives for
`[[note#ID]]` — so a wikilink with a fragment reaches the row, the rendered `<tr>` carries
`id="<anchor>"` and `data-okf-node="<slug>"`, and the bare id is registered as an alias
(unresolved, naming every candidate, when two catalogs claim it).

Problems are rules named after the table and row they come from, `error` by default:
`catalog/marker-invalid`, `table-missing`, `type-missing`, `column-unknown`, `id-empty`,
`id-duplicate`, `pattern-invalid`, `pattern-nomatch`, `anchor-collision`, `edge-required`,
`ref-unresolved`, `property-conflict`. Row types and edge labels are checked against the
consumer's profile like any other (`profile/type-closed`, `profile/edge-label-closed`).

# Federation

A site may declare that one of its notes stands for another corpus and **mount** that
corpus — its notes and its graph — inside itself at build time. Composition is a
code-level matter: a corpus is a directory with an `okf.config.*` and a `content/`
tree, and where it comes from is a detail of its **source** — a `path` in the same
code, or a git `repo` at a pinned `ref`. The child is exported with the toolkit and
placed under `content/<id>/`; its *open* notes are previewed around the portal, and the
explorer enters the whole child graph in place. Nothing at runtime depends on the
child's own site. Bundles produced by `okf-export` stay per-corpus; federation is a
property of the rendered site.

```ts
// okf.config.ts (or .mjs)
import type { OkfConfig } from "<toolkit>/core/lib/types.ts"

export const federation = {
  subgraphs: [
    {
      node: "topics/it-governance",                          // portal note of THIS corpus
      path: "subgraphs/it-governance",                       // a corpus in this repository…
      preview: { property: "visibility", equals: "open" },  // which child notes to preview
      // id: "it-governance",   defaults to the last segment of `node`; the mount is /<id>/
      // content: "content",    the child's corpus directory
      // edge: "Contains",      must be one of this corpus' edgeLabels
    },
    {
      node: "topics/accelerators",
      repo: "https://github.com/example/accelerators-graph", // …or a git repository
      ref: "011e3ead8614a541d45bea96664c47cfee5fd060",       // at a commit (required with repo)
      preview: { property: "visibility", equals: "open" },
    },
  ],
}
export default { federation } satisfies OkfConfig
```

Exactly one of `path` / `repo` per entry. A local path written in `repo` (the earlier
spelling) still works and means `path`. Only git sources have drift: `ref-drift` and
`ref-behind` never apply to a path.

```ts
// okf/quartz.ts
componentRegistry.setOptionOverrides("quartz-okf", { profile, federation })
```

Two steps, both run by the site's `build-site.sh`:

1. **`okf-federate <repo> <content-dir> <artifacts-dir> [--cache <dir>]`** (core CLI),
   before Quartz: takes each child from its source — a `path` as is, a git `repo`
   cloned at `ref` into the cache — runs `okf-export` on its corpus with the child's
   own profile, fails if the child does not pass its own validation, writes the notes
   under `<content-dir>/<id>/` (bundle links rewritten inside the mount, frontmatter
   marked `okf_federated: <id>`, an index page generated) and the child graph plus a
   `manifest.json` under `<artifacts-dir>/` — with the `source` (`{ kind: "path", path }`
   resolved, or `{ kind: "git", repo, ref }`), the child's head (for a path, the head
   of the repository the directory belongs to; none outside any repository), the
   remote head (git only) and the display part of its explorer configuration.
2. **The emitter**, during the build: validates the declaration
   (`federation/node-unknown`, `source-required`, `source-ambiguous`, `ref-required`,
   `edge-unknown`, `preview-required`, `id-duplicate`, `mount-collision` — all fatal in
   strict mode),
   skips mounted notes for its own validation and graph, reads the artifacts, marks the
   portal (`subgraph{ id, title, site, mount, graph, source_head, notes, previewed }`),
   adds the open notes as `<id>/<slug>` with `url: /<id>/<slug>`, declares
   `portal → note` edges (inverse derived), keeps the child's edges between open notes,
   publishes the union of the children's display as `display` on the graph root, and
   writes the child graph with same-origin URLs and its `display` to
   `static/okf-subgraphs/<id>.json`. Missing artifacts fail a strict build pointing at
   `okf-federate`; otherwise the portal is emitted empty with a
   `federation/child-unreachable` warning. Empty previews, a mounted head that differs
   from `ref` (`ref-drift`) and a remote that moved on (`ref-behind`) are warnings.

The child only needs to project the property the parent filters on through a
`propertyGroup`; it does not even need to be deployed.

# Companion renderer

Node coloring and the legend remain in `okf/quartz-graph-okf/`. The companion
panels plugin renders any node `properties` recursively and omits absent fields;
when `propertyGroups` metadata is present it uses the profile-provided section
and field labels. It does not contain profile-specific property names or values.
Renderer-specific interaction work is gated: substantial UI evolution belongs
in a future viewer consuming the stable graph export, not in a deeper
graph-plugin fork.
