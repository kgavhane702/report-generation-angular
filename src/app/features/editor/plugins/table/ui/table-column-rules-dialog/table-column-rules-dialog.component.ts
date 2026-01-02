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

    const headerRowCount = this.getEffectiveHeaderRowCount(props);
    const headerRowIndex = headerRowCount > 0 ? Math.min(rows.length - 1, headerRowCount - 1) : -1;
    let headerRow = headerRowIndex >= 0 ? rows[headerRowIndex] : null;

    // If headerRow is not enabled, still try to use the first row for naming if it contains any labels.
    if (!headerRow && rows.length > 0) {
      const first = rows[0];
      const hasAnyLabel =
        Array.isArray(first?.cells) &&
        first.cells.some((c: any) => {
          const txt = this.getLeafCellLabel(c as TableCell);
          return !!txt;
        });
      if (hasAnyLabel) {
        headerRow = first;
      }
    }

    // Flatten header cells to get visual columns (expanding split cells)
    const flatCols = this.flattenHeaderCells(headerRow?.cells ?? []);

    // If we got nothing, fall back to columnFractions count or 1
    if (flatCols.length === 0) {
      const fallbackCount = Array.isArray(props?.columnFractions) ? props!.columnFractions!.length : 1;
      return Array.from({ length: fallbackCount }, (_, i) => ({
        index: i,
        name: `Column ${i + 1}`,
        key: `col:${i}`,
      }));
    }

    return flatCols.map((col, i) => {
      const name = col.name || `Column ${i + 1}`;
      const key = this.normalizeColumnKey(name) || `col:${i}`;
      return { index: i, name, key };
    });
  }

  /**
   * Flatten header cells, expanding split cells into their leaf columns.
   * Returns an array of { name } for each visual column.
   */
  private flattenHeaderCells(cells: any[]): Array<{ name: string }> {
    const result: Array<{ name: string }> = [];
    for (const cell of cells) {
      this.collectVisualColumns(cell as TableCell, result);
    }
    return result;
  }

  /**
   * Recursively collect visual columns from a cell.
   * If the cell is split, we expand its leaf cells as separate visual columns.
   * Otherwise, the cell itself is one visual column.
   */
  private collectVisualColumns(cell: TableCell | null | undefined, out: Array<{ name: string }>): void {
    if (!cell) {
      out.push({ name: '' });
      return;
    }

    const split = (cell as any)?.split as { rows?: number; cols?: number; cells?: any[] } | undefined;

    // If this cell is split horizontally (cols > 1), expand each column
    if (split && Array.isArray(split.cells) && typeof split.cols === 'number' && split.cols > 1) {
      const rows = typeof split.rows === 'number' && split.rows > 0 ? split.rows : 1;
      const cols = split.cols;

      // For each visual column in the split, we take the LAST row's cell as the column name
      // (since headers often have a top row like "Personal Info" spanning, and bottom row with actual names)
      for (let c = 0; c < cols; c++) {
        // Get the bottom-most cell in this column
        const bottomRowIndex = rows - 1;
        const cellIndex = bottomRowIndex * cols + c;
        const subCell = split.cells[cellIndex] as TableCell | undefined;

        // Check if this subcell is itself split
        const subSplit = (subCell as any)?.split as { cols?: number } | undefined;
        if (subSplit && typeof subSplit.cols === 'number' && subSplit.cols > 1) {
          // Recursively expand
          this.collectVisualColumns(subCell, out);
        } else {
          // Leaf cell - extract its name
          const name = subCell ? this.getLeafCellLabel(subCell) : '';
          out.push({ name });
        }
      }
    } else {
      // Not split or only 1 column - this is a single visual column
      const name = this.getLeafCellLabel(cell);
      out.push({ name });
    }
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
      this.selectedColumnKey = this.selectedColumnKey || firstKey;
      this.loadDraftForKey(this.selectedColumnKey);
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
      columnKey: col.key,
      columnName: col.name,
      fallbackColIndex: col.index,
      enabled: this.rulesEnabled !== false,
      matchMode: 'any',
      rules: cleanedRules,
    };

    const nextAll = [
      ...existing.filter((rs) => this.resolveRuleSetKey(rs) !== col.key),
      ...(cleanedRules.length > 0 ? [nextRuleSet] : []),
    ];

    this.save.emit(nextAll);
    this.onOpenChange(false);
  }

  private loadDraftForKey(key: string): void {
    const existing = Array.isArray(this.columnRules) ? this.columnRules : [];
    const rs = existing.find((x) => this.resolveRuleSetKey(x) === key) ?? null;
    this.rulesEnabled = rs?.enabled !== false;
    this.rulesDraft = rs?.rules
      ? rs.rules.map((r: TableConditionRule) => ({ ...r, when: { ...(r.when as any) }, then: { ...(r.then as any) } }))
      : [];
  }

  private resolveRuleSetKey(rs: TableColumnRuleSet | null | undefined): string {
    if (!rs) return '';
    return rs.columnKey || this.normalizeColumnKey(rs.columnName || '') || '';
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


