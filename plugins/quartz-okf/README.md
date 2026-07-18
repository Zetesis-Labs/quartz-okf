---
type: component
title: quartz-okf plugin
description: Thin Quartz adapter over the renderer-independent OKF contract, raw markdown and typed graph exports
tags: [okf, documentation, gitops, fleet]
aliases: [quartz-okf]
---

# quartz-okf

Local Quartz v5 adapter over the shared contract in `okf/lib/`. Validation, topology parsing, resolution and graph construction do not live in this plugin; `okf-check`, `okf-export` and Quartz execute the same implementation.

# Responsibilities

| Capability | Behavior |
|---|---|
| Validation adapter | Converts Quartz files into core documents and reports the shared core/profile/hygiene rules. |
| Type indexes | Injects `type/<type>` tags for Quartz tag pages. |
| Typed graph | Emits `static/okf-graph.json`, including `unresolved` edges. |
| Raw source | Emits `/raw/<slug>.md` and `static/okf-alternates.json`. |
| Alternate discovery | The production build finalizer inserts `<link rel="alternate" type="text/markdown">` into pages that have a raw counterpart. |

# Graph shape

```json
{
  "schema": "okf-graph/v1",
  "okf_version": "0.1",
  "okf_profile": "https://zetesis-labs.github.io/okf/profiles/typed-topology/v1",
  "stats": { "notes": 53, "edges": 88, "unresolvedEdges": 3 },
  "nodes": [
    {
      "slug": "tl-pizarro/pizarro",
      "title": "pizarro — platform cluster",
      "type": "cluster",
      "tags": ["pizarro", "type/cluster"],
      "path": "tl-pizarro/pizarro.md"
    },
    {
      "slug": "px-pitagoras",
      "title": "Pitagoras",
      "type": "node",
      "tags": ["roma", "virtualization"],
      "path": "px-pitagoras/px-pitagoras.md",
      "properties": {
        "node_kind": "physical",
        "os": { "family": "proxmox-ve", "version": "8.4" },
        "hardware": { "architecture": "amd64" }
      }
    }
  ],
  "propertyGroups": [
    {
      "id": "node-platform",
      "label": "Platform",
      "appliesTo": ["node", "router"],
      "fields": [
        { "path": ["node_kind"], "label": "Node kind" },
        { "path": ["os", "family"], "label": "Operating system" }
      ]
    }
  ],
  "edges": [
    {
      "source": "tl-pizarro/pizarro",
      "target": "docs/technologies/talos",
      "label": "Uses",
      "iri": "https://zetesis-labs.github.io/okf/profiles/typed-topology/v1#uses"
    }
  ],
  "unresolved": []
}
```

# Companion renderer

Node coloring and the legend remain in `okf/quartz-graph-okf/`. The companion
panels plugin renders any node `properties` recursively and omits absent fields;
when `propertyGroups` metadata is present it uses the profile-provided section
and field labels. It does not contain profile-specific property names or values.
Renderer-specific interaction work is gated: substantial UI evolution belongs
in a future viewer consuming the stable graph export, not in a deeper
graph-plugin fork.
