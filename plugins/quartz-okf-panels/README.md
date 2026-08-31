# @zetesis/quartz-okf-panels

The per-note panel of the OKF graph: the note's typed relations, what points back at it,
the knowledge attached to it, and the property groups its profile declares. It reads the
graph the toolkit emits (`static/okf-graph.json`), so it says exactly what the graph says.

## In the site

```yaml
# quartz.config.yaml
- source: ./quartz-okf-panels
  enabled: true
  layout:
    position: right
    priority: 60
    condition: not-index
```

## Options

| Option | Default | Meaning |
|---|---|---|
| `locale` | the site's Quartz `locale` | wording catalogue: `es` or `en` (the language part of the tag); anything else falls back to `en` with a build warning |
| `wording` | `{}` | per-key overrides; an unknown key is a build warning |

```ts
componentRegistry.setOptionOverrides("quartz-okf-panels", {
  wording: { "panel.title": "Impacto" },
})
```

### Wording

Five keys, and the panel renders nothing else of its own: `panel.title` (Blast radius),
`panel.relations` (Relations), `panel.referenced` (Referenced by), `panel.knowledge`
(Related knowledge), `panel.properties` (the fallback heading of a property group that
declares no label).

The words are resolved when the page is built and travel to the browser in the panel's
`data-okf-panels`, so the client script carries no wording of its own. Until this existed,
three consumers translated the panel by rewriting this plugin's source at build time — a
string that moved by one character sent the panel back to English without a word.

## What it draws

Relations are grouped by label and split in three: what this note declares, what declares
it (skipping the labels whose mirror the toolkit already derives, so nothing is listed
twice), and the knowledge notes that point at it. Property groups come from the profile:
each declares the fields it reads and the note shows the ones it filled in.
