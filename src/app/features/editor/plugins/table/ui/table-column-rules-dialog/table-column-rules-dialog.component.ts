import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AppModalComponent } from '../../../../../../shared/components/modal/app-modal/app-modal.component';
import type {
  TableWidgetProps,
  TableColumnRuleSet,
  TableConditionOperator,
  TableConditionRule,
  TableCell,
} from '../../../../../../models/widget.model';

type ColumnOption = { index: number; name: string; key: string; leafColPath: string | null };

@Component({
  selector: 'app-table-column-rules-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, AppModalComponent],
  templateUrl: './table-column-rules-dialog.component.html',
  styleUrls: ['./table-column-rules-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableColumnRulesDialogComponent {
  @Input() open = false;
  @Output() openChange = new EventEmitter<boolean>();

  @Input() props: TableWidgetProps | null = null;
  /** Persisted rule sets (from widget props) */
  @Input() columnRules: TableColumnRuleSet[] = [];

  /** Save event emits the full next `columnRules` array */
  @Output() save = new EventEmitter<TableColumnRuleSet[]>();

  selectedColumnKey = '';
  rulesEnabled = true;
  rulesDraft: TableConditionRule[] = [];

  readonly ruleOperators: Array<{ value: TableConditionOperator; label: string }> = [
    { value: 'isEmpty', label: 'Is empty' },
    { value: 'isNotEmpty', label: 'Is not empty' },
    { value: 'equals', label: 'Equals' },
    { value: 'notEquals', label: 'Not equals' },
    { value: 'equalsIgnoreCase', label: 'Equals (ignore case)' },
    { value: 'contains', label: 'Contains' },
    { value: 'notContains', label: 'Not contains' },
    { value: 'startsWith', label: 'Starts with' },
    { value: 'endsWith', label: 'Ends with' },
    { value: 'inList', label: 'In list' },
    { value: 'notInList', label: 'Not in list' },
    { value: 'greaterThan', label: 'Greater than' },
    { value: 'greaterThanOrEqual', label: 'Greater than or equal' },
    { value: 'lessThan', label: 'Less than' },
    { value: 'lessThanOrEqual', label: 'Less than or equal' },
    { value: 'between', label: 'Between' },
    { value: 'notBetween', label: 'Not between' },
    { value: 'before', label: 'Date before' },
    { value: 'after', label: 'Date after' },
    { value: 'on', label: 'Date on' },
    { value: 'betweenDates', label: 'Date between' },
  ];

  private readonly htmlTextCache = new Map<string, string>();

  columns(): ColumnOption[] {
    const props = this.props;
    const rows = Array.isArray(props?.rows) ? props!.rows : [];

    const colCount = this.getColumnCount(rows, props);
    if (colCount <= 0) {
      return [{ index: 0, name: 'Column 1', key: 'col:0', leafColPath: null }];
    }

    const headerRowCountForNaming = this.getHeaderRowCountForNaming(props, rows, colCount);

    const out: ColumnOption[] = [];
    const seenKeys = new Set<string>();
    const colIndices = Array.from({ length: colCount }, (_, i) => i).filter((i) => !this.isColumnAlwaysCovered(rows, i));

    for (const colIndex of colIndices) {
      const leafColPaths = this.getLeafColPathsForTopCol(rows, headerRowCountForNaming, colIndex);
      const hasLeafCols = leafColPaths.length > 0;

      // 1) Leaf column options (split-cols behave like real columns)
      if (hasLeafCols) {
        for (const leafColPath of leafColPaths) {
          const parts: string[] = [];
          for (let r = 0; r < headerRowCountForNaming; r++) {
            const resolved = this.getResolvedCellAt(rows, r, colIndex);
            if (!resolved) continue;
            const layers = this.getHeaderCellLayersForLeafCol(resolved, leafColPath, 0);
            for (const label of layers) {
              if (!label) continue;
              const last = parts[parts.length - 1];
              if (last !== label) parts.push(label);
            }
          }
          const name = parts.join(' > ') || `Column ${colIndex + 1}`;
          const key = `leafcol:${colIndex}:${leafColPath}`;
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);
          out.push({ index: colIndex, name, key, leafColPath });
        }
      }

      // 2) Whole top-level column option (back-compat + “apply to whole column” rules)
      {
        const parts: string[] = [];
        for (let r = 0; r < headerRowCountForNaming; r++) {
          const resolved = this.getResolvedCellAt(rows, r, colIndex);
          if (!resolved) continue;
          const layers = this.getHeaderCellLayersWhole(resolved, 0);
          for (const label of layers) {
            if (!label) continue;
            const last = parts[parts.length - 1];
            if (last !== label) parts.push(label);
          }
        }

        const baseName = parts.join(' > ') || `Column ${colIndex + 1}`;
        const name = hasLeafCols ? `${baseName} (whole)` : baseName;

        const key = `col:${colIndex}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          out.push({ index: colIndex, name, key, leafColPath: null });
        }
      }
    }

    return out;
  }

  /**
   * Compute the number of top-level columns.
   */
  private getColumnCount(rows: any[], props: TableWidgetProps | null): number {
    const fromRows = Math.max(
      0,
      ...rows.map((r) => (Array.isArray(r?.cells) ? r.cells.length : 0))
    );
    const fromFractions = Array.isArray(props?.columnFractions) ? props!.columnFractions!.length : 0;
    return Math.max(1, fromRows, fromFractions || 0);
  }

  /**
   * Decide how many header rows to use for naming.
   *
   * - If the widget has header rows enabled, prefer the persisted headerRowCount.
   * - If the imported grid contains real multi-row header metadata (merges/covered cells), allow up to 4 levels.
   */
  private getHeaderRowCountForNaming(props: TableWidgetProps | null, rows: any[], colCount: number): number {
    if (!Array.isArray(rows) || rows.length === 0) return 0;

    // If header rows are not enabled, never guess from data (prevents "id > 1" etc).
    if (!props?.headerRow) return 0;

    const persisted = Math.max(1, Math.min(4, this.getEffectiveHeaderRowCount(props) || 1));

    // If the imported grid clearly contains multi-row header metadata (merges/coveredBy/splits),
    // bump up to that depth (capped) so nested headers like "address > geo > lat" show correctly.
    const metaDepth = this.getHeaderDepthFromMeta(rows, persisted, colCount);
    const effective = Math.max(persisted, metaDepth);

    // Back-compat heuristic: if only 1 header row is persisted, but the first two rows look like grouped headers,
    // use 2 so we can show "Performance > Q1" (Excel-style grouped header).
    if (effective < 2 && rows.length >= 2 && this.looksLikeTwoHeaderRows(rows, colCount)) {
      return 2;
    }

    const capped = Math.min(4, rows.length, effective);
    const clamped = this.clampHeaderRowCountForNaming(rows, capped, colCount, persisted);
    return clamped;
  }

  private looksLikeTwoHeaderRows(rows: any[], colCount: number): boolean {
    const row0 = rows[0];
    const row1 = rows[1];
    if (!row0 || !row1) return false;

    // Only attempt this heuristic for classic Excel-style grouped headers (merges/coveredBy),
    // NOT for split-based headers (which encode depth within a single row).
    const hasMergeMeta = (row: any): boolean => {
      const cells = Array.isArray(row?.cells) ? row.cells : [];
      // Only merge anchors count here; coveredBy can exist in body rows if a header merge spans down.
      return cells.some((c: any) => !!c?.merge && !c?.coveredBy);
    };
    if (!hasMergeMeta(row0)) return false;

    const labels0 = this.getRowLabels(row0, rows, 0, colCount);
    const labels1 = this.getRowLabels(row1, rows, 1, colCount);

    const nonEmpty0 = labels0.filter(Boolean);
    const nonEmpty1 = labels1.filter(Boolean);

    const uniq0 = new Set(nonEmpty0.map((s) => s.toLowerCase())).size;
    const uniq1 = new Set(nonEmpty1.map((s) => s.toLowerCase())).size;

    // Leaf header row should have labels for most columns and usually more distinct labels than the group row.
    const hasManyLabels = nonEmpty1.length >= Math.ceil(colCount * 0.6);
    const hasMoreDistinct = uniq1 >= uniq0 + 2;
    return hasManyLabels && hasMoreDistinct;
  }

  /**
   * Determine header depth from explicit header metadata (merges/coveredBy/splits) in the top rows.
   * This is safe because data rows typically do not contain merge metadata.
   */
  private getHeaderDepthFromMeta(rows: any[], baseHeaderCount: number, colCount: number): number {
    const maxRows = Math.min(4, rows.length);
    const rowHasMeta = (row: any): boolean => {
      const cells = Array.isArray(row?.cells) ? row.cells : [];
      // IMPORTANT:
      // - `split` is NOT a signal of multiple top-level header rows; it encodes depth within a single cell.
      // - `coveredBy` must NOT be used either, since header merges can span into body rows.
      // Use merge anchors only.
      return cells.some((c: any) => !!c?.merge && !c?.coveredBy);
    };

    const isNumericish = (txt: string): boolean => {
      const s = (txt ?? '').toString().trim();
      if (!s) return false;
      const isNum = (x: string) => /^[0-9.\-+, ]+$/.test((x ?? '').toString().trim());
      if (isNum(s)) return true;
      if (s.includes('/')) {
        const parts = s
          .split('/')
          .map((p) => p.trim())
          .filter(Boolean);
        return parts.length > 0 && parts.every(isNum);
      }
      return false;
    };

    let depth = 0;
    for (let r = 0; r < maxRows; r++) {
      if (!rowHasMeta(rows[r])) break;

      // Body rows can contain merge anchors (user-initiated merges). If a row beyond the persisted
      // header count looks like body (mostly numeric), do not treat it as header depth.
      if (r >= Math.max(1, Math.trunc(baseHeaderCount || 0))) {
        const labels = this.getRowLabels(rows[r], rows, r, colCount).filter(Boolean);
        const nonEmpty = labels.length;
        const numeric = labels.filter(isNumericish).length;
        const ratio = nonEmpty > 0 ? numeric / nonEmpty : 0;
        if (nonEmpty >= 1 && ratio >= 0.9) break;
      }

      depth = r + 1;
    }
    return depth;
  }

  private clampHeaderRowCountForNaming(rows: any[], requested: number, colCount: number, baseHeaderCount: number): number {
    const max = Math.max(0, Math.min(4, rows.length, Math.trunc(requested || 0)));
    if (max <= 1) return max;
    const base = Math.max(0, Math.min(max, Math.trunc(baseHeaderCount || 0)));

    // Stop once we hit a row that looks like body data (mostly numeric) without merge anchors.
    for (let r = 1; r < max; r++) {
      const row = rows[r];
      const cells = Array.isArray(row?.cells) ? row.cells : [];

      // Old top-level contentHtml scan (kept for logging; split-leaf values live in `split.cells` so this can be 0).
      let contentNonEmpty = 0;
      let contentNumeric = 0;
      for (let c = 0; c < Math.min(colCount, cells.length); c++) {
        const txt = this.htmlToText((cells[c] as any)?.contentHtml ?? '');
        if (!txt) continue;
        contentNonEmpty++;
        if (/^[0-9.\-+, ]+$/.test(txt)) contentNumeric++;
      }

      const labels = this.getRowLabels(row, rows, r, colCount).filter(Boolean);
      const nonEmpty = labels.length;
      const isNumericish = (txt: string): boolean => {
        const s = (txt ?? '').toString().trim();
        if (!s) return false;
        const isNum = (x: string) => /^[0-9.\-+, ]+$/.test((x ?? '').toString().trim());
        if (isNum(s)) return true;
        if (s.includes('/')) {
          const parts = s
            .split('/')
            .map((p) => p.trim())
            .filter(Boolean);
          return parts.length > 0 && parts.every(isNum);
        }
        return false;
      };
      const numeric = labels.filter(isNumericish).length;
      const ratio = nonEmpty > 0 ? numeric / nonEmpty : 0;

      // IMPORTANT: body merges can reduce non-empty count to 1 (e.g. "10" with other covered cells empty).
      // We only apply this aggressive stop beyond the persisted header row count.
      if (r >= base && nonEmpty >= 1 && ratio >= 0.9) {
        return r;
      }

      if (nonEmpty >= 2 && numeric / nonEmpty >= 0.7) {
        return r;
      }
    }

    return max;
  }

  /**
   * If a column is covered for ALL rows (e.g. a merge spans the entire table height), it is not a real selectable column.
   * Hiding these prevents duplicate header options like "b" appearing multiple times.
   */
  private isColumnAlwaysCovered(rows: any[], colIndex: number): boolean {
    if (!Array.isArray(rows) || rows.length === 0) return false;
    let sawCell = false;
    for (let r = 0; r < rows.length; r++) {
      const cells = Array.isArray(rows[r]?.cells) ? rows[r].cells : [];
      const cell = cells[colIndex] as any;
      if (!cell) continue;
      sawCell = true;
      if (!cell.coveredBy) {
        return false;
      }
    }
    // If we never saw any cell at this index, don't hide it.
    return sawCell;
  }

  private getRowLabels(row: any, rows: any[], rowIndex: number, colCount: number): string[] {
    const cells = Array.isArray(row?.cells) ? row.cells : [];
    return Array.from({ length: colCount }, (_, colIndex) => {
      const cell = cells[colIndex] as TableCell | undefined;
      const resolved = this.resolveCoveredCell(rows, rowIndex, colIndex, cell);
      return resolved ? this.getCellLabel(resolved) : '';
    });
  }

  private getResolvedCellAt(rows: any[], rowIndex: number, colIndex: number): TableCell | null {
    const row = rows[rowIndex];
    const cells = Array.isArray(row?.cells) ? row.cells : [];
    const cell = cells[colIndex] as TableCell | undefined;
    return this.resolveCoveredCell(rows, rowIndex, colIndex, cell);
  }

  private resolveCoveredCell(
    rows: any[],
    rowIndex: number,
    colIndex: number,
    cell: TableCell | undefined
  ): TableCell | null {
    let cur: any = cell ?? null;
    let guard = 0;
    const start = { rowIndex, colIndex, hasCoveredBy: !!(cur && (cur as any).coveredBy), hasMerge: !!(cur && (cur as any).merge) };
    while (cur && cur.coveredBy && guard < 6) {
      const r = Number(cur.coveredBy.row);
      const c = Number(cur.coveredBy.col);
      if (!Number.isFinite(r) || !Number.isFinite(c)) break;
      const nextRow = rows[r];
      const next = (Array.isArray(nextRow?.cells) ? nextRow.cells[c] : null) as any;
      if (!next || next === cur) break;
      cur = next;
      guard++;
    }
    return cur as TableCell | null;
  }

  private getCellLabel(cell: TableCell): string {
    const layers = this.getHeaderCellLayersWhole(cell, 0);
    return layers.join(' > ');
  }

  /**
   * Get a set of leaf-column selectors present in a given top-level column's header cells.
   *
   * `leafColPath` encodes only column indices through nested splits where `cols > 1`.
   * It intentionally ignores row positioning so headers like:
   * - row0: f,s and row1: b,r (2x2)
   * map to leaf columns: "0" (f>b) and "1" (s>r).
   */
  private getLeafColPathsForTopCol(rows: any[], headerRowCount: number, topColIndex: number): string[] {
    const set = new Set<string>();
    const safe = Math.max(0, Math.min(rows.length, Math.trunc(headerRowCount || 0)));
    for (let r = 0; r < safe; r++) {
      const resolved = this.getResolvedCellAt(rows, r, topColIndex);
      if (!resolved) continue;
      for (const p of this.collectLeafColPaths(resolved, 0)) {
        if (p) set.add(p);
      }
    }
    // Stable ordering: numeric-ish compare by segments
    const segs = (s: string) => s.split('-').map((x) => Number(x));
    return Array.from(set).sort((a, b) => {
      const A = segs(a);
      const B = segs(b);
      const n = Math.max(A.length, B.length);
      for (let i = 0; i < n; i++) {
        const av = Number.isFinite(A[i]) ? (A[i] as number) : -1;
        const bv = Number.isFinite(B[i]) ? (B[i] as number) : -1;
        if (av !== bv) return av - bv;
      }
      return a.localeCompare(b);
    });
  }

  private collectLeafColPaths(cell: TableCell | null | undefined, depth: number): string[] {
    if (!cell || depth > 8) return [];
    const split = (cell as any)?.split as { rows?: number; cols?: number; cells?: any[] } | undefined;
    if (!split || !Array.isArray(split.cells)) return [];

    const rows = Math.max(1, Math.trunc(split.rows ?? 1));
    const cols = Math.max(1, Math.trunc(split.cols ?? 1));

    // If this split has horizontal columns, those define leaf columns at this level.
    if (cols > 1) {
      const out: string[] = [];
      for (let c = 0; c < cols; c++) {
        // Union nested leaf cols across all rows for this column.
        const nested = new Set<string>();
        for (let r = 0; r < rows; r++) {
          const idx = r * cols + c;
          const sub = split.cells[idx] as TableCell | undefined;
          const inner = this.collectLeafColPaths(sub, depth + 1);
          for (const p of inner) nested.add(p);
        }
        if (nested.size === 0) {
          out.push(`${c}`);
        } else {
          for (const p of nested) out.push(`${c}-${p}`);
        }
      }
      return out;
    }

    // Vertical-only split (cols==1): does not create new leaf columns. Bubble up any nested cols.
    const nestedAll = new Set<string>();
    for (let r = 0; r < rows; r++) {
      const sub = split.cells[r * cols] as TableCell | undefined;
      const inner = this.collectLeafColPaths(sub, depth + 1);
      for (const p of inner) nestedAll.add(p);
    }
    return Array.from(nestedAll);
  }

  private getHeaderCellLayersForLeafCol(cell: TableCell | null | undefined, leafColPath: string, depth: number): string[] {
    if (!cell || depth > 8) return [];

    const own = this.htmlToText(cell.contentHtml ?? '');
    if (own) return [own];

    const split = (cell as any)?.split as { rows?: number; cols?: number; cells?: any[] } | undefined;
    if (!split || !Array.isArray(split.cells)) return [];

    const rows = Math.max(1, Math.trunc(split.rows ?? 1));
    const cols = Math.max(1, Math.trunc(split.cols ?? 1));

    const parts = (leafColPath ?? '').toString().split('-').filter((x) => x.length > 0);
    const pickCol = (cols > 1 ? Number(parts[0]) : 0);
    const rest = cols > 1 ? parts.slice(1).join('-') : parts.join('-');

    const colIdx = Number.isFinite(pickCol) && pickCol >= 0 && pickCol < cols ? pickCol : 0;

    const layers: string[] = [];
    for (let r = 0; r < rows; r++) {
      const idx = r * cols + colIdx;
      const sub = split.cells[idx] as TableCell | undefined;
      const subLayers = this.getHeaderCellLayersForLeafCol(sub, rest, depth + 1);
      const txt = subLayers.join(' / ');
      if (txt) layers.push(txt);
    }

    // De-dupe adjacent duplicates to avoid "d > d > a" noise.
    const deduped: string[] = [];
    for (const l of layers) {
      if (!l) continue;
      if (deduped[deduped.length - 1] !== l) deduped.push(l);
    }

    return deduped.slice(0, 6);
  }

  /**
   * Whole-column label layers (used for the back-compat `col:{i}` option).
   * This preserves the old behavior of joining split columns with `/` within each split row.
   */
  private getHeaderCellLayersWhole(cell: TableCell | null | undefined, depth: number): string[] {
    if (!cell || depth > 8) return [];

    const own = this.htmlToText(cell.contentHtml ?? '');
    if (own) return [own];

    const split = (cell as any)?.split as { rows?: number; cols?: number; cells?: any[] } | undefined;
    if (!split || !Array.isArray(split.cells)) return [];

    const rows = Math.max(1, Math.trunc(split.rows ?? 1));
    const cols = Math.max(1, Math.trunc(split.cols ?? 1));

    const layers: string[] = [];
    for (let r = 0; r < rows; r++) {
      const rowParts: string[] = [];
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const sub = split.cells[idx] as TableCell | undefined;
        const subLayers = this.getHeaderCellLayersWhole(sub, depth + 1);
        const txt = subLayers.join(' / ');
        if (txt) rowParts.push(txt);
      }
      const uniq = Array.from(new Set(rowParts));
      if (uniq.length > 0) layers.push(uniq.join(' / '));
    }

    return layers.slice(0, 6);
  }

  onOpenChange(next: boolean): void {
    this.open = next;
    this.openChange.emit(next);
    if (next) {
      const cols = this.columns();
      const firstKey = cols[0]?.key ?? '';

      const hasKey = (k: string) => cols.some((c) => c.key === k);
      let nextKey = (this.selectedColumnKey ?? '').toString();

      // If we have an old saved key (e.g. "performance") that no longer matches the new stable keys ("col:3"),
      // map it to the column index so the UI selects the correct option and the draft loads correctly.
      if (!nextKey || !hasKey(nextKey)) {
        const existing = Array.isArray(this.columnRules) ? this.columnRules : [];
        const rs = existing.find((x) => x?.columnKey === nextKey || this.resolveRuleSetKey(x) === nextKey) ?? null;
        const idx = rs ? this.resolveRuleSetIndex(rs) : null;
        const leaf = rs ? this.resolveRuleSetLeafColPath(rs) : null;
        nextKey =
          idx !== null
            ? (cols.find((c) => c.index === idx && (c.leafColPath ?? null) === leaf)?.key ?? cols.find((c) => c.index === idx)?.key ?? firstKey)
            : firstKey;
      }

      if (!hasKey(nextKey)) {
        nextKey = firstKey;
      }

      this.selectedColumnKey = nextKey;
      this.loadDraftForKey(nextKey);
    }
  }

  onColumnKeyChange(key: string): void {
    this.selectedColumnKey = key;
    this.loadDraftForKey(key);
  }

  addRule(): void {
    this.rulesDraft = [
      ...this.rulesDraft,
      {
        id: this.createRuleId(),
        enabled: true,
        priority: 0,
        when: { op: 'greaterThan', value: '0' },
        then: { backgroundColor: '#fff59d' },
        stopIfTrue: false,
      },
    ];
  }

  removeRule(idx: number): void {
    this.rulesDraft = this.rulesDraft.filter((_, i) => i !== idx);
  }

  onSave(): void {
    const cols = this.columns();
    const col = cols.find((c) => c.key === this.selectedColumnKey) ?? cols[0];
    if (!col) {
      this.onOpenChange(false);
      return;
    }

    const existing = Array.isArray(this.columnRules) ? this.columnRules : [];
    const cleanedRules: TableConditionRule[] = (this.rulesDraft || []).map((r) => {
      const op = r.when?.op as TableConditionOperator;
      const next: TableConditionRule = {
        ...r,
        enabled: r.enabled !== false,
        priority: Number.isFinite(r.priority as any) ? (r.priority as any) : 0,
        when: { ...(r.when as any), op },
        then: { ...(r.then as any) },
      };

      if (op === 'inList' || op === 'notInList') {
        const raw = ((next.when.values ?? []) as any[]).length
          ? (next.when.values as any[]).join(',')
          : (next.when.value ?? '').toString();
        next.when.values = raw
          .split(',')
          .map((x: string) => x.trim())
          .filter(Boolean);
      }
      return next;
    });

    const nextRuleSet: TableColumnRuleSet = {
      // Stable key: always by column index
      columnKey: col.key,
      columnName: col.name,
      fallbackColIndex: col.index,
      leafColPath: col.leafColPath ?? undefined,
      fallbackLeafColPath: col.leafColPath ?? undefined,
      enabled: this.rulesEnabled !== false,
      matchMode: 'any',
      rules: cleanedRules,
    };

    // Replace any existing rules targeting the same (top-level column index + leaf selector).
    const targetLeaf = col.leafColPath ?? null;
    const nextAll = [
      ...existing.filter((rs) => {
        const idx = this.resolveRuleSetIndex(rs);
        const leaf = this.resolveRuleSetLeafColPath(rs);
        return idx !== col.index || leaf !== targetLeaf;
      }),
      ...(cleanedRules.length > 0 ? [nextRuleSet] : []),
    ];

    this.save.emit(nextAll);
    this.onOpenChange(false);
  }

  private loadDraftForKey(key: string): void {
    const existing = Array.isArray(this.columnRules) ? this.columnRules : [];

    const cols = this.columns();
    const opt = cols.find((c) => c.key === key) ?? null;
    const parsed = this.parseLeafColKey(key);
    const targetIndex = opt?.index ?? parsed.topIndex ?? this.parseColKeyIndex(key);
    const targetLeaf = (opt?.leafColPath ?? parsed.leafColPath) ?? null;

    // Prefer exact key match, but fall back to index match so older saved keys still load correctly.
    const rs =
      existing.find((x) => x?.columnKey === key) ??
      existing.find((x) => this.resolveRuleSetKey(x) === key) ??
      (targetIndex !== null
        ? existing.find((x) => this.resolveRuleSetIndex(x) === targetIndex && this.resolveRuleSetLeafColPath(x) === targetLeaf)
        : null) ??
      null;
    this.rulesEnabled = rs?.enabled !== false;
    this.rulesDraft = rs?.rules
      ? rs.rules.map((r: TableConditionRule) => ({ ...r, when: { ...(r.when as any) }, then: { ...(r.then as any) } }))
      : [];
  }

  private resolveRuleSetKey(rs: TableColumnRuleSet | null | undefined): string {
    if (!rs) return '';
    return rs.columnKey || this.normalizeColumnKey(rs.columnName || '') || '';
  }

  private resolveRuleSetIndex(rs: TableColumnRuleSet | null | undefined): number | null {
    if (!rs) return null;

    const parsedLeaf = this.parseLeafColKey(rs.columnKey || '');
    const fallback =
      typeof (rs as any).fallbackColIndex === 'number'
        ? Math.trunc((rs as any).fallbackColIndex)
        : typeof (rs as any).colIndex === 'number'
          ? Math.trunc((rs as any).colIndex)
          : parsedLeaf.topIndex ?? this.parseColKeyIndex(rs.columnKey || '');

    return fallback !== null && Number.isFinite(fallback) && fallback >= 0 ? fallback : null;
  }

  private resolveRuleSetLeafColPath(rs: TableColumnRuleSet | null | undefined): string | null {
    if (!rs) return null;
    const v = (rs as any).leafColPath;
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
    const parsed = this.parseLeafColKey(rs.columnKey || '');
    return parsed.leafColPath;
  }

  private parseLeafColKey(key: string): { topIndex: number | null; leafColPath: string | null } {
    const m = (key ?? '').toString().trim().match(/^leafcol:(\d+):(.+)$/i);
    if (!m) return { topIndex: null, leafColPath: null };
    const top = Number(m[1]);
    const leaf = (m[2] ?? '').toString().trim();
    return {
      topIndex: Number.isFinite(top) ? Math.trunc(top) : null,
      leafColPath: leaf.length > 0 ? leaf : null,
    };
  }

  private parseColKeyIndex(key: string): number | null {
    const m = (key ?? '').toString().trim().match(/^col:(\d+)$/i);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }

  private getEffectiveHeaderRowCount(props: TableWidgetProps | null): number {
    if (!props?.headerRow) return 0;
    const n =
      typeof props.headerRowCount === 'number' && Number.isFinite(props.headerRowCount)
        ? Math.trunc(props.headerRowCount)
        : 1;
    return Math.max(0, n);
  }

  private htmlToText(html: string): string {
    const key = html ?? '';
    const cached = this.htmlTextCache.get(key);
    if (cached !== undefined) return cached;
    const el = document.createElement('div');
    el.innerHTML = key;
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    this.htmlTextCache.set(key, text);
    return text;
  }

  private normalizeColumnKey(name: string): string {
    return (name ?? '').toString().trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private createRuleId(): string {
    try {
      return (crypto as any).randomUUID?.() ?? `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    } catch {
      return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
  }
}


