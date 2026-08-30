---

description: "Task list for subgraph portals and open-node federation"
---

# Tasks: Subgraph portals and open-node federation

**Input**: Design documents from `/specs/001-subgraph-federation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: MANDATORY in this repository (Constitution III). Every test task is written
and observed failing before its implementation task.

**Organization**: grouped by user story after the shared foundation, so each story is
an independently verifiable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1 (federation at build), US2 (explorer dive), US3 (drift and hard
  failures)

---

## Phase 1: Setup

**Purpose**: give the repository the safety net the methodology assumes.

- [X] T001 Add `.github/workflows/test.yml`: Node 22, `npm install`, `npm test` on
      push and pull_request (package-lock is gitignored, so no `npm ci`).
- [X] T002 [P] Add `plugins/quartz-okf/test/` to the `test` script in `package.json`
      (`node --test core/test/*.test.js harness/test/*.test.js plugins/quartz-okf/test/*.test.js`).
- [X] T003 [P] Document the additive graph fields as "planned" in
      `plugins/quartz-okf/README.md` § Graph shape, so the contract change is visible
      before the code lands.

---

## Phase 2: Foundational (blocking)

**Purpose**: the two engine changes every story depends on.

- [X] T004 Characterization test in `core/test/graph.test.js`: snapshot the exact
      `edges` array (order included) `buildGraph` produces for a fixture with
      declared, mirrored and unmirrored labels.
- [X] T005 Extract `deriveInverseEdges(edges, profile)` into `core/lib/graph.js`,
      call it from `buildGraph`, export it from `core/lib/index.js`; T004 stays green
      unchanged.
- [X] T006 Test in `plugins/quartz-okf/test/emitter.test.js`: with
      `cfg.configuration.baseUrl = "cern.zetesis.xyz"` the written
      `static/okf-graph.json` has `baseUrl: "https://cern.zetesis.xyz"`; with no
      `baseUrl` the field is absent; an already-schemed value is kept.
- [X] T007 Implement `baseUrl` in `emitAll` (`plugins/quartz-okf/dist/index.js`):
      normalise scheme, pass through `buildGraph` options, write it on the graph root.

**Checkpoint**: `npm test` green; inverse derivation reusable; every child built from
here on publishes its origin.

---

## Phase 3: User Story 1 — Publish a portal with its open notes (P1) 🎯 MVP

**Goal**: `federateGraph` and the emitter shell produce the composed graph and the
subgraph copies exactly as `data-model.md` describes.

**Independent Test**: `core/test/federation.test.js` + emitter test with a fixture
child; no Quartz build needed.

### Tests for User Story 1 (write first, watch them fail)

- [X] T008 [P] [US1] `core/test/federation.test.js` — `validateFederationConfig`:
      one test per problem code in data-model §1 (`node-required`, `node-unknown`,
      `graph-required`, `preview-required`, `edge-unknown`, `id-duplicate`); default
      `id` from the last segment of `node`; default `edge` = `Contains`.
- [X] T009 [P] [US1] `federateGraph` — open filter: only nodes whose
      `properties[property] === equals` are added; identifiers prefixed `<id>:<slug>`;
      `federated`, absolute `url` from `site` (config) or child `baseUrl`; child
      `type/title/description/tags/properties` untouched.
- [X] T010 [P] [US1] `federateGraph` — portal marker: `subgraph{id,title,site,graph,
      source_head,notes,previewed}`; `stats.federatedNodes/federatedEdges`; existing
      `stats` values unchanged.
- [X] T011 [P] [US1] `federateGraph` — edges: portal→federated declared with the
      configured label and `federated` tag; inverse derived through the parent's
      `inverseLabels` (via `deriveInverseEdges`); child edges kept only when both ends
      are federated, label and `iri` preserved; nothing added to `unresolved`.
- [X] T012 [P] [US1] `federateGraph` — post-fetch problems: `site-required` when
      neither `site` nor child `baseUrl`; `slug-collision` when a prefixed slug equals a
      parent slug; `preview-empty` warning when no child node matches.
- [X] T013 [P] [US1] `absolutiseChildGraph` — every node gets `url: <site>/<slug>`
      unless already absolute; root gains `federatedFrom{site,node}`; child `subgraph`
      markers are dropped (depth 1); input graph is not mutated.
- [X] T014 [P] [US1] `plugins/quartz-okf/test/emitter.test.js` — with a `federation`
      option and an injected `fetchBundle` returning a fixture: `static/okf-graph.json`
      is the federated graph and `static/okf-subgraphs/<id>.json` is the absolutised
      copy; a relative `graph` path is read from the content root; strict mode throws
      on a config problem with the id in the message; the log line
      `[okf] federation: <id> ← N notes, M previewed (<head>)` is printed.

### Implementation for User Story 1

- [X] T015 [US1] Create `core/lib/federation.js` with `validateFederationConfig`,
      `federateGraph`, `absolutiseChildGraph`; export all from `core/lib/index.js`.
- [X] T016 [US1] Emitter shell in `plugins/quartz-okf/dist/index.js`: `federation`
      and `fetchBundle` options (default: `fetch` for http(s), `fs.readFile` relative
      to the content root otherwise); validate → fetch in parallel → `federateGraph` →
      write graph and copies → log per subgraph and per warning. Strict mode throws
      with `[okf] federation:` prefix and the subgraph id.
- [X] T017 [US1] Update `plugins/quartz-okf/README.md` § Graph shape and add a
      "Federation" section with the config block from `quickstart.md`.

**Checkpoint**: a parent built with a fixture child shows the portal, the previews and
the edges in `okf-graph.json`; the explorer already links previews out (no explorer
change yet).

---

## Phase 4: User Story 2 — Explore a subgraph and come back (P2)

**Goal**: portal rendering, in-place dive, back navigation and federated marks in
`plugins/quartz-okf-explorer/src/assets/explorer.html`.

**Independent Test**: the acceptance walk in `quickstart.md` §3.5 on a consumer
build.

- [X] T018 [US2] `indexar()`: carry `subgraph`, `federated` and the root
      `federatedFrom` into the internal model.
- [X] T019 [US2] Drawing: nodes with `subgraph` go to the `sueltos` path with a double
      ring and always-on label; nodes with `federated` get a dashed outer ring; default
      tooltip for portals `{subgraph.notes} notes · {subgraph.previewed} previewed`
      unless `CFG.tooltip` covers the type.
- [X] T020 [US2] Navigation stack: "Explore subgraph" button in the reading-panel
      header when the active node has `subgraph`; push `{url, selectedId, modeId}`,
      `data = await cargarGrafo(n.subgraph.graph)`, reset mode to the first `"*"` mode,
      rebuild pills, breadcrumb `<parent> › <child>`; **Back** pops, restores mode and
      re-selects the portal.
- [X] T021 [US2] Deep link: `?graph=<id>` loads `/static/okf-subgraphs/<id>.json`
      first and renders a back action from `federatedFrom`.
- [X] T022 [US2] Search results: badge with the subgraph id on federated nodes;
      `buscarNodo` unchanged (prefixed ids already match).
- [X] T023 [US2] `plugins/quartz-okf-explorer/README.md`: document portals, dive,
      back and the deep link.
- [X] T024 [US2] Verify on a consumer build (quickstart §3) and record the walk in
      the PR description; check the Quartz search index ignores graph-only nodes.

**Checkpoint**: US1 + US2 usable end to end on a real site.

---

## Phase 5: User Story 3 — Drift and hard failures (P3)

**Goal**: nothing about a child's state is silent.

### Tests (write first)

- [X] T025 [P] [US3] `core/test/federation.test.js`: `pin` ≠ child `source_head`
      yields a `pin-drift` warning naming id and both heads and no problem; no `pin`
      yields nothing and the marker still records the head.
- [X] T026 [P] [US3] `plugins/quartz-okf/test/emitter.test.js`: `fetchBundle`
      rejecting → strict throws naming id and location; non-strict writes the portal
      with `previewed: 0`, no subgraph copy, and logs a `child-unreachable` warning.

### Implementation

- [X] T027 [US3] Drift warning in `federateGraph`; unreachable-child handling in the
      emitter shell; warnings always logged with their code.

**Checkpoint**: every failure path of FR-008/FR-009 has a test with the id in the
message (SC-002).

---

## Phase 6: Adoption

**Purpose**: ship to the consumers; the toolkit is done when a consumer builds with
it.

- [ ] T028 Cut the toolkit commit(s) per scope (`feat(core)`, `feat(quartz-okf)`,
      `feat(quartz-okf-explorer)`, `ci:`), open the PR, merge after CI.
- [ ] T029 (done locally on branch feat/federation-open-notes, not pushed) Child consumer `cern-it-governance-graph`: bump `okf/quartz-okf.ref`
      (publishes `baseUrl: https://cern.zetesis.xyz`), add the `visibility`
      propertyGroup (quickstart §4) and mark the open notes — the topic hubs and the
      services a CERN-wide reader would want to see first (SSO, WLCG IAM, OC5, the IT
      department); rebuild; confirm `baseUrl` and the `visibility` property in
      `public/static/okf-graph.json`; push (deploys via Cloudflare Pages).
- [ ] T030 (repo created locally at ~/Developer/cern-graph, ref still local-dev, not on GitHub) New parent consumer `Zetesis-Labs/cern-graph` (public, MIT), created from
      the `cern-it-governance-graph` skeleton (`okf/`, `quartz/static` with D3,
      `quartz.config.yaml`, deploy workflow): a small umbrella corpus — CERN as
      organisation, Council, the sectors, the IT department — with a portal note
      `type: graph` for IT governance; `federation` block pointing at
      `https://cern.zetesis.xyz/static/okf-graph.json` with
      `preview: { property: "visibility", equals: "open" }`; `quartz.ts` passes
      `federation` through; build with `okf/build-site.sh`, read the
      `[okf] federation:` and `[okf] knowledge graph:` lines, run the acceptance walk
      (quickstart §3.5). Public exposure follows the house rule for own domains
      (Caddy on colon + grey-cloud A record + probe), not the orange proxy.
- [ ] T031 `PAFE-Portal/wiki`: bump ref inside its devcontainer, rebuild, confirm the
      graph line is unchanged (no federation declared yet, no regression).
- [X] T032 [P] `docs/METHODOLOGY.md`: add the consumer adoption recipe (ref bump →
      config → build → log line) as the worked example.

---

## Dependencies & Execution Order

- **Phase 1** → **Phase 2** → **Phase 3 (US1)** → **Phase 4 (US2)** and **Phase 5
  (US3)** in either order → **Phase 6**.
- Within a phase, `[P]` tasks touch different files and can run together; test tasks
  precede the implementation task they cover.
- US2 depends on US1 only for a real graph to render; its explorer work can start
  against a hand-written `okf-graph.json` fixture.

## Parallel Example: User Story 1

```bash
# Tests first, together (different describe blocks, same two files):
T008 T009 T010 T011 T012 T013   → core/test/federation.test.js
T014                            → plugins/quartz-okf/test/emitter.test.js
# Then the implementation, sequentially: T015 → T016 → T017
```

## Implementation Strategy

MVP = Phases 1–3: a parent site whose graph composes a child's open notes with
working links. Phase 4 makes it explorable in place; Phase 5 closes the failure
paths; Phase 6 is what the feature is for.
