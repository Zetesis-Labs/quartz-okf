# Quickstart: Give a catalog row a page

Add a page column to an `id` catalog:

```markdown
<!-- okf:rows type=control id=ID label=Name page=Ficha -->

| ID | Name | Ficha |
|---|---|---|
| CIS-01 | Inventory | [[controls/inventory]] |
| CIS-02 | Software | |
```

The linked file must be an authored, non-reserved note with the same `type` as the row.
It may have a longer title and description and declares topology normally. The first row
remains `catalog#cis-01` in the graph but opens `/controls/inventory`; the second keeps
opening its catalog fragment.

Do not link a related report, decision or implementation plan as the page. Those are
separate graph entities and should use a typed edge. The page is valid only when it is
another representation of the row itself.
