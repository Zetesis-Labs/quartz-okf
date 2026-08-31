# 005 — Tasks

## Phase 1 — The check (FR-009 … FR-012)

- [ ] T001 `core/test/verify.test.ts`: the floors, the missing graph, the graph without
      edges, an explorer asset referenced and not emitted, a page without the component,
      every problem reported at once.
- [ ] T002 `core/lib/verify.ts`: `SiteFacts`, `VerifyFloors`, `verifySite`.
- [ ] T003 `core/lib/types.ts`: `BuildConfig` with `verify`, hung off `OkfConfig`.
- [ ] T004 `core/lib/cli/okf-verify.ts` + `core/bin/okf-verify.js`: gather the facts from
      a built site, report, exit 1 on any problem.
- [ ] T005 The five consumers' workflows call `okf verify` instead of their inline check.

## Phase 2 — The plan (FR-001 … FR-008)

- [ ] T006 `core/test/build-plan.test.ts`: the standard recipe; the corpus from a
      directory and from the sweep; federation declared and not; each seam in order; a
      toolkit without `okf-federate`.
- [ ] T007 `core/lib/build-plan.ts`: `Step`, `Seam`, `BuildLayout`, `buildPlan`.
- [ ] T008 `core/lib/cli/okf-build.ts` + `core/bin/okf-build.js`: probe the layout,
      execute the steps, publish `OKF_SOURCE_HEAD`, verify at the end.
- [ ] T009 `harness/collect-content.sh`: prune `./public`.
- [ ] T010 `plugins/quartz-okf/README.md` and the toolkit's `CLAUDE.md`: the recipe and
      the seams are the toolkit's, and where they are declared.

## Phase 3 — The fixture and CI (FR-013 … FR-015)

- [ ] T011 `harness/fixture/`: corpus, `okf.config.mjs`, `quartz.config.yaml`, `quartz.ts`.
- [ ] T012 `harness/test/fixture.test.ts`: the fixture's expected graph, asserted from
      the exporter without building a site (fast gate).
- [ ] T013 `.github/workflows/test.yml`: a `smoke` job that runs `okf build` on the
      fixture and `okf verify` on the result, with the Quartz cache keyed by SHA.

## Phase 4 — The consumers (SC-001 … SC-003)

- [ ] T014 `perennialismo-graph`: bootstrap-only `build-site.sh`; diff the trees.
- [ ] T015 `zetesis-marketing-graph`: idem.
- [ ] T016 `cern-graph`: idem, with federation, `_redirects` and the badge as hooks.
- [ ] T017 `PAFE-Portal/wiki`: idem, index generators as `prepare`, panels patch as
      `assemble`; built inside its devcontainer.
- [ ] T018 `singular-solving-propuesta`: idem, every seam.
