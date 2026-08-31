# Data model: 003-typescript-toolkit

Nothing here changes a document a consumer already has; every field is additive.

## Consumer configuration (`okf.config.ts` | `.mjs` | `.js`)

```ts
import type { OkfConfig } from "<toolkit>/core/lib/types.ts"

export const branding = { site: "CERN", bundleTitle: "…", indexTitle: "…" }
export const profile = { types: [...], edgeLabels: [...], inverseLabels: {...}, propertyGroups: [...], ruleLevels: {...} }
export const explorer = { title: "…", typeColors: {...}, modes: [...] }
export const federation = {
  subgraphs: [
    // a corpus that lives in this code
    { node: "topics/it-governance", path: "subgraphs/it-governance", preview: { property: "visibility", equals: "open" }, edge: "Contains" },
    // a corpus in another repository, at a commit
    { node: "topics/accelerators", repo: "https://github.com/org/accelerators-graph", ref: "3f2a…", preview: { property: "visibility", equals: "open" } },
  ],
}
export default { branding, profile, explorer, federation } satisfies OkfConfig
```

`SubgraphEntry` (config, as written):

| Field | Type | Rule |
|---|---|---|
| `node` | string | slug of the portal note in this corpus (001) |
| `path` | string? | corpus directory, resolved from the corpus root; **exactly one of `path` / `repo`** |
| `repo` | string? | git URL, or (001 spelling) a local path — normalised to `path` |
| `ref` | string? | required with a git `repo`; forbidden meaningless with `path` (ignored, no problem) |
| `content` | string? | corpus directory inside the source, default `content` (001) |
| `preview` | `{ property, equals }` | which child notes are previewed (001) |
| `edge` | string? | portal edge label, default `Contains` (001) |

Validation problems (all named, all tested): `federation/source-required`,
`federation/source-ambiguous`, `federation/ref-required` (git only) — plus 001's
`node-required`, `node-unknown`, `preview-required`, `edge-unknown`, `mount-collision`,
`id-collision`. `repo-required` is superseded by `source-required`.

## `CorpusSource` (normalised, in the model)

```ts
type CorpusSource =
  | { kind: "path"; path: string }                 // as written; resolved by the shell
  | { kind: "git"; repo: string; ref: string }
```

`sourceOf(entry): { source: CorpusSource | null; problems: Problem[] }` — pure.

## Mount manifest (`okf-federation/manifest.json`), per subgraph

001 fields kept: `id`, `node`, `repo`, `ref`, `head`, `remoteHead`, `mount`, `display`,
`notes`. Added:

| Field | Type | When |
|---|---|---|
| `source` | `CorpusSource` | always; for a path source the `path` is the resolved absolute directory |
| `head` | string | git source: the checked-out head (001); path source: the head of the repository the directory belongs to (the parent's when inside it, its own when it is a checkout); absent outside any repository |
| `remoteHead` | string | git source only (001) |

`repo`/`ref` are kept as written for 001 readers; `source` is the model.

## Emitted graph (`okf-graph/v1`)

Unchanged in shape. Types declared once in `core/lib/types.ts`:

- `OkfGraph { schema, site?, baseUrl?, source_head?, generated_at?, profile, stats: OkfStats, display?: Display, federatedFrom?: FederatedFrom, nodes: OkfNode[], edges: OkfEdge[] }`
- `OkfNode { id, slug, title, type, url?, description?, tags?, properties?, sources?, subgraph?: SubgraphMarker, federated?: string }`
- `OkfEdge { source, target, label, derived?: boolean }`
- `SubgraphMarker { id, mount, graph, notes, previewed }`
- `Display { typeColors?, typeLabels?, edgeColors?, typeOrder?, knowledgeTypes?, radius?, tooltip?, modes? }`
- `Profile`, `PropertyGroup`, `Branding`, `ExplorerOptions`, `ExplorerMode`, `Federation`, `SubgraphEntry`, `OkfConfig`

Field names are exactly those the exporter writes today; the types are derived by
reading `exporter.ts`, `graph.ts`, `federation.ts` and the explorer emitter, and pinned
by the existing tests (a type that disagrees with a test fails `tsc` on the test).

## Node floor

`checkFloor(version: string): string | null` — returns the problem
(`quartz-okf needs Node >= 22.18 (found 20.18.3): …`) or `null`. Called by every CLI
shim; a non-null result is printed and the process exits 1.
