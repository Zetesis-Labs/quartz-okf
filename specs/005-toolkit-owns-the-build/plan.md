# 005 — Plan

## Constitution check

| Principle | How this feature satisfies it |
|---|---|
| I. Git is the source of truth; bundles are the contract | The build reads the corpus from git and writes a derived site. `okf build` publishes `OKF_SOURCE_HEAD` for every consumer, so the derived graph names the commit it came from — today only two consumers did. No new authored state. |
| II. Functional core, effectful shell | The recipe is a pure function: `buildPlan(layout) → Step[]`. The steps are data (copy, remove, run); `core/lib/cli/okf-build.ts` executes them. The check is the same shape: the shell gathers `SiteFacts` from disk, `verifySite(facts, floors)` decides. Both cores are tested without a filesystem. |
| III. Tests first, vertical (non-negotiable) | `core/test/build-plan.test.ts` and `core/test/verify.test.ts` are written before the modules, from the recipes the five consumers run today. The vertical gate is the smoke build in CI (US3). |
| IV. The engine ships no vocabulary | The plan knows the toolkit's own plugins and Quartz's layout — never a consumer's name, corpus or step. Consumer-specific work is a command the consumer declares. |
| V. No silent failures | A failing hook fails the build naming the seam and the command. `okf verify` reports every problem, not the first. A toolkit without `okf-federate` warns by name instead of silently emitting no subgraph — the failure mode that already cost a CERN build. |
| VI. Comments only for a non-obvious why | The steps are named; the code says what it does. |
| VII. Compatibility by pinning; additive schemas | `build` is a new optional key of `okf.config.*`; a consumer without one gets the standard recipe. A consumer pinned to an older SHA keeps its own bash and is unaffected. |

No violations to justify.

## Structure

```
core/lib/build-plan.ts        pure: layout + config → ordered steps
core/lib/verify.ts            pure: site facts + floors → problems
core/lib/cli/okf-build.ts     shell: probe, plan, execute, verify
core/lib/cli/okf-verify.ts    shell: gather facts, report
core/bin/okf-build.js         floor shim
core/bin/okf-verify.js        floor shim
core/lib/types.ts             BuildConfig, Seam on OkfConfig
harness/collect-content.sh    prune ./public (collecting the build output is always a bug)
harness/fixture/              the corpus CI builds
.github/workflows/test.yml    the smoke job
```

## Order of implementation

1. **The check first.** `verify.ts` + its CLI is small, is the part every consumer
   duplicates in YAML, and gives the smoke build something to assert. Ship it and adopt
   it in the five workflows before touching any build.
2. **The plan.** Characterisation tests describing what the five recipes do today, then
   `build-plan.ts` and the executor. The gate is per consumer: build with the old script,
   build with `okf build`, compare the two `public/` trees.
3. **The fixture and CI.** A corpus that exercises the contract, built and verified on
   every pull request, asserting the graph it must produce.
4. **The consumers.** Simple ones first (perennialismo, marketing), then the CERN
   (federation), PAFE (hooks, inside its devcontainer) and Singular Solving (every seam).

## Risks

| Risk | Mitigation |
|---|---|
| A migrated consumer builds a subtly different site | The per-consumer gate is a diff of the two built trees, not a green build |
| Hooks become a second recipe language | Five named seams, each one a seam that already exists in a consumer's bash; a command is a string, run by the shell, with a documented environment |
| The smoke build makes CI slow or flaky | The fixture pins the same Quartz the consumers pin and caches it by SHA; it is a separate job, so the unit gate stays fast |
| `--serve` and the devcontainer | `okf build` keeps the same outward contract as the scripts it replaces: same cache root, same output directory |
