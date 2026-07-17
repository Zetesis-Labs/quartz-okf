# quartz-okf

The **Quartz ↔ [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) integration**: a renderer-independent contract for typed knowledge bundles, plus the Quartz plugins that render them.

OKF (Google Cloud, v0.1) represents knowledge as a directory of markdown files with YAML frontmatter. This toolkit adds a **profile** on top — a closed type vocabulary and prose-native *typed topology edges* — and the tooling to validate it, export a conformant bundle with a machine-readable graph, and render it as a navigable Quartz site.

The reference profile (**Typed Topology**) targets infrastructure, but the machinery is domain-agnostic: a consumer supplies its own vocabulary.

## Layout

```
core/                 @zetesis/okf-core — the renderer-independent contract
├── lib/              validation, resolver, topology parser, graph builder, export
├── bin/              okf-check · okf-export · okf-impact
├── profile.js        the Typed Topology reference profile (types, edge labels, IRIs)
└── test/             unit + characterization tests

plugins/              Quartz v5 plugins
├── quartz-okf/       contract adapter: build-time validation, type index tags,
│                     typed graph + raw markdown export
├── quartz-graph-okf/ graph view: nodes colored by type, edges by relation family,
│                     legends (fork of @quartz-community/graph)
└── quartz-okf-panels/ per-note blast-radius panel from the typed graph

harness/              site build support: content collection, Quartz pin, finalizer
```

## The contract (renderer-independent)

Node ≥ 20, zero runtime dependencies.

```bash
npm test                                    # unit + characterization tests
node core/bin/okf-export.js <repo> <out>    # conformant bundle + okf-graph.json + llms.txt
node core/bin/okf-check.js <out>            # core/profile/hygiene validation, exit 1 on error
node core/bin/okf-impact.js <repo>          # documentation impact plan since last maintained head
```

The export is a conformant OKF v0.1 bundle plus `okf-graph.json` (typed nodes, labeled edges, `unresolved`), `okf-manifest.json`, `llms.txt` and `llms-full.txt`.

## Consuming from a repository

A consumer keeps only its **corpus** (colocated `.md` notes), an optional `okf.config.js` (branding, and in future its own profile), and references this toolkit — the plugins as Quartz `github:` sources, the contract via the build harness. See `harness/` and each plugin's README.

## Status

Extracted from the Mileto GitOps repository, its first consumer. The profile-injection interface (a consumer overriding the reference profile) is being consolidated against that single consumer before a second one adopts it.
