# Implementation Plan: Materialized catalog pages

**Branch**: `007-materialized-catalog-pages` | **Date**: 2026-09-04 | **Spec**: [spec.md](spec.md)

## Summary

Extend catalog extraction with an optional page column, validate one-to-one bindings in
the functional core, teach resolution and graph construction to coalesce each valid pair,
and keep page URLs correct in panels and federated graphs. Demonstrate the result on one
real HERM capability in Singular Solving.

## Technical Context

**Language/Version**: TypeScript, erasable syntax on Node 22.18+
**Primary Dependencies**: Node test runner; Quartz v5 plugin APIs
**Storage**: Authored Markdown and generated `okf-graph/v1`
**Testing**: `npm test`, `npm run typecheck`, consumer `okf/build-site.sh`
**Target Platform**: Static Quartz sites and exported OKF bundles
**Project Type**: Toolkit plus consumer corpus
**Constraints**: Additive schema, no domain vocabulary, no network in unit tests
**Scale/Scope**: Hundreds of catalog rows and notes per consumer

## Constitution Check

| Gate | Design response |
|---|---|
| I. Git/source and bundle contract | Page and association remain authored Markdown; graph is derived. |
| II. Functional core | Binding validation and identity mapping are pure; emitters only report/write. |
| III. Tests first | Catalog, resolver, rules, graph, federation and panel tests fail before implementation. |
| IV. No vocabulary | `page` is structural; no consumer type or label enters the engine. |
| V. No silent failures | Every invalid binding has an error-by-default `catalog/page-*` rule. |
| VI. Comments | Only non-obvious compatibility constraints receive comments. |
| VII. Additive schema | Only optional `CatalogRow.page` and `RowMarker.page` fields are added. |

## Project Structure

```text
core/lib/catalog.ts                 page-column extraction
core/lib/materialization.ts         pure binding index
core/lib/resolver.ts                page aliases resolve to row identity
core/lib/graph.ts                   node/edge coalescence
core/lib/rules.ts                   corpus-wide diagnostics
core/lib/federation.ts              preserve materialized relative URLs
plugins/quartz-okf-panels/          current page lookup by node URL
plugins/quartz-okf/README.md         public marker and graph contract
harness/fixture/                    vertical smoke case
specs/007-materialized-catalog-pages/
```

**Structure Decision**: materialization is a core identity concern shared by the CLI,
exporter and Quartz emitter; renderer-specific lookup remains in the panels plugin.

## Complexity Tracking

No constitution exceptions.
