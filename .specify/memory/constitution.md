<!--
SYNC IMPACT REPORT
==================
Version change: (template) → 1.0.0
Rationale: initial ratification. Captures the rules this toolkit has followed
implicitly since its extraction from the Mileto GitOps repository, plus the
methodology adopted on 2026-08-30 (Spec Kit as the working system).

Principles added: I–VII (all new).
Sections added: Development Workflow, Quality Gates, Governance.
Templates reviewed:
✅ .specify/templates/plan-template.md — Constitution Check is generic; aligned.
✅ .specify/templates/spec-template.md — no mandatory-section changes.
✅ .specify/templates/tasks-template.md — tests are OPTIONAL there; Principle III
   overrides that: test tasks are mandatory in every tasks.md of this repo.
Deferred TODOs: none.
-->

# quartz-okf Constitution

quartz-okf is the Quartz ↔ Open Knowledge Format integration: a renderer-independent
contract (`core/`), Quartz plugins that render it (`plugins/`) and a build harness
(`harness/`). Consumers — one repository per corpus — pin the toolkit by commit SHA
and supply their own vocabulary through `okf.config.mjs`. Every spec, plan and task
in this repository MUST comply with this constitution or propose an amendment.

## Core Principles

### I. Git Is the Source of Truth; Bundles Are the Contract

A corpus is a directory of markdown notes in a git repository. Nothing the toolkit
produces is authoritative: `okf-graph.json`, the bundle, the rendered site and any
derived store (search index, database, federated view) MUST be regenerable from the
notes at a given `source_head`. A derived store MAY hold only (a) data derived from
bundles or (b) transient data that is written back to git as a commit. A second
writer of authored content is a constitution violation, not a design choice.

The exchange format between corpora and tools is the bundle, and the machine-readable
graph inside it is `okf-graph/v1`. Anything that composes several corpora (federation,
ingestion) consumes bundles; it never parses another repository's markdown.

### II. Functional Core, Effectful Shell

Decisions live in pure functions under `core/lib/` that take documents, graphs and
configuration and return values or problem lists. Filesystem, git, network and Quartz
context live in the shells: `core/bin/*`, `core/lib/exporter.js`, the plugin emitters.
Effects needed by core logic (fetching a bundle, reading the clock) are injected as
functions so tests exercise the core without touching the world. Prefer composition of
functions over inheritance.

### III. Tests First, Vertical (NON-NEGOTIABLE)

Every new behavior starts as a failing test in `core/test/` (or the plugin's `test/`),
written and observed failing before the implementation. Before refactoring existing
behavior, a characterization test pins the current output. The suite runs with
`npm test` (`node --test`), needs no network and no built artifacts, and is green
on `main` at all times. A task list in this repository always contains test tasks;
the "tests are optional" clause of the Spec Kit template does not apply here.

### IV. The Engine Ships No Vocabulary

Node types, edge labels, inverses, colors, view modes, radii, tooltips and wording are
declared by the consumer in `okf.config.mjs` and executed by the engine as data. Core
and plugin code MUST NOT name a consumer, a domain or a specific type or label — not
in logic, not in defaults, not in comments. When a feature needs to single out a node
(a portal, a root, an aggregator) it does so through a property the consumer declares
or a marker the engine derives, never through a hardcoded type name.

### V. No Silent Failures

In strict mode a violation is a build error with a message naming the file, rule and
item. Warnings are explicit and actionable. Empty catches, swallowed promise
rejections, fallbacks that hide a missing input and `off`-by-default rules that mask
real problems are forbidden. Degrading gracefully is allowed only when the degradation
is logged at `warn` level and the output states what is missing.

### VI. Comments Only for a Non-Obvious Why

Code carries no narrative comments: no "what the next line does", no provenance, no
justification aimed at a reviewer. When a block needs explanation, extract a function
with a name that explains it. A comment is allowed only to state a constraint the code
cannot show — a browser quirk, an upstream bug, a contract with a consumer — in one or
two lines, in the language of the surrounding file.

### VII. Compatibility by Pinning; Additive Schemas

Consumers pin the toolkit by SHA (`okf/quartz-okf.ref`) and the toolkit pins Quartz by
SHA (`harness/quartz.ref`); a consumer moves forward by bumping a ref, never by
tracking a branch. Changes to `okf-graph/v1` are additive: new node or graph fields
MAY be added, existing fields and their meaning MUST NOT change. A breaking change
bumps the schema identifier and is a MAJOR event announced in the release notes.
Plugin option surfaces follow the same rule: new options with safe defaults, no
renamed or repurposed options.

## Development Workflow

- **Spec-driven**: work enters as a feature under `specs/NNN-name/` following the Spec
  Kit flow — `/speckit-specify` → (optional `/speckit-clarify`) → `/speckit-plan` →
  `/speckit-tasks` → `/speckit-implement`. `docs/METHODOLOGY.md` is the public
  description of this flow; this constitution is its binding version.
- **Branches**: one feature branch per spec, named `NNN-short-name`, rebased on `main`
  (never merged from it).
- **Commits**: Conventional Commits with the package directory as scope —
  `feat(core): …`, `fix(quartz-okf-explorer): …`, `docs(harness): …`, `test(core): …`.
  Multi-package changes are separate commits per scope.
- **Consumer validation**: any change to the plugins or the harness is verified on a
  real consumer build before the ref bump is proposed: run the consumer's
  `okf/build-site.sh` against the candidate SHA and read the
  `[okf] knowledge graph: N typed notes, M edges` line.
- **Language**: source comments and docs follow the language of the file they touch;
  spec artifacts under `specs/` and this constitution are written in English.

## Quality Gates

A change is ready for `main` when all of the following hold:

1. `npm test` is green locally and in CI.
2. New behavior is covered by tests written before the implementation (Principle III).
3. No consumer, domain, type or label name was introduced into engine code (IV).
4. Every new failure path either throws in strict mode or logs a named warning (V).
5. `okf-graph/v1` changes are additive and documented in `plugins/quartz-okf/README.md`
   under "Graph shape" (VII).
6. Plugin or harness changes were verified on a consumer build (Development Workflow).

## Governance

This constitution supersedes any other practice document in the repository. An
amendment is a pull request that edits this file, bumps the version (MAJOR for a
redefined or removed principle, MINOR for a new principle or section, PATCH for
wording) and updates the Sync Impact Report at the top. The `plan.md` of every feature
carries a Constitution Check that names the gates it passes and justifies, in
Complexity Tracking, any it does not.

**Version**: 1.0.0 | **Ratified**: 2026-08-30 | **Last Amended**: 2026-08-30
