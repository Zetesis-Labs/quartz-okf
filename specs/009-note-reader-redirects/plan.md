# Implementation Plan: Read notes through static redirects

**Branch**: `009-note-reader-redirects` | **Date**: 2026-09-08

## Summary

The reader uses fetch, which follows HTTP redirects but not Quartz HTML meta-refresh aliases. Resolve bounded redirect chains using an injected page reader, then retain the existing extraction, sanitization and fragment focus.

## Technical Context

TypeScript with Node native type stripping; browser DOMParser and fetch at the controller boundary. No new runtime dependencies. Pure URL decisions and bounded traversal in `plugins/quartz-okf-explorer/lib/note-page.ts`; regression coverage in its plugin test directory.

## Constitution Check

- Git/source remain authoritative; no graph schema changes.
- URL decisions and traversal have injected I/O; DOM and network remain in the controller.
- Tests are authored and observed failing before implementation.
- No consumer names, types or labels enter the toolkit.
- Invalid redirects and network failures throw named errors, shown by the existing dock error UI.
- Work is isolated on its own branch; existing materialization work is preserved.
- Validate using a real consumer build before proposing a pin change. Build/type checks run in the existing devcontainer.

## Validation

Characterize ordinary reads and failure/retry; regress aliases, response-relative targets, fragments, cycles, hop bound and forbidden targets. Verify the actual consumer through its browser UI and audit every generated node URL and fragment. Inspect the restored free layout and reduced logo.
