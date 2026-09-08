# Feature Specification: Read notes through static redirects

**Feature Branch**: `009-note-reader-redirects`  
**Created**: 2026-09-08  
**Status**: In progress

## User Scenarios & Testing

### Read a folder note from the graph (P1)

Opening a node whose URL is a Quartz alias must display its destination article in the reading dock. An HTTP-successful HTML redirect is not an empty article.

Acceptance: folder aliases, ordinary notes and fragment links load their content without leaving the graph. Relative destinations resolve against the fetched response URL, including after HTTP redirects.

### Report a broken redirect (P2)

Loops, excessive chains, unsupported destinations and actual HTTP failures remain explicit errors. Failed loads can be retried; aliases cannot start an unbounded fetch loop.

## Requirements

- Follow immediate HTML meta-refresh redirects only when the fetched document has no readable article or center container.
- Preserve an explicitly requested fragment; otherwise retain a redirect fragment.
- Limit redirects to five and to the origin of the fetched page, using HTTP(S).
- Keep the existing page cache and article sanitization; do not execute redirect scripts.
- No graph schema, node identity, corpus content or consumer vocabulary changes.

## Success Criteria

- Regression tests fail before implementation and pass afterward.
- Real consumer folder nodes, a regular note and a catalog fragment render in the dock.
- The complete toolkit test suite and applicable type checks pass.
- Consumer-only requests (free node layout and smaller branding) remain in consumer configuration.
