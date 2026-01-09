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

type ColumnOption = { index: number; name: string; key: string };

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
      return [{ index: 0, name: 'Column 1', key: 'col:0' }];
    }

    const headerRowCountForNaming = this.getHeaderRowCountForNaming(props, rows, colCount);

    const out: ColumnOption[] = [];
    const seenKeys = new Set<string>();
    for (let colIndex = 0; colIndex < colCount; colIndex++) {
      const parts: string[] = [];
      for (let r = 0; r < headerRowCountForNaming; r++) {
        const label = this.getHeaderLabelAt(rows, r, colIndex);
        if (!label) continue;
        const last = parts[parts.length - 1];
        if (last !== label) parts.push(label);
      }

      const name = parts.join(' > ') || `Column ${colIndex + 1}`;

      // Prefer a stable name-based key so rules can follow columns by header text.
      // If the computed key collides (duplicate headers), fall back to index-based key for uniqueness.
      const baseKey = this.normalizeColumnKey(name);
      const key = baseKey && !seenKeys.has(baseKey) ? baseKey : `col:${colIndex}`;
      seenKeys.add(key);

      out.push({ index: colIndex, name, key });
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
    const metaDepth = this.getHeaderDepthFromMeta(rows);
    const effective = Math.max(persisted, metaDepth);

    // Back-compat heuristic: if only 1 header row is persisted, but the first two rows look like grouped headers,
    // use 2 so we can show "Performance > Q1" (Excel-style grouped header).
    if (effective < 2 && rows.length >= 2 && this.looksLikeTwoHeaderRows(rows, colCount)) {
      return 2;
    }

    return Math.min(4, rows.length, effective);
  }

  private looksLikeTwoHeaderRows(rows: any[], colCount: number): boolean {
    const row0 = rows[0];
    const row1 = rows[1];
    if (!row0 || !row1) return false;

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
  private getHeaderDepthFromMeta(rows: any[]): number {
    const maxRows = Math.min(4, rows.length);
    const rowHasMeta = (row: any): boolean => {
      const cells = Array.isArray(row?.cells) ? row.cells : [];
      return cells.some((c: any) => !!c?.merge || !!c?.coveredBy || !!c?.split);
    };

    let depth = 0;
    for (let r = 0; r < maxRows; r++) {
      if (!rowHasMeta(rows[r])) break;
      depth = r + 1;
    }
    return depth;
  }

  private getRowLabels(row: any, rows: any[], rowIndex: number, colCount: number): string[] {
    const cells = Array.isArray(row?.cells) ? row.cells : [];
    return Array.from({ length: colCount }, (_, colIndex) => {
      const cell = cells[colIndex] as TableCell | undefined;
      const resolved = this.resolveCoveredCell(rows, rowIndex, colIndex, cell);
      return resolved ? this.getLeafCellLabel(resolved) : '';
    });
  }

  private getHeaderLabelAt(rows: any[], rowIndex: number, colIndex: number): string {
    const row = rows[rowIndex];
    const cells = Array.isArray(row?.cells) ? row.cells : [];
    const cell = cells[colIndex] as TableCell | undefined;
    const resolved = this.resolveCoveredCell(rows, rowIndex, colIndex, cell);
    return resolved ? this.getLeafCellLabel(resolved) : '';
  }

  private resolveCoveredCell(
    rows: any[],
    rowIndex: number,
    colIndex: number,
    cell: TableCell | undefined
  ): TableCell | null {
    let cur: any = cell ?? null;
    let guard = 0;
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

  /**
   * Get the label for a leaf cell (no further split expansion).
   * If the cell has split rows (vertical only), we concatenate their text.
   */
  private getLeafCellLabel(cell: TableCell): string {
    const own = this.htmlToText(cell?.contentHtml ?? '');
    if (own) return own;

    // If split vertically (rows > 1 but cols == 1), collect all row texts
    const split = (cell as any)?.split as { rows?: number; cols?: number; cells?: any[] } | undefined;
    if (split && Array.isArray(split.cells)) {
      const parts: string[] = [];
      for (const sub of split.cells) {
        const txt = this.htmlToText((sub?.contentHtml ?? '').toString());
        if (txt) parts.push(txt);
      }
      const uniq = Array.from(new Set(parts));
      if (uniq.length === 1) return uniq[0];
      if (uniq.length > 1) {
        const limited = uniq.slice(0, 3);
        return limited.join(' / ') + (uniq.length > 3 ? ' / …' : '');
      }
    }
    return '';
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
        nextKey = idx !== null ? (cols.find((c) => c.index === idx)?.key ?? firstKey) : firstKey;
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
      enabled: this.rulesEnabled !== false,
      matchMode: 'any',
      rules: cleanedRules,
    };

    // Replace any existing rules targeting the same column index (supports older saved keys too).
    const nextAll = [
      ...existing.filter((rs) => this.resolveRuleSetIndex(rs) !== col.index),
      ...(cleanedRules.length > 0 ? [nextRuleSet] : []),
    ];

    this.save.emit(nextAll);
    this.onOpenChange(false);
  }

  private loadDraftForKey(key: string): void {
    const existing = Array.isArray(this.columnRules) ? this.columnRules : [];

    const cols = this.columns();
    const targetIndex = cols.find((c) => c.key === key)?.index ?? this.parseColKeyIndex(key);

    // Prefer exact key match, but fall back to index match so older saved keys still load correctly.
    const rs =
      existing.find((x) => x?.columnKey === key) ??
      existing.find((x) => this.resolveRuleSetKey(x) === key) ??
      (targetIndex !== null ? existing.find((x) => this.resolveRuleSetIndex(x) === targetIndex) : null) ??
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

    const fallback =
      typeof (rs as any).fallbackColIndex === 'number'
        ? Math.trunc((rs as any).fallbackColIndex)
        : typeof (rs as any).colIndex === 'number'
          ? Math.trunc((rs as any).colIndex)
          : this.parseColKeyIndex(rs.columnKey || '');

    return fallback !== null && Number.isFinite(fallback) && fallback >= 0 ? fallback : null;
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


