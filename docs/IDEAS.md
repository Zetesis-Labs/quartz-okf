# Ideas

Things worth building that are not features yet. An entry earns its place by naming a
problem someone actually hit, with the evidence that proves it; a feature earns its place
by becoming `specs/NNN-name/`. An idea nobody has hit twice is allowed to wait here, and
an idea that turns out to be wrong is deleted rather than argued with.

---

## One entity, two corpora: identity across a federation

**Raised**: 2026-09-07, from the CERN graph. **Status**: open, not scheduled.

### What happens

A reader of `cern.zetesis.xyz` sees two nodes for the same real thing:

| Node | Corpus | Drawn as |
|---|---|---|
| `units/it-department` — "IT department" | the parent's own | a plain node |
| `it-governance/it-department/it-department` — "IT Department" | the mounted child | a dashed ring, on loan |

Both are typed `unit` and both are about the department that runs CERN's computing. They
carry different knowledge: the parent's says where the department sits in the
organisation, and the child's says what it operates. Nothing links them, so the reader
meets the same thing twice and each half of what is known about it is on a different node.

### Why it is not a bug

Federation mounts a child's graph under a prefix and keeps every slug distinct. That is
deliberate: two notes in two repositories are two independent claims, and merging them
would need a rule for which one wins. The toolkit has no such rule, and inventing one
silently would put authored knowledge in the hands of the engine (Constitution I).

### The cheap way out, available today

The consumer stops publishing one of the two notes, usually the parent's, and lets the
child's be the only one. It costs nothing and it is the right answer when the parent's
note only existed as a stub pointing at the child. It is the wrong answer when the two
corpora genuinely know different things and both are maintained.

### What the feature would be

Let a corpus declare that one of its nodes *is* a node of a child it federates, and have
the graph publish one node carrying both sets of relations.

Constraints any design has to respect:

- **The declaration is authored, never inferred.** Matching by title, by slug tail or by
  type would guess, and a wrong guess merges two things that are not the same. The 007
  discussion of materialized pages reached the same conclusion for rows and pages.
- **One side owns identity.** Whichever slug survives is what every existing link, bundle
  and federated graph already points at, so it cannot be chosen per build.
- **The bundle is the contract.** A parent consumes the child's published bundle, so the
  merge happens when mounting, in `core/lib/federation.ts`, not by reading the child's
  markdown.
- **Additive schema.** `okf-graph/v1` may gain a field naming the absorbed slug; existing
  fields keep their meaning (Constitution VII).
- **Federation is one-way.** The child knows nothing of the parent, so the declaration
  lives in the parent's `federation` block, next to `preview` and `edge`.

Open questions, in the order they would need answering:

1. Which side keeps the slug, and what does the other one leave behind so that links to it
   still resolve? An alias is the obvious answer and matches how a row keeps its raw id.
2. What happens to the fields that clash: title, description, tags, properties. The
   materialized-page work chose "the long-form page supplies the prose, the row keeps
   identity", and a similar rule would fit here.
3. What happens when the child moves the note and the declaration dangles. It has to be a
   named error, not a silently unmerged pair (Constitution V).
4. Whether the explorer should say a node is a merged one, as it already marks portals and
   federated nodes with their own rings.

### Why it can wait

One consumer, one pair, and the cheap way out is available. It becomes worth building when
a second corpus federates something it also documents itself, or when the CERN corpus
starts maintaining both halves in earnest.
