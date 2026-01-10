import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AppModalComponent } from '../../../../../../shared/components/modal/app-modal/app-modal.component';
import { TableGridIndex } from '../../services/table-grid-index';
import type {
  TableWidgetProps,
  TableColumnRuleSet,
  TableConditionOperator,
  TableConditionRule,
} from '../../../../../../models/widget.model';

type ColumnOption = { index: number; name: string; key: string; leafPath: number[] | null };

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

  columns(): ColumnOption[] {
    const idx = new TableGridIndex(this.props);
    const catalog = idx.buildColumnCatalog();
    if (!catalog.length) {
      return [{ index: 0, name: 'Column 1', key: 'col:0', leafPath: null }];
    }

    return catalog.map((c) => {
      if (c.kind === 'leaf') {
        const leafPath = Array.isArray(c.leafPath) ? c.leafPath : [];
        const leafKey = leafPath.join('-');
        return {
          index: c.topColIndex,
          name: c.name,
          key: `leafcol:${c.topColIndex}:${leafKey}`,
          leafPath,
        };
      }
      return { index: c.topColIndex, name: c.name, key: `col:${c.topColIndex}`, leafPath: null };
    });
  }

  onOpenChange(next: boolean): void {
    this.open = next;
    this.openChange.emit(next);
    if (next) {
      const cols = this.columns();
      const firstKey = cols[0]?.key ?? '';

      const hasKey = (k: string) => cols.some((c) => c.key === k);
      let nextKey = (this.selectedColumnKey ?? '').toString();

      if (!hasKey(nextKey)) nextKey = firstKey;

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

    const target =
      Array.isArray(col.leafPath) && col.leafPath.length > 0
        ? { kind: 'leaf' as const, topColIndex: col.index, leafPath: col.leafPath }
        : { kind: 'whole' as const, topColIndex: col.index };

    const nextRuleSet: TableColumnRuleSet = {
      target,
      displayName: col.name,
      enabled: this.rulesEnabled !== false,
      matchMode: 'any',
      rules: cleanedRules,
    };

    const nextAll = [
      ...existing.filter((rs) => !this.targetsEqual(rs?.target as any, target)),
      ...(cleanedRules.length > 0 ? [nextRuleSet] : []),
    ];

    this.save.emit(nextAll);
    this.onOpenChange(false);
  }

  private loadDraftForKey(key: string): void {
    const existing = Array.isArray(this.columnRules) ? this.columnRules : [];

    const cols = this.columns();
    const opt = cols.find((c) => c.key === key) ?? cols[0] ?? null;
    if (!opt) {
      this.rulesEnabled = true;
      this.rulesDraft = [];
      return;
    }

    const target =
      Array.isArray(opt.leafPath) && opt.leafPath.length > 0
        ? { kind: 'leaf' as const, topColIndex: opt.index, leafPath: opt.leafPath }
        : { kind: 'whole' as const, topColIndex: opt.index };

    const rs = existing.find((x) => this.targetsEqual((x as any)?.target, target)) ?? null;
    this.rulesEnabled = rs?.enabled !== false;
    this.rulesDraft = rs?.rules
      ? rs.rules.map((r: TableConditionRule) => ({ ...r, when: { ...(r.when as any) }, then: { ...(r.then as any) } }))
      : [];
  }

  private targetsEqual(a: any, b: any): boolean {
    if (!a || !b) return false;
    if (a.kind !== b.kind) return false;
    if (a.topColIndex !== b.topColIndex) return false;
    if (a.kind !== 'leaf') return true;
    const ap = Array.isArray(a.leafPath) ? a.leafPath : [];
    const bp = Array.isArray(b.leafPath) ? b.leafPath : [];
    if (ap.length !== bp.length) return false;
    for (let i = 0; i < ap.length; i++) {
      if (ap[i] !== bp[i]) return false;
    }
    return true;
  }

  private createRuleId(): string {
    try {
      return (crypto as any).randomUUID?.() ?? `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    } catch {
      return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
  }
}


