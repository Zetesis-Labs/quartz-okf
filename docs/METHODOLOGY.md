# Methodology

How work happens in this repository and in the corpora that consume it. The binding
version of these rules is `.specify/memory/constitution.md`; this page is the
readable one.

## Three layers, one direction

```
notes in git  ──export──▶  bundle (okf-graph/v1)  ──render/ingest──▶  site · store · federation
   truth                      contract                                   derived, rebuildable
```

- **Notes in git are the only source of truth.** Everything downstream is regenerable
  from the notes at a recorded `source_head`.
- **The bundle is the contract.** Tools that combine corpora — a parent site
  federating a child, an ingester filling a database — consume published bundles,
  never another repository's markdown.
- **Derived stores hold nothing authored.** A database or index may hold what bundles
  contain, or transient state that is written back to git as a commit. Two writers of
  authored content is a design error.

## Spec-driven work

Features enter through [Spec Kit](https://github.com/github/spec-kit). The scaffolding
lives in `.specify/` (templates, scripts) and `.claude/skills/` (the `/speckit-*`
skills for Claude Code); each feature lives in `specs/NNN-name/`.

| Step | Skill | Output |
|---|---|---|
| 1. Specify | `/speckit-specify` | `spec.md`: user stories with priorities, acceptance scenarios, requirements, success criteria, assumptions |
| 2. Clarify (optional) | `/speckit-clarify` | resolved `[NEEDS CLARIFICATION]` markers |
| 3. Plan | `/speckit-plan` | `plan.md` with a Constitution Check, plus `research.md`, `data-model.md`, `quickstart.md` |
| 4. Tasks | `/speckit-tasks` | `tasks.md`: ordered, test-first, grouped by story |
| 5. Analyze (optional) | `/speckit-analyze` | cross-artifact consistency report |
| 6. Implement | `/speckit-implement` | code, on the feature branch, one conventional commit per scope |

The first feature written this way is `specs/001-subgraph-federation/`; use it as the
reference for depth and tone.

## Tests first, vertical

Every behavior starts as a failing test under `core/test/` or the plugin's `test/`,
run with `npm test` (`node --test` on the TypeScript sources, no network, no build
step: Node ≥ 22.18 strips the types natively, so only erasable syntax is allowed).
Refactors of existing behavior start with a characterization test that pins the
current output. `npm run typecheck` (`tsc --noEmit`, strict) is the second gate over
the source modules; the tests themselves are checked by the runtime that runs them. CI
runs both on Node 22 and 24 on every push and pull request.

## Functional core, effectful shell

Decisions are pure functions in `core/lib/` over documents, graphs and configuration.
Filesystem, git, network and the Quartz build context stay in `core/bin/`,
`core/lib/exporter.js` and the plugin emitters, and are injected into the core as
functions when the core needs them.

## The engine ships no vocabulary

Types, edge labels, inverses, colours, modes, radii and wording come from the
consumer's `okf.config.mjs`. Engine code never names a consumer, a domain, a type or
a label; when a feature must single out a node it does so through a consumer-declared
property or an engine-derived marker.

## Consumers and pinning

A consumer repository keeps its corpus (`content/`), its vocabulary
(`okf.config.mjs`), a thin `okf/` directory (`build-site.sh`, `quartz.ts`,
`quartz-okf.ref`) and nothing of the engine. It pins this toolkit by commit SHA in
`okf/quartz-okf.ref`; the toolkit pins Quartz in `harness/quartz.ref`.

Adopting a toolkit change is always the same recipe:

1. bump `okf/quartz-okf.ref` to the new SHA;
2. add whatever configuration the feature introduces to `okf.config.mjs` (and pass it
   through in `okf/quartz.ts` if it is a new block);
3. run `okf/build-site.sh` and read the `[okf] knowledge graph: N typed notes, M edges`
   line — and any feature-specific line — before pushing.

Consumer builds compile the TypeScript plugins themselves (`quartz plugin install`
runs each package's `prepare`), so the toolkit commits sources, not `dist/`, for those
packages. `plugins/quartz-okf/dist/index.js` is plain JavaScript and is the source.

## Commits and branches

Conventional Commits with the package directory as scope: `feat(core)`,
`fix(quartz-okf-explorer)`, `docs(harness)`, `test(core)`, `ci:`. One feature branch
per spec named `NNN-short-name`, rebased on `main`. Multi-package changes are split
into one commit per scope.
