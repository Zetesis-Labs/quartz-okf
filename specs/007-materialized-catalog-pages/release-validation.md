# Release validation — 2026-09-08

The existing materialization draft was integrated in an isolated worktree on current main, preserving the original checkout and its staged changes. The original explicit `page=<column>` contract is retained; changing the authoring model is outside this release.

Code review and silent-failure review checked canonical identity, page claims, remapped edges, annotation sources, federation, and panel lookup. Invalid claims retain named diagnostics and fail strict builds. Existing tests cover valid and invalid bindings, alias resolution, annotations and page URLs. No blocking issues remain in the reviewed changes.

Integration exposed one interaction with the newer folder-note URL fix: a materialized folder page still used its authored path. A new regression was observed failing, then fixed by reusing the existing site URL resolver. Both ordinary and materialized folder URLs now retain their expected shape and fragments.

Validation in `zp-front-dev`:

- 328 tests passed, including the new folder-page regression.
- All type checks passed.
- Fixture build and exact graph assertions passed: 11 nodes, 24 edges, zero unresolved references.
- The materialized fixture page now authors a topology edge; the expected graph asserts its canonical row as source and the corresponding inverse edge.
- The consumer preview already verified the AP012 page in the real dock, alongside catalog-fragment focus. Final pinned-consumer validation is recorded with the release delivery.

The bundle documentation now distinguishes physical document indexes from graph entities and explains `row.page` as their mapping. The stale root `SESSION.md` from the original checkout was not included in the release.
