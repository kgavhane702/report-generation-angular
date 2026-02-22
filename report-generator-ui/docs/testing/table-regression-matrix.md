# Table Regression Test Matrix

Status legend:
- **Covered**: existing automated test(s) already validate this case.
- **Partial**: some behavior exists in tests, but not full scenario/edge assertions.
- **Missing**: no dedicated automated coverage yet.

---

## A) Merge / Split / CoveredBy Integrity

| ID | Scenario | Preconditions | Steps | Expected | Status | Existing coverage |
|---|---|---|---|---|---|---|
| TBL-001 | Merge adjacent top-level cells in rectangle | 1 row, >=3 cols unmerged | Select contiguous cells, click Merge | Anchor has `merge`, others `coveredBy`; only anchor renders content | Covered | `table-widget.merge-normalize.spec.ts` |
| TBL-002 | Reject non-rectangular top-level merge | Sparse/non-rectangular selection | Attempt Merge | Merge disabled/rejected; state unchanged | Covered | `table-widget.merge-normalize.spec.ts` |
| TBL-003 | Merge selection containing existing merged region | Region partially merged | Select overlapping valid rectangle, Merge | Expanded selection normalized, valid single merged result | Covered | `table-widget.merge-normalize.spec.ts` |
| TBL-004 | Merge within same split owner/grid | One split cell with >=2 selectable leaves | Select sibling leaves, Merge | Leaf anchor gets `merge`, covered leaves cleared | Covered | `table-widget.merge-normalize.spec.ts` |
| TBL-005 | Reject merge across split depths under same owner | Nested split with mixed depths selected | Merge | Merge rejected or normalized to valid leaves only | Covered | `table-widget.merge-normalize.spec.ts` |
| TBL-006 | Full split-grid merge collapses split | Split owner fully selected | Merge all leaves | `split` removed, canonical leaf id retained | Covered | `table-widget.merge-normalize.spec.ts` |
| TBL-007 | Cross-parent sub-cell merge via composed split grid | Adjacent top cells with split/non-split mix | Select cross-parent sub-cells, Merge | Top-level merge + inner merged sub-region valid | Partial | `table-widget.merge-normalize.spec.ts` (`canMergeAcrossSplitParents`) |
| TBL-008 | Split plain top-level cell | Unmerged top-level cell selected | Split `r x c` | New `split` with correct rows/cols/cells/fractions; content moved to first child | Covered | `table-widget.merge-normalize.spec.ts` |
| TBL-009 | Split covered top-level cell ignored safely | Cell is `coveredBy` | Split | No mutation/crash | Covered | `table-widget.merge-normalize.spec.ts` |
| TBL-010 | Split blocked at max depth | Path depth at `maxSplitDepth` | Split | No mutation beyond max depth | Covered | `table-widget.merge-normalize.spec.ts` |
| TBL-011 | Split merged top-level anchor with matching dimensions restores original cells | Anchor has `merge` (e.g. 1x2) | Select anchor, Split `1x2` | Merge removed, covered cells restored as top-level, no nested ids | Covered | `table-widget.merge-normalize.spec.ts` |
| TBL-012 | Split merged top-level anchor with non-matching dimensions creates nested split | Anchor merge e.g. `1x2` | Split `2x2` | Anchor remains top-level, nested `split` created | Covered | `table-widget.merge-normalize.spec.ts` |
| TBL-013 | Rebuild top-level coveredBy fixes stale render duplicates | Stale `coveredBy` data | Run normalization path | Covered cells set correctly, duplicate content removed | Covered | `table-widget.merge-normalize.spec.ts` |
| TBL-014 | Rebuild split coveredBy fixes stale split duplicates | Stale split coveredBy | Run split normalization | Covered split leaves repaired | Covered | `table-widget.merge-normalize.spec.ts` |

---

## B) Selection / Leaf ID / Mapping

| ID | Scenario | Preconditions | Steps | Expected | Status | Existing coverage |
|---|---|---|---|---|---|---|
| TBL-015 | Leaf id parse for top-level | ID `r-c` | Parse | `path=[]` | Partial | Used in multiple tests indirectly |
| TBL-016 | Leaf id parse for nested | ID `r-c-p0-p1` | Parse | Correct numeric path | Partial | Indirect |
| TBL-017 | Compose leaf id roundtrip | Valid parsed ID | Compose->parse | Same semantic identity | Missing | — |
| TBL-018 | Normalize selection removes ancestor when descendant selected | Nested selection with ancestor+children | Normalize | Ancestor removed | Covered | `table-widget.merge-normalize.spec.ts` |
| TBL-019 | Selection mapping through covered top-level cell | Click/select covered cell | Normalize/map | Selection remapped to anchor id | Missing | — |
| TBL-020 | Selection remap after merge/split action | Active + multi-select present | Apply action | Selection points to stable resulting anchor/leaf | Partial | `mergeWithinSplitGrid` selection assertion |
| TBL-021 | Drag selection across split leaves | Split grid rendered | Drag-select | Correct set of leaf ids without duplicates | Missing | — |

---

## C) Insert / Delete (Top-level + Split-aware)

| ID | Scenario | Preconditions | Steps | Expected | Status | Existing coverage |
|---|---|---|---|---|---|---|
| TBL-022 | Insert row before active row | Active top-level cell | Insert Row Before | Row added; fractions normalized; IDs stable | Covered | `table-widget.insert-delete.spec.ts` |
| TBL-023 | Insert row after active row | Active top-level cell | Insert Row After | Same as above | Partial | `table-widget.insert-delete.spec.ts` (before-case covered; after-case covered via dispatch path) |
| TBL-024 | Insert col before active col | Active top-level cell | Insert Col Before | Col added; fractions normalized; merges adjusted | Covered | `table-widget.insert-delete.spec.ts` |
| TBL-025 | Insert col after active col | Active top-level cell | Insert Col After | Same as above | Covered | `table-widget.insert-delete.spec.ts` |
| TBL-026 | Insert using multi-cell bounds | Multi selection | Insert | Uses min/max bounds by axis | Covered | `table-widget.insert-delete.spec.ts` |
| TBL-027 | Delete selected row range (top-level) | Selected rows | Delete row | Rows removed; merge spans adjusted | Covered | `table-widget.insert-delete.spec.ts` |
| TBL-028 | Delete selected col range (top-level) | Selected cols | Delete col | Cols removed; merge spans adjusted | Covered | `table-widget.insert-delete.spec.ts` |
| TBL-029 | Delete where merge anchor is inside deleted range | Existing merge | Delete range covering anchor | Merge removed/shifted safely | Covered | `table-widget.insert-delete.spec.ts` |
| TBL-030 | Delete from split target | Active split leaf | Delete row/col in split | Split grid shrinks; splits/merges reindexed | Covered | `table-widget.insert-delete.spec.ts` |
| TBL-031 | Prevent deletion to zero dimension | 1 row or 1 col only | Delete same axis | Operation blocked safely | Covered | `table-widget.insert-delete.spec.ts` |

---

## D) Resize Behavior

| ID | Scenario | Preconditions | Steps | Expected | Status | Existing coverage |
|---|---|---|---|---|---|---|
| TBL-032 | Top-level column resize min clamp | Narrow columns | Drag boundary smaller | Width clamped at min | Covered | `table-widget.resize-handlers.spec.ts` |
| TBL-033 | Top-level row resize min clamp | Short rows | Drag boundary smaller | Height clamped at min/manual min | Covered | `table-widget.resize-handlers.spec.ts` |
| TBL-034 | Ghost top-level resize preview | Start top-level resize | Move pointer | Ghost position updates, no premature commit | Covered | `table-widget.resize-handlers.spec.ts` |
| TBL-035 | Split col resize min clamp | Split owner | Drag split col boundary | Fractions clamped by min px | Covered | `table-widget.resize-handlers.spec.ts` |
| TBL-036 | Split row resize min clamp | Split owner | Drag split row boundary | Fractions clamped by min px | Covered | `table-widget.resize-handlers.spec.ts` |
| TBL-037 | Shared split col boundary propagates to aligned owners | Multiple aligned split owners | Drag one owner boundary | All aligned owners update with proper per-owner mapping | Covered | `table-widget.resize-handlers.spec.ts` |
| TBL-038 | Shared split row boundary propagation | Multiple aligned split owners row boundary | Drag row boundary | Aligned row boundaries update | Covered | `table-widget.resize-handlers.spec.ts` |
| TBL-039 | Resize commit writes pending fractions | End drag | Pointer up | Pending fractions committed + rerender stable | Covered | `table-widget.resize-handlers.spec.ts` |
| TBL-040 | Resize at zoom != 100% | Canvas zoomed | Resize | Delta scaled correctly | Covered | `table-widget.resize-handlers.spec.ts` |

---

## E) Keyboard / Navigation / Clipboard

| ID | Scenario | Preconditions | Steps | Expected | Status | Existing coverage |
|---|---|---|---|---|---|---|
| TBL-041 | Tab through split leaves then next top-level | Split owner then next top-level cell | Press Tab repeatedly | Leaf order traversed then moves to next top-level | Covered | `table-widget.tab-navigation.spec.ts` |
| TBL-042 | Shift+Tab backwards in split | Split owner with active mid leaf | Press Shift+Tab | Moves to previous leaf correctly | Covered | `table-widget.tab-navigation.spec.ts` |
| TBL-043 | Tab from last addressable leaf | Last leaf in table | Press Tab | No crash; expected boundary behavior | Covered | `table-widget.tab-navigation.spec.ts` |
| TBL-044 | Copy top-level rectangular selection as TSV | Multi-cell selection | Copy | Clipboard matrix matches rendered values | Covered | `table-widget.clipboard-autosave.spec.ts` |
| TBL-045 | Paste TSV into top-level grid | Active top-level cell | Paste multi-cell data | Correct mapping/overwrite bounds | Covered | `table-widget.clipboard-autosave.spec.ts` |
| TBL-046 | Paste into covered cells routes to anchors | Merged area present | Paste rectangular data overlapping covered | Writes to correct editable anchors only | Covered | `table-widget.clipboard-autosave.spec.ts` |
| TBL-047 | Split-leaf paste unsupported path is ignored safely (if by design) | Active split leaf | Paste TSV | No corruption/crash | Covered | `table-widget.clipboard-autosave.spec.ts` |

---

## F) Editing / Autosave / HTML normalization

| ID | Scenario | Preconditions | Steps | Expected | Status | Existing coverage |
|---|---|---|---|---|---|---|
| TBL-048 | Normalize legacy valign-only HTML to empty | Legacy wrapper HTML | Normalize | Empty string | Covered | `table-widget.editor-html.spec.ts` |
| TBL-049 | Preserve meaningful blank lines | Content with `<br>` blocks | Normalize | Blank lines retained | Covered | `table-widget.editor-html.spec.ts` |
| TBL-050 | Strip legacy classes but keep text | Legacy class markup with text | Normalize | Text intact; class removed | Covered | `table-widget.editor-html.spec.ts` |
| TBL-051 | Ensure single placeholder for empty editor | Empty editor element | Placeholder helper | One placeholder block | Covered | `table-widget.editor-html.spec.ts` |
| TBL-052 | Autosave debounce commits once | Active editing | Input burst + wait | Single commit after delay, baseline advanced | Covered | `table-widget.clipboard-autosave.spec.ts` |
| TBL-053 | Blur commit syncs correct leaf element | Move focus between leaves quickly | Blur | Previous leaf content persisted correctly | Covered | `table-widget.clipboard-autosave.spec.ts` |
| TBL-054 | Flush on destroy with pending edits | Component teardown | Destroy | Pending changes committed once | Covered | `table-widget.clipboard-autosave.spec.ts` |

---

## G) Header inference / Header options

| ID | Scenario | Preconditions | Steps | Expected | Status | Existing coverage |
|---|---|---|---|---|---|---|
| TBL-055 | Infer header row count for nested headers | JSON-like nested header rows | Infer | Returns expected depth (e.g., 3) | Covered | `table-widget.header-infer.spec.ts` |
| TBL-056 | Header inference ignores body numeric rows | Body has numbers/merges | Infer/catalog | No body values in header labels | Covered | `table-grid-index.spec.ts`, `table-conditional-formatting.leafcol.spec.ts` |
| TBL-057 | Toggle headerRow=false resets header metadata | Header enabled initially | Disable header row | `headerRowCount=0`, preserveHeader flag false | Missing | — |
| TBL-058 | Enabling preserveHeaderOnUrlLoad implies header row | Header off, preserve flag toggled on | Toggle preserve | `headerRow=true`, header count >=1 | Missing | — |

---

## H) Conditional formatting + column catalog

| ID | Scenario | Preconditions | Steps | Expected | Status | Existing coverage |
|---|---|---|---|---|---|---|
| TBL-059 | Leaf column catalog for simple 2x2 split header | Header split 2x2 | Build catalog | Names `f > b`, `s > r` | Covered | `table-grid-index.spec.ts`, `table-conditional-formatting.leafcol.spec.ts` |
| TBL-060 | Leaf column catalog for nested split header | Nested split header | Build catalog | Names `d > a`, `d > b` | Covered | Same as above |
| TBL-061 | Use first relevant header split layer only | Multi-header rows with deeper split below | Build catalog | No extra leaf paths from lower layers | Covered | `table-conditional-formatting.leafcol.spec.ts` |
| TBL-062 | Leaf rule applies only to matching leaf path | Body split row | Evaluate style | Only targeted leaf styled | Covered | `table-conditional-formatting.leafcol.spec.ts` |
| TBL-063 | Whole-cell fallback when body row unsplit | Rule targets leaf column | Evaluate unsplit body cell | Style applies via whole fallback | Covered | `table-conditional-formatting.leafcol.spec.ts` |
| TBL-064 | Body merges do not contaminate header naming | Body merge exists | Build catalog | No body values in header-derived labels | Covered | `table-grid-index.spec.ts`, `table-conditional-formatting.leafcol.spec.ts` |

---

## I) Import / URL auto-load / frame preservation

| ID | Scenario | Preconditions | Steps | Expected | Status | Existing coverage |
|---|---|---|---|---|---|---|
| TBL-065 | Import sizing helper allocates more width to longer content | Wide frame with 2+ cols | Compute fractions | Longer-content column gets higher fraction | Covered | `table-widget.editor-html.spec.ts` |
| TBL-066 | Import sizing helper equal split when no extra width | Width == sum(min widths) | Compute fractions | Equal fractions | Covered | `table-widget.editor-html.spec.ts` |
| TBL-067 | Excel import with preserveWidgetFrame true does not grow widget | Import request with preserve flag | Apply import | No `growWidgetSizeBy`; no autofit grow loop | Covered | `table-widget.editor-html.spec.ts` |
| TBL-068 | URL auto-load preserve-header body replacement | Existing header rows + url load | Apply import | Header rows kept, body replaced and normalized | Covered | `table-widget.editor-html.spec.ts` |
| TBL-069 | Preserve/restore persisted fractions after placeholder->real rows | URL-imported placeholder state | Auto-load real data | Saved col/row sizing reapplied | Covered | `table-widget.editor-html.spec.ts` |
| TBL-070 | Import merge metadata mapped correctly to inline model | Imported merged cells | Apply import | Correct `merge` + `coveredBy` topology | Covered | `table-widget.editor-html.spec.ts` |

---

## J) Styling operations (table toolbar)

| ID | Scenario | Preconditions | Steps | Expected | Status | Existing coverage |
|---|---|---|---|---|---|---|
| TBL-071 | Apply text align to multi-cell selection | Multi selected cells | Set text align | All targeted cells updated | Covered | `table-widget.styling.spec.ts` |
| TBL-072 | Apply vertical align in split and non-split cells | Mixed selection | Set vertical align | Correct style per leaf/cell | Covered | `table-widget.styling.spec.ts` |
| TBL-073 | Apply background color to selection | Multi selected | Set cell bg | Style applied; persisted correctly | Covered | `table-widget.styling.spec.ts` |
| TBL-074 | Apply border style/width/color across selection | Multi selected | Set border | Border props updated consistently; edit mode does not recolor internal borders | Covered | `table-widget.styling.spec.ts`, `table-widget.editing-borders.spec.ts` |
| TBL-075 | Apply font props and mixed-state readback | Mixed content styles | Set/re-read toolbar state | Tri-state/value state accurate | Covered | `table-toolbar.service.spec.ts` |

---

## K) Stability / safety

| ID | Scenario | Preconditions | Steps | Expected | Status | Existing coverage |
|---|---|---|---|---|---|---|
| TBL-076 | Invalid leaf id inputs handled safely | Malformed IDs | Invoke handlers with invalid id | No throw; operation skipped | Covered | `table-widget.stability.spec.ts` |
| TBL-077 | Out-of-range path traversal handled safely | Path beyond split bounds | Get target cell | Null-safe no throw | Covered | `table-widget.stability.spec.ts` |
| TBL-078 | Repeated merge/split cycles do not leak orphan metadata | Perform N cycles | Merge/split repeatedly | No stale `coveredBy`/split/merge artifacts | Covered | `table-widget.stability.spec.ts` |
| TBL-079 | Large table operation smoke (performance) | Large row/col matrix | Merge/split/insert/delete actions | Completes within acceptable threshold | Covered | `table-widget.stability.spec.ts` |

---

## Current file mapping (existing automated specs)

- `CoveredBy/merge normalization + nested canonical id + split-on-merged restore`: [src/app/features/editor/plugins/table/widget/table-widget.merge-normalize.spec.ts](src/app/features/editor/plugins/table/widget/table-widget.merge-normalize.spec.ts)
- `Insert/delete top-level and split regression`: [src/app/features/editor/plugins/table/widget/table-widget.insert-delete.spec.ts](src/app/features/editor/plugins/table/widget/table-widget.insert-delete.spec.ts)
- `Resize constraint helpers (shared-boundary + split-row min helper)`: [src/app/features/editor/plugins/table/widget/table-widget.shared-resize.spec.ts](src/app/features/editor/plugins/table/widget/table-widget.shared-resize.spec.ts)
- `Direct resize handler clamps + zoom scaling`: [src/app/features/editor/plugins/table/widget/table-widget.resize-handlers.spec.ts](src/app/features/editor/plugins/table/widget/table-widget.resize-handlers.spec.ts)
- `Clipboard copy/paste + autosave/blur/destroy commit flows`: [src/app/features/editor/plugins/table/widget/table-widget.clipboard-autosave.spec.ts](src/app/features/editor/plugins/table/widget/table-widget.clipboard-autosave.spec.ts)
- `Styling operations over table/split selections`: [src/app/features/editor/plugins/table/widget/table-widget.styling.spec.ts](src/app/features/editor/plugins/table/widget/table-widget.styling.spec.ts)
- `Editing mode border-color stability`: [src/app/features/editor/plugins/table/widget/table-widget.editing-borders.spec.ts](src/app/features/editor/plugins/table/widget/table-widget.editing-borders.spec.ts)
- `Stability/safety guards (invalid IDs, out-of-range paths, merge/split cycles)`: [src/app/features/editor/plugins/table/widget/table-widget.stability.spec.ts](src/app/features/editor/plugins/table/widget/table-widget.stability.spec.ts)
- `Editor HTML normalization + import sizing helper + preserveWidgetFrame import behavior`: [src/app/features/editor/plugins/table/widget/table-widget.editor-html.spec.ts](src/app/features/editor/plugins/table/widget/table-widget.editor-html.spec.ts)
- `Leaf-aware tab navigation`: [src/app/features/editor/plugins/table/widget/table-widget.tab-navigation.spec.ts](src/app/features/editor/plugins/table/widget/table-widget.tab-navigation.spec.ts)
- `Shared split resize propagation math`: [src/app/features/editor/plugins/table/widget/table-widget.shared-resize.spec.ts](src/app/features/editor/plugins/table/widget/table-widget.shared-resize.spec.ts)
- `Header depth inference`: [src/app/features/editor/plugins/table/widget/table-widget.header-infer.spec.ts](src/app/features/editor/plugins/table/widget/table-widget.header-infer.spec.ts)
- `Toolbar mixed-state formatting readback`: [src/app/core/services/table-toolbar.service.spec.ts](src/app/core/services/table-toolbar.service.spec.ts)
- `Grid index column catalog correctness`: [src/app/features/editor/plugins/table/services/table-grid-index.spec.ts](src/app/features/editor/plugins/table/services/table-grid-index.spec.ts)
- `Conditional formatting leaf-column behavior`: [src/app/features/editor/plugins/table/services/table-conditional-formatting.leafcol.spec.ts](src/app/features/editor/plugins/table/services/table-conditional-formatting.leafcol.spec.ts)

---

## Suggested execution order for new tests

1. Merge/Split core (`TBL-001..TBL-014`)  
2. Insert/Delete (`TBL-022..TBL-031`)  
3. Resize (`TBL-032..TBL-040`)  
4. Clipboard + autosave (`TBL-044..TBL-054`)  
5. URL-import + header-preservation (`TBL-068..TBL-070`)  
6. Styling toolbar application (`TBL-071..TBL-075`)  
7. Stability/perf (`TBL-076..TBL-079`)
