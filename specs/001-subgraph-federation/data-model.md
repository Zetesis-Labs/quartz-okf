# Data Model: Subgraph portals and open-node federation

**Feature**: `001-subgraph-federation` | **Date**: 2026-08-30

All additions to `okf-graph/v1` are additive (Constitution VII). Field names are
final unless the plan's Constitution Check changes them.

## 1. Consumer configuration (`okf.config.mjs`)

```js
export const federation = {
  subgraphs: [
    {
      id: "it-governance",                    // optional; defaults to the last segment of `node`
      node: "topics/it-governance",           // slug of the portal note in THIS corpus (required)
      graph: "https://cern.zetesis.xyz/static/okf-graph.json", // or "subgraphs/it.json" relative to content/
      site: "https://cern.zetesis.xyz",       // optional if the child graph carries `baseUrl`
      edge: "Contains",                       // default; must be in this corpus' edgeLabels
      preview: { property: "visibility", equals: "open" }, // required
      pin: "92499340c04a0f7db434687d42b37d3286b76b78",       // optional child source_head
    },
  ],
}
```

Wired by the consumer's `okf/quartz.ts`:

```ts
componentRegistry.setOptionOverrides("quartz-okf", { profile, federation })
```

### Validation problems (pure, `validateFederationConfig`)

Each problem is `{ id, code, message }`; any problem fails a strict build.

| code | when |
|---|---|
| `federation/node-required` | entry without `node` |
| `federation/node-unknown` | `node` is not a slug of the parent corpus |
| `federation/graph-required` | entry without `graph` |
| `federation/preview-required` | missing `preview.property` or `preview.equals` |
| `federation/edge-unknown` | `edge` not in `profile.edgeLabels` |
| `federation/id-duplicate` | two entries resolve to the same `id` |
| `federation/site-required` | no `site` and the fetched child graph has no `baseUrl` (checked after fetch) |
| `federation/slug-collision` | a prefixed slug equals an existing parent slug (checked after fetch) |

## 2. Emitted graph additions (`okf-graph/v1`)

### Graph root

```json
{ "baseUrl": "https://cern.zetesis.xyz" }
```

Present in every graph the Quartz emitter writes, derived from
`configuration.baseUrl` (scheme added when absent). Absent when the site has no
`baseUrl`. The exporter (`okf-export`) leaves it absent.

### Portal node marker

```json
{
  "slug": "topics/it-governance",
  "type": "graph",
  "subgraph": {
    "id": "it-governance",
    "title": "CERN IT Governance & Identity",
    "site": "https://cern.zetesis.xyz",
    "graph": "/static/okf-subgraphs/it-governance.json",
    "source_head": "92499340c04a0f7db434687d42b37d3286b76b78",
    "notes": 10,
    "previewed": 3
  }
}
```

`title` is the child graph's `site` field (its title) when present.

### Federated node

```json
{
  "slug": "it-governance:identity/sso-keycloak",
  "title": "CERN SSO (Keycloak)",
  "type": "service",
  "tags": ["identity"],
  "description": "…",
  "path": "identity/sso-keycloak.md",
  "properties": { "visibility": "open", "entorno": "corporate" },
  "federated": "it-governance",
  "url": "https://cern.zetesis.xyz/identity/sso-keycloak"
}
```

`url` is the first use of a per-node `url` in the emitted graph; the explorer
already honours it.

### Edges

```json
{ "source": "topics/it-governance", "target": "it-governance:identity/sso-keycloak",
  "label": "Contains", "iri": "…#contains", "federated": "it-governance" }
{ "source": "it-governance:identity/sso-keycloak", "target": "topics/it-governance",
  "label": "Part of", "iri": "…#part-of", "derived": true, "federated": "it-governance" }
{ "source": "it-governance:identity/sso-keycloak", "target": "it-governance:identity/gms",
  "label": "Authorizes", "federated": "it-governance" }
```

Preserved child edges keep the child's `iri` when present.

### Stats

`stats` gains `federatedNodes` and `federatedEdges` (counts of what federation added);
existing counters are unchanged in meaning and `edges` continues to count every edge.

## 3. Subgraph copy (`static/okf-subgraphs/<id>.json`)

The child graph verbatim, except:

- every node gets `url: "<site>/<slug>"` unless it already has an absolute `url`;
- root gains `federatedFrom: { site: "<parent baseUrl>", node: "<portal slug>" }` so
  the explorer can render the back action even when opened directly.

## 4. Core module contract (`core/lib/federation.js`)

Pure functions; no I/O.

```js
subgraphId(entry) → string                              // entry.id or last segment of entry.node
validateFederationConfig(federation, profile, localSlugs) → Problem[]
federateGraph(graph, children, federation, profile, { subgraphsPath })
   → { graph, subgraphs: [{ id, graph }], problems, warnings }
   // children: { [id]: { graph: childGraph, location } | { error, location } }
absolutiseChildGraph(childGraph, site, parentRef) → childGraphCopy
deriveInverseEdges(edges, profile) → Edge[]            // extracted from buildGraph
```

`federateGraph` re-runs the configuration validation, skips invalid entries and adds
the post-fetch problems (`site-required`, `slug-collision`). `warnings` are
`{ id, code, message }` with codes `federation/pin-drift`, `federation/preview-empty`,
`federation/child-unreachable`. `subgraphs` carries the absolutised copies the shell
writes; an unreachable or invalid child produces none.

## 5. Effectful shell (`plugins/quartz-okf/dist/index.js`)

```js
OkfEmitter({ ..., federation, fetchBundle })
```

`fetchBundle(location, { contentRoot })` defaults to `fetch` for `http(s)` and
`fs.readFile` for paths; injectable for tests. The emitter:

1. validates config → throws in strict mode on problems;
2. fetches every child (parallel), maps failures to problems/warnings;
3. calls `federateGraph`, writes `static/okf-graph.json`;
4. writes `static/okf-subgraphs/<id>.json` per child;
5. logs `[okf] federation: <id> ← <notes> notes, <previewed> previewed (<head>)` per
   subgraph and every warning with its code.
