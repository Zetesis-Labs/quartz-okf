# Feature Specification: TypeScript across the toolkit, with composition in the model

**Feature Branch**: `003-typescript-toolkit`  
**Created**: 2026-08-31  
**Status**: Draft  
**Input**: User description: "Refactor everything to TypeScript and Preact first, so
the toolkit is functional, and do it with the composition paradigm in mind: composing
subgraphs is a code-level matter — a corpus *can* be split into repositories, it does
not *have* to be, and for CERN it will not be. One stack: Quartz is Preact, so Preact."

This specification covers the language move and the composition model. The explorer as
a Preact component is the next feature (`004-explorer-preact`) and depends on this one;
the consolidation of the CERN corpora into one repository is consumer work that follows
004. Nothing here changes what a site looks like.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One language, checked, with no build step in the way (Priority: P1)

A maintainer opens any module of the toolkit — the contract in `core/lib`, a CLI in
`core/bin`, the harness, a Quartz plugin — and finds TypeScript with real types for the
bundle, the profile and the configuration. They change a function, `npm test` runs the
suite as it always has (`node --test`, no bundler, no transpile step, no network), and
`tsc --noEmit` tells them where the change breaks a contract. A consumer rebuilds its
site with the new toolkit and gets the same site.

**Why this priority**: it is the base of everything that follows. Types are what make
the explorer rewrite (004) and the composition model (US2) cheap and honest; a build
step between the source and the tests would erode Principle III (tests first, run
directly) and Principle I (git is the source, not an artifact).

**Independent Test**: with every source file under `core/`, `harness/` and
`plugins/*` renamed and typed, `npm test` and `tsc --noEmit` are green on Node 22 and
24; a consumer build from the tarball of the branch emits an `okf-graph.json` equal to
the one of the previous toolkit, apart from `source_head`.

**Acceptance Scenarios**:

1. **Given** the migrated toolkit, **When** `npm test` runs on Node ≥ 22.18, **Then**
   every existing test passes unchanged in its assertions and no build directory is
   produced.
2. **Given** a module that uses non-erasable TypeScript syntax (`enum`, `namespace`,
   parameter properties), **When** the quality gate runs, **Then** it fails naming the
   file and the construct, before any consumer sees a runtime syntax error.
3. **Given** a consumer whose build runs on Node 20, **When** any `core/bin` CLI starts,
   **Then** it exits with a message naming the required floor (`node >= 22.18`) instead
   of an unreadable syntax error.
4. **Given** `cern-it-governance-graph` and `PAFE-Portal/wiki` pinned to the branch head,
   **When** `./okf/build-site.sh` runs, **Then** the build succeeds with the same
   `[okf] knowledge graph: N typed notes, M edges` line as before and the same nodes and
   edges in `okf-graph.json`.

---

### User Story 2 - Composition is a code-level matter (Priority: P1)

A corpus author keeps the CERN organisation graph and the IT governance graph in one
repository: the umbrella corpus at the root and the IT corpus under
`subgraphs/it-governance/`, each with its own `okf.config` and `content/`. The umbrella
declares the subgraph by **path**; nothing is cloned, nothing is pinned, and the drift
warnings of a git source do not apply. Later, if the IT team takes its graph to a
repository of its own, the author changes the source to `repo` + `ref` and nothing
else: same portal, same previews, same mounted pages.

**Why this priority**: it is the paradigm the user asked for. 001 already mounts a local
directory, but its vocabulary (`repo`, `ref`) says "another repository" and its model
has no name for "a corpus that lives here". The model must say what the composition
is: a site composes corpora, and where a corpus comes from is a detail of the source.

**Independent Test**: a fixture parent with a child corpus in a subdirectory builds with
the child mounted and previewed, with no `ref` and no `ref-drift`/`ref-behind`
warning; the same fixture with the child in a temporary git repository behaves as in
001; the manifest names the kind of source of each mount.

**Acceptance Scenarios**:

1. **Given** `federation.subgraphs[0] = { node, path: "subgraphs/it-governance", preview,
   edge }`, **When** the site is built, **Then** the child is exported from that
   directory with its own profile, mounted at `/<id>/`, previewed around the portal, and
   the mount manifest records `source: { kind: "path", path }` and the parent's own head.
2. **Given** the same entry with `repo` (git URL) and `ref`, **When** the site is built,
   **Then** the behaviour of 001 is preserved: clone at `ref`, `ref-drift` / `ref-behind`
   warnings, `source: { kind: "git", repo, ref }` in the manifest.
3. **Given** an entry with neither `path` nor `repo`, or with both, **When** the config
   is validated, **Then** a named problem (`federation/source-required`,
   `federation/source-ambiguous`) says so; `ref` is required only with `repo`.
4. **Given** a 001 consumer whose entry uses `repo: "../local-dir"` (a local path in
   `repo`), **When** it builds, **Then** it still works and the manifest records it as a
   `path` source — the old spelling is accepted, not a second concept.
5. **Given** a child corpus whose configuration is `okf.config.ts`, **When** it is
   mounted (by path or by git), **Then** its profile and display are read exactly as
   from `okf.config.mjs`.

---

### User Story 3 - The plugins share one build path (Priority: P2)

A maintainer of a Quartz plugin of the toolkit (`quartz-okf`, `quartz-okf-explorer`,
`quartz-okf-panels`, `quartz-graph-okf`) finds the same shape in each: TypeScript source
under `src/`, a tsup build run by `prepare` when a consumer installs the plugin, and no
generated file committed. The plugin that today ships its `dist/index.js` as the source
(`quartz-okf`) joins that shape.

**Why this priority**: 004 rewrites the explorer as a component plugin; it should not
inherit two packaging conventions. It is P2 because a consumer sees no difference.

**Independent Test**: `git ls-files plugins/*/dist` is empty; each plugin builds with
`npm run build`; a consumer build installs and builds all four through
`quartz plugin install`.

**Acceptance Scenarios**:

1. **Given** the migrated `quartz-okf` plugin, **When** a consumer runs
   `./okf/build-site.sh`, **Then** `quartz plugin install` builds it from `src/` and the
   site is emitted as before.
2. **Given** a TypeScript error in any plugin's `src/`, **When** the toolkit's CI runs,
   **Then** it fails there — not in the first consumer that installs the tarball.

---

### User Story 4 - Types are the contract (Priority: P2)

A consumer writes `okf.config.ts` instead of `okf.config.mjs`, annotates it with the
toolkit's `OkfConfig` type and gets an error on a misspelt key or an edge label that is
not a string, before building. The explorer plugin, the panels and the exporter read the
bundle through one `OkfGraph` type; nobody redeclares the shape of a node.

**Why this priority**: the shape of `okf-graph/v1` and of the consumer configuration is
currently implicit in four places (exporter, federation, explorer emitter, explorer
shell). One declaration, exported from `core/`, is what makes the rest of the refactor
safe.

**Independent Test**: a fixture `okf.config.ts` with a wrong key fails `tsc`; the four
plugins import their types from `core/` and declare none of their own for the bundle.

**Acceptance Scenarios**:

1. **Given** `export default { … } satisfies OkfConfig` in a consumer, **When** a
   `profile.types` entry is not a string, **Then** `tsc` reports it at that line.
2. **Given** the toolkit, **When** one greps for interface declarations of `OkfNode`,
   `OkfEdge`, `OkfGraph`, `Profile`, `Federation`, `Display`, **Then** each is declared
   exactly once, under `core/`.

---

### Edge Cases

- A consumer builds on a Node older than 22.18: the CLIs refuse with the floor named
  (US1-3); the harness prints the same message before calling them.
- A child corpus mounted by path whose directory has no `okf.config.*`: the mount fails
  naming the directory and the expected file names (strict) or is skipped with the
  warning (non-strict), as 001 does for a missing bundle.
- A `path` that escapes the parent repository (`../elsewhere`): accepted — the
  paradigm is "same code", not "same directory" — but the manifest records the resolved
  absolute path and the parent's head is not claimed for it (no `head` field).
- A `.ts` module importing another without the `.ts` extension: Node's ESM resolver
  rejects it at runtime; the quality gate (`tsc` with `rewriteRelativeImportExtensions`
  off and `allowImportingTsExtensions` on) catches it first.
- A plugin's tsup build emitting `.d.ts` that references `core/` types: the types are
  bundled into the plugin's declarations, so a consumer never needs `core/` on its
  type path.

## Clarifications

### Session 2026-08-31

- Q: Consolidate the CERN repositories first, or refactor first? → A: **Refactor
  first**, validated from day one against the single-repository layout (umbrella at the
  root, `subgraphs/it-governance/` mounted by path); the GitHub rename and the deletion
  of the day-old `cern-graph` repository happen at the end, with the new toolkit.
- Q: SolidJS for the HUD islands? → A: **No.** One stack: Quartz is Preact, so Preact.
  No second runtime, no standalone page, no iframe, no `postMessage` between parts of
  the same site (this decides 004; recorded here because it shaped this spec).
- Q: Where do the types live? → A: **In `core/`**, exported; plugins and consumers
  import them. No duplicated interfaces in plugin entry points.
- Q: Build step for the tests? → A: **None.** Node ≥ 22.18 strips types natively;
  erasable syntax only. Verified on Node 22.22 (`node --test` on a `.mts`); the
  consumers' CI runs Node 22, the PAFE wiki image is `node:22-slim`, its devcontainer
  Node 24.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every source module under `core/`, `harness/` and `plugins/*` (including
  tests and fixtures with code) MUST be TypeScript. `core/bin` CLIs and the test suite
  MUST run through Node's native type stripping — no transpile, no bundle, no
  `tsx`-style loader — using erasable syntax only.
- **FR-002**: The toolkit MUST declare `engines.node >= 22.18` and an `.nvmrc`; CI MUST
  run the suite on Node 22 and 24. Each `core/bin` CLI and the harness MUST check the
  running Node before importing any `.ts` module and exit with a message naming the
  floor when it is older.
- **FR-003**: The quality gate MUST include `tsc --noEmit` with `strict`, erasable-only
  syntax enforcement and explicit `.ts` import extensions, run in CI next to `npm test`.
- **FR-004**: The migration MUST be behaviour-preserving: every test of the current
  suite keeps its assertions; a consumer build with the new toolkit MUST emit the same
  `okf-graph.json` (nodes, edges, display, federation) as with the previous pin, apart
  from `source_head`. The tests of 002's `lib/` join the suite when 004 lands.
- **FR-005**: The composition model MUST be explicit in the configuration: a
  `federation.subgraphs[]` entry names its **source** as `path` (a corpus directory,
  resolved from the parent corpus root) or `repo` + `ref` (a git repository at a
  commit). Exactly one of `path` / `repo` MUST be present; `ref` MUST be required only
  with `repo`. Validation problems MUST be named (`federation/source-required`,
  `federation/source-ambiguous`, `federation/ref-required`).
- **FR-006**: A local path given in `repo` (001 spelling) MUST keep working and be
  treated as a `path` source; no second concept, no warning.
- **FR-007**: Drift warnings (`ref-drift`, `ref-behind`) MUST apply to git sources only.
  A path source MUST record, in the mount manifest and the emitted graph, the parent's
  own head as the child's head when the path is inside the parent repository.
- **FR-008**: The mount manifest MUST record, per subgraph, `source: { kind: "path",
  path } | { kind: "git", repo, ref }` in addition to what 001 records. Additive.
- **FR-009**: A corpus configuration MAY be `okf.config.ts`, resolved before
  `okf.config.mjs` and `okf.config.js`, for the root corpus and for mounted children.
- **FR-010**: The types of the bundle (`okf-graph/v1`: graph, node, edge, display,
  subgraph and federated markers) and of the consumer configuration (`Profile`,
  `Federation`, `Explorer`, `Branding`, the whole `OkfConfig`) MUST be declared once,
  under `core/`, and exported for plugins and consumers. Plugin entry points MUST NOT
  redeclare them.
- **FR-011**: `plugins/quartz-okf` MUST move to TypeScript source under `src/` with a
  tsup build run by `prepare`, like the other three plugins; `dist/` MUST NOT be
  committed for any plugin. The four plugins MUST share one base `tsconfig`.
- **FR-012**: Types MUST NOT carry consumer vocabulary: node types, edge labels,
  property names and mode identifiers are `string`, never unions of a consumer's values
  (Principle IV).
- **FR-013**: Documentation MUST follow: `README.md` and `CLAUDE.md` of the toolkit (Node
  floor, "TypeScript runs directly", where the types live, the trap about committed
  `dist` removed), `plugins/quartz-okf/README.md` § configuration (`path` source,
  `okf.config.ts`), `docs/METHODOLOGY.md` if the quality gates change.
- **FR-014**: Out of scope: the explorer's HUD and its component rewrite (004); the
  consolidation of the CERN repositories; JSON Schema generation from the types (a
  candidate follow-up once the types exist).

### Key Entities

- **Corpus**: a directory with an `okf.config.(ts|mjs|js)` and a `content/` tree; the
  unit of composition. The root corpus of a site and every mounted child are corpora.
- **Corpus source**: where a corpus comes from — `path` (a directory reachable from the
  parent's root) or `git` (`repo` at `ref`). Only git sources have drift.
- **Site**: a root corpus plus its mounts (`federation.subgraphs[]`); the build composes
  them into one Quartz site and one federated graph.
- **Bundle** (`okf-graph/v1`): the emitted graph; its type is the contract every plugin
  reads.
- **Profile / Display / Explorer options**: the consumer's vocabulary and presentation;
  typed, never enumerated by the engine.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `git ls-files 'core/**/*.js' 'core/**/*.mjs' 'harness/**/*.js'
  'plugins/*/src/**/*.js' 'plugins/*/lib/**/*.js' 'plugins/*/test/**/*.js'` lists nothing;
  `git ls-files 'plugins/*/dist/**'` lists nothing.
- **SC-002**: `npm test` and `tsc --noEmit` are green on Node 22 and 24 in CI, with no
  build step before the tests; the suite still needs no network.
- **SC-003**: `cern-it-governance-graph` (as the single-repository layout) and
  `PAFE-Portal/wiki` build from the branch tarball and emit the same nodes and edges as
  with their previous pin.
- **SC-004**: A path-sourced subgraph builds without `ref` and without drift warnings; a
  git-sourced one keeps every 001 test green; both are covered by tests that need no
  network.
- **SC-005**: A consumer `okf.config.ts` with a wrong key fails `tsc` at that line; the
  bundle and configuration types are declared exactly once.
- **SC-006**: A `core/bin` CLI on Node 20 exits naming the floor, exercised by a test
  that fakes the version.

## Assumptions

- Node ≥ 22.18 is available wherever the toolkit runs: verified for both CERN
  repositories' CI (Node 22), the PAFE wiki image (`node:22-slim`), the PAFE devcontainer
  (Node 24) and the maintainer's machine (nvm 22.22.3). Consumers pin by SHA and adopt at
  their pace.
- Node's native type stripping is used as shipped in 22.18+ (no flags); the
  constructs it rejects are excluded by the gate, not by convention.
- Quartz v5's plugin loader consumes the tsup output of each plugin; nothing in Quartz
  needs to change.
- The explorer's current sources (`src/hud/main.js`, `src/assets/*`) are migrated only
  as far as 004 needs them; 004 replaces the shell, so this feature does not polish it.
- `okf.config.ts` in a consumer is imported by Node directly; consumers that want type
  checking add `tsc` to their own build.

## Dependencies and follow-ups

- Follows 001 (merged into `main`); 002 stays as a draft reference for 004.
- **004 `explorer-preact`**: the explorer as a Quartz component plugin in Preact +
  TypeScript, composed in-page like `quartz-okf-panels`; supersedes 002.
- **CERN consolidation** (consumer work, after 004): rename `cern-it-governance-graph` →
  `cern-graph`, delete the day-old `cern-graph` repository, umbrella at the root,
  `subgraphs/it-governance/` mounted by path, `_redirects` for the moved note paths.
