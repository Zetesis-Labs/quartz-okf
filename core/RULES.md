---
type: concept
title: OKF validation rules
description: Rule identifiers, default severities and configuration model for the OKF contract
tags: [documentation, gitops, fleet]
---

# Rule levels

Every rule has one of three levels: `off`, `warn` or `error`. Defaults live in `okf/profile.js`. The CLI can override a rule for one run:

```bash
node okf/bin/okf-check.js <bundle> --rule hygiene/title-recommended=off
```

# Core rules

Core rules implement OKF v0.1 bundle conformance.

| Rule | Default | Meaning |
|---|---:|---|
| `core/frontmatter-parse` | error | Concept frontmatter must parse. |
| `core/type-required` | error | Every non-reserved concept has a non-empty `type`. |
| `core/index-frontmatter` | error | Only the bundle-root `index.md` may contain frontmatter. |
| `core/log-frontmatter` | error | `log.md` has no frontmatter. |
| `core/log-date` | error | Log date headings use `YYYY-MM-DD`. |

# Typed Topology profile rules

These rules constrain what a consumer produces; they do not change permissive OKF consumer behavior.

| Rule | Default | Meaning |
|---|---:|---|
| `profile/type-closed` | error | `type` belongs to the 14-value profile vocabulary. |
| `profile/folder-note-alias` | error | A folder note owns its bare folder-name alias. |
| `profile/edge-label-closed` | warn | A topology edge uses one of the 15 profile labels. |

# Hygiene rules

| Rule | Default | Meaning |
|---|---:|---|
| `hygiene/title-recommended` | warn | Concepts should have a human-readable title. |
| `hygiene/description-recommended` | warn | Concepts should have a one-line description. |
| `hygiene/tags-shape` | warn | Tags are a YAML list of lowercase kebab-case strings. |
| `hygiene/unresolved-edge` | off | An unresolved topology target is intentional pending knowledge. |
| `hygiene/redundant-inverse` | warn | A relation is declared on both endpoints; declare it once — the mirror is derived. |
| `hygiene/knowledge-edges-recommended` | warn | A knowledge note (concept, decision, incident, runbook, report) should link its subjects with `About`/`Affects`. |

# Catalog rules

Catalog rules validate tables marked with `<!-- okf:rows … -->`. They are errors by
default so strict builds never publish a partial or ambiguous catalog.

| Rule | Default | Meaning |
|---|---:|---|
| `catalog/marker-invalid` | error | The marker is malformed, names an unknown key, or combines incompatible keys. |
| `catalog/table-missing` | error | No Markdown table follows the marker. |
| `catalog/type-missing` | error | A creating catalog has no row type. |
| `catalog/column-unknown` | error | A configured id, label, description, property or page column is absent. |
| `catalog/id-empty` | error | A creating row has no identifier. |
| `catalog/id-duplicate` | error | Two rows in one note produce the same identifier. |
| `catalog/pattern-invalid` | error | The identifier extraction pattern is invalid or lacks an `id` group. |
| `catalog/pattern-nomatch` | error | A row's identifier cell does not match the declared pattern. |
| `catalog/anchor-collision` | error | A row anchor collides with another row or heading in the note. |
| `catalog/edge-required` | error | An annotating (`ref`) catalog declares no edge from its note. |
| `catalog/ref-unresolved` | error | An annotation row reaches no existing node. |
| `catalog/property-conflict` | error | Two annotations assign different values to the same node property. |
| `catalog/page-multiple` | error | A materialized-page cell names more than one target. |
| `catalog/page-unresolved` | error | A materialized-page target reaches no unambiguous note. |
| `catalog/page-duplicate` | error | One physical page is claimed by more than one row. |
| `catalog/page-self` | error | A row tries to use its containing catalog note as its page. |
| `catalog/page-type-conflict` | error | A materialized page's type differs from the row type. |

Consumer profiles may add stable rule identifiers and severities through
declarative `propertyGroups` plus `ruleLevels`. The core executes those rules
without owning their domain vocabulary.

# Derived inverse edges

Relations are declared once, on whichever note owns the knowledge. The graph
derives the mirrored edge (`derived: true` in `okf-graph.json`) for the label
pairs `Part of`/`Contains`, `Runs on`/`Hosts`, `Uses`/`Consumed by` and the
symmetric `Peers with`. Labels without a mirror (`Member of`, `Depends on`,
`Backed by`, `State in`, `Watches`, `Reached via`, `About`, `Affects`) surface
on the target through inbound-edge views.
