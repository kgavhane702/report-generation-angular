import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AppModalComponent } from '../../../../../../shared/components/modal/app-modal/app-modal.component';
import { AppTabsComponent } from '../../../../../../shared/components/tabs/app-tabs/app-tabs.component';
import { AppTabComponent } from '../../../../../../shared/components/tabs/app-tab/app-tab.component';
import { TableGridIndex } from '../../services/table-grid-index';
import type {
  TableWidgetProps,
  TableColumnRuleSet,
  TableConditionOperator,
  TableConditionRule,
} from '../../../../../../models/widget.model';

type ColumnOption = { index: number; name: string; key: string; leafPath: number[] | null };
type RuleSetListRow = {
  key: string;
  displayName: string;
  targetKind: 'whole' | 'leaf';
  enabled: boolean;
  rulesCount: number;
  targetLabel: string;
};

@Component({
  selector: 'app-table-column-rules-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, AppModalComponent, AppTabsComponent, AppTabComponent],
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

  activeTabIndex = 0;

  /** Working copy (do not mutate @Input columnRules directly) */
  columnRulesDraftAll: TableColumnRuleSet[] = [];
  /** Cached view models to avoid expensive recomputation during change detection */
  columnOptionsCache: ColumnOption[] = [];
  ruleSetsListCache: RuleSetListRow[] = [];

  /** Tab 2 expand/collapse */
  expandedRuleSetKey: string | null = null;

  private initializedForOpen = false;

  selectedColumnKey = '';
  rulesEnabled = true;
  rulesDraft: TableConditionRule[] = [];

  editingRuleId: string | null = null;
  ruleFormDraft: TableConditionRule = this.makeDefaultRule();
  /** UI-only list input for inList/notInList operators (stored as comma-separated text). */
  ruleFormListText = '';

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
    const t0 = Date.now();
    const idx = new TableGridIndex(this.props);
    const catalog = idx.buildColumnCatalog();
    if (!catalog.length) {
      return [{ index: 0, name: 'Column 1', key: 'col:0', leafPath: null }];
    }

    const out = catalog.map((c) => {
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

    return out;
  }

  ruleSetsList(): RuleSetListRow[] {
    const t0 = Date.now();
    const cols = this.columns();

    const getKey = (rs: TableColumnRuleSet): string => this.keyFromTarget(rs?.target as any);
    const getName = (rs: TableColumnRuleSet): string => {
      const key = getKey(rs);
      const opt = cols.find((c) => c.key === key) ?? null;
      return opt?.name ?? rs?.displayName ?? `Column ${((rs?.target as any)?.topColIndex ?? 0) + 1}`;
    };

    const rows = (this.columnRulesDraftAll || [])
      .filter((x) => x && x.target && Array.isArray(x.rules) && x.rules.length > 0)
      .map((rs) => {
        const target: any = rs.target as any;
        const kind: 'whole' | 'leaf' = target?.kind === 'leaf' ? 'leaf' : 'whole';
        const key = getKey(rs);
        const leafPath = Array.isArray(target?.leafPath) ? target.leafPath : [];
        const label = kind === 'leaf' ? `Leaf (${leafPath.join(' > ') || '—'})` : 'Whole column';
        return {
          key,
          displayName: getName(rs),
          targetKind: kind,
          enabled: rs.enabled !== false,
          rulesCount: Array.isArray(rs.rules) ? rs.rules.length : 0,
          targetLabel: label,
        } satisfies RuleSetListRow;
      });

    rows.sort((a, b) => {
      const ai = this.parseKey(a.key)?.topColIndex ?? 0;
      const bi = this.parseKey(b.key)?.topColIndex ?? 0;
      if (ai !== bi) return ai - bi;
      if (a.targetKind !== b.targetKind) return a.targetKind === 'whole' ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });

    return rows;
  }

  ngOnChanges(changes: SimpleChanges): void {
    // When parent toggles `open` to true, the modal may not emit (openChange)=true,
    // so we must initialize on Input change as well.
    if (changes['open'] && this.open === true && !this.initializedForOpen) {
      this.initOnOpen();
    }

    // If props change while open, refresh caches (safe + keeps column labels in sync)
    if (changes['props'] && this.open === true) {
      this.recomputeColumnsCache();
      this.recomputeRuleSetsCache();
    }

    // If input columnRules change while open, refresh working copy and caches
    if (changes['columnRules'] && this.open === true && !this.initializedForOpen) {
      // initOnOpen will take care of cloning
      this.initOnOpen();
    }
  }

  onOpenChange(next: boolean): void {
    this.open = next;
    this.openChange.emit(next);
    if (next) {
      // Guard: opening can come from either openChange or Input open change.
      this.initOnOpen();
    } else {
      this.initializedForOpen = false;
    }
  }

  onColumnKeyChange(key: string): void {
    // Persist current edits into the working set before switching columns.
    this.syncCurrentColumnDraftIntoAll();
    this.selectedColumnKey = key;
    this.loadDraftForKey(key);
    this.startNewRule();
    this.recomputeRuleSetsCache();
  }

  openAddRuleTabForColumn(key?: string): void {
    this.syncCurrentColumnDraftIntoAll();
    const cols = this.columns();
    const k = key && cols.some((c) => c.key === key) ? key : (cols[0]?.key ?? this.selectedColumnKey);
    if (k) {
      this.selectedColumnKey = k;
      this.loadDraftForKey(k);
    }
    this.activeTabIndex = 0;
    this.startNewRule();
    this.recomputeRuleSetsCache();
  }

  onRuleSetEnabledChange(next: boolean): void {
    this.rulesEnabled = !!next;
    this.syncCurrentColumnDraftIntoAll();
    this.recomputeRuleSetsCache();
  }

  editRuleSetFromList(key: string): void {
    this.syncCurrentColumnDraftIntoAll();
    this.selectedColumnKey = key;
    this.loadDraftForKey(key);
    this.activeTabIndex = 0;
    // When coming from the "Added rules" list, go straight into edit mode for the first rule
    // (so the form shows "Update rule" and is immediately usable).
    const first = this.firstRuleForEdit();
    if (first) {
      this.beginEditRule(first.id);
    } else {
      this.startNewRule();
    }
    this.recomputeRuleSetsCache();
  }

  toggleRuleSetExpanded(key: string): void {
    this.expandedRuleSetKey = this.expandedRuleSetKey === key ? null : key;
  }

  isRuleSetExpanded(key: string): boolean {
    return this.expandedRuleSetKey === key;
  }

  expandedRuleSetRules(key: string): TableConditionRule[] {
    const rs = this.findRuleSetByKey(key);
    const rules = Array.isArray(rs?.rules) ? rs!.rules : [];
    return [...rules].sort((a, b) => (a?.priority ?? 0) - (b?.priority ?? 0));
  }

  editRuleFromRuleSet(key: string, ruleId: string): void {
    // Jump to Tab 1 for the rule-set, then open the specific rule in edit mode.
    this.syncCurrentColumnDraftIntoAll();
    this.selectedColumnKey = key;
    this.loadDraftForKey(key);
    this.activeTabIndex = 0;
    this.beginEditRule(ruleId);
    this.recomputeRuleSetsCache();
  }

  deleteRuleSetFromList(key: string): void {
    const parsed = this.parseKey(key);
    if (!parsed) return;
    const target = parsed.kind === 'leaf'
      ? ({ kind: 'leaf', topColIndex: parsed.topColIndex, leafPath: parsed.leafPath } as const)
      : ({ kind: 'whole', topColIndex: parsed.topColIndex } as const);

    this.columnRulesDraftAll = (this.columnRulesDraftAll || []).filter((rs) => !this.targetsEqual(rs?.target as any, target));

    if (this.selectedColumnKey === key) {
      this.rulesEnabled = true;
      this.rulesDraft = [];
      this.startNewRule();
    }

    this.recomputeRuleSetsCache();
  }

  onRuleSetEnabledToggleFromList(key: string, enabled: boolean): void {
    const parsed = this.parseKey(key);
    if (!parsed) return;

    const target = parsed.kind === 'leaf'
      ? ({ kind: 'leaf', topColIndex: parsed.topColIndex, leafPath: parsed.leafPath } as const)
      : ({ kind: 'whole', topColIndex: parsed.topColIndex } as const);

    this.columnRulesDraftAll = (this.columnRulesDraftAll || []).map((rs) => {
      if (!this.targetsEqual(rs?.target as any, target)) return rs;
      return { ...rs, enabled: !!enabled };
    });

    if (this.selectedColumnKey === key) {
      this.rulesEnabled = !!enabled;
    }

    this.recomputeRuleSetsCache();
  }

  onRuleDraftChanged(): void {
    this.syncCurrentColumnDraftIntoAll();
    this.recomputeRuleSetsCache();
  }

  startNewRule(): void {
    this.editingRuleId = null;
    this.ruleFormDraft = this.makeDefaultRule();
    this.ruleFormListText = '';
  }

  beginEditRule(ruleId: string): void {
    const r = (this.rulesDraft || []).find((x) => x?.id === ruleId) ?? null;
    if (!r) return;
    this.editingRuleId = ruleId;
    this.ruleFormDraft = {
      ...r,
      when: { ...(r.when as any) },
      then: { ...(r.then as any) },
    };
    const op = this.ruleFormDraft.when?.op as any;
    if (op === 'inList' || op === 'notInList') {
      const values = (this.ruleFormDraft.when as any).values;
      this.ruleFormListText = Array.isArray(values) && values.length ? values.join(', ') : ((this.ruleFormDraft.when as any).value ?? '').toString();
    } else {
      this.ruleFormListText = '';
    }
  }

  operatorLabel(op: TableConditionOperator | string | undefined | null): string {
    const v = (op ?? '').toString() as any;
    const found = this.ruleOperators.find((x) => x.value === v);
    return found?.label ?? v;
  }

  private firstRuleForEdit(): TableConditionRule | null {
    const rules = Array.isArray(this.rulesDraft) ? this.rulesDraft : [];
    if (rules.length === 0) return null;
    const sorted = [...rules].sort((a, b) => (a?.priority ?? 0) - (b?.priority ?? 0));
    return sorted[0] ?? null;
  }

  deleteRule(ruleId: string): void {
    this.rulesDraft = (this.rulesDraft || []).filter((r) => r?.id !== ruleId);
    if (this.editingRuleId === ruleId) {
      this.startNewRule();
    }
    this.syncCurrentColumnDraftIntoAll();
    this.recomputeRuleSetsCache();
  }

  submitRuleForm(): void {
    const next = this.normalizeRuleFromForm(this.ruleFormDraft, this.ruleFormListText);
    if (!next) return;

    if (this.editingRuleId) {
      this.rulesDraft = (this.rulesDraft || []).map((r) => (r?.id === this.editingRuleId ? next : r));
    } else {
      this.rulesDraft = [...(this.rulesDraft || []), next];
    }

    this.syncCurrentColumnDraftIntoAll();

    // UX: do NOT reset the form after add/update.
    // - After add: keep the added rule loaded so the user can immediately tweak and press Update.
    // - After update: keep the edited rule loaded.
    this.editingRuleId = next.id;
    this.ruleFormDraft = {
      ...next,
      when: { ...(next.when as any) },
      then: { ...(next.then as any) },
    };
    const op = this.ruleFormDraft.when?.op as any;
    if (op === 'inList' || op === 'notInList') {
      const values = (this.ruleFormDraft.when as any).values;
      this.ruleFormListText = Array.isArray(values) && values.length ? values.join(', ') : ((this.ruleFormDraft.when as any).value ?? '').toString();
    }

    this.recomputeRuleSetsCache();
  }

  onRuleOpChanged(op: TableConditionOperator): void {
    (this.ruleFormDraft.when as any).op = op;
    if (op === 'inList' || op === 'notInList') {
      const values = (this.ruleFormDraft.when as any).values;
      this.ruleFormListText = Array.isArray(values) && values.length ? values.join(', ') : ((this.ruleFormDraft.when as any).value ?? '').toString();
    } else {
      this.ruleFormListText = '';
      (this.ruleFormDraft.when as any).values = undefined;
    }
  }

  onSave(): void {
    // Persist current column’s edits into the working set and emit the full array.
    this.syncCurrentColumnDraftIntoAll();
    this.save.emit(this.cloneRuleSets(this.columnRulesDraftAll));
    this.onOpenChange(false);
  }

  private loadDraftForKey(key: string): void {
    const existing = Array.isArray(this.columnRulesDraftAll) ? this.columnRulesDraftAll : [];

    const cols = this.columnOptionsCache.length ? this.columnOptionsCache : this.columns();
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

  private makeDefaultRule(): TableConditionRule {
    return {
      id: this.createRuleId(),
      enabled: true,
      priority: 0,
      when: { op: 'greaterThan', value: '0' },
      then: { backgroundColor: '#fff59d' },
      stopIfTrue: false,
    };
  }

  private syncCurrentColumnDraftIntoAll(): void {
    const cols = this.columnOptionsCache.length ? this.columnOptionsCache : this.columns();
    const col = cols.find((c) => c.key === this.selectedColumnKey) ?? cols[0];
    if (!col) return;

    const target =
      Array.isArray(col.leafPath) && col.leafPath.length > 0
        ? { kind: 'leaf' as const, topColIndex: col.index, leafPath: col.leafPath }
        : { kind: 'whole' as const, topColIndex: col.index };

    const cleanedRules: TableConditionRule[] = (this.rulesDraft || [])
      .map((r) => {
        const op = r?.when?.op as any;
        const listText =
          op === 'inList' || op === 'notInList'
            ? (Array.isArray((r.when as any)?.values) ? (r.when as any).values.join(',') : ((r.when as any)?.value ?? '').toString())
            : '';
        return this.normalizeRuleFromForm(r, listText) ?? null;
      })
      .filter((x): x is TableConditionRule => !!x);

    const existing = Array.isArray(this.columnRulesDraftAll) ? this.columnRulesDraftAll : [];

    if (cleanedRules.length === 0) {
      this.columnRulesDraftAll = existing.filter((rs) => !this.targetsEqual(rs?.target as any, target));
      return;
    }

    const nextRuleSet: TableColumnRuleSet = {
      target,
      displayName: col.name,
      enabled: this.rulesEnabled !== false,
      matchMode: 'any',
      rules: cleanedRules,
    };

    this.columnRulesDraftAll = [
      ...existing.filter((rs) => !this.targetsEqual(rs?.target as any, target)),
      nextRuleSet,
    ];
  }

  private normalizeRuleFromForm(rule: TableConditionRule, listText: string): TableConditionRule | null {
    if (!rule || !rule.when || !rule.then) return null;
    const op = rule.when?.op as TableConditionOperator;

    const next: TableConditionRule = {
      ...rule,
      id: (rule.id ?? '').toString() || this.createRuleId(),
      enabled: rule.enabled !== false,
      priority: Number.isFinite(rule.priority as any) ? (rule.priority as any) : 0,
      when: { ...(rule.when as any), op },
      then: { ...(rule.then as any) },
      stopIfTrue: rule.stopIfTrue === true,
    };

    if (op === 'inList' || op === 'notInList') {
      const raw = (listText ?? '').toString().trim() || ((next.when.value ?? '') as any).toString();
      (next.when as any).values = raw
        .split(',')
        .map((x: string) => x.trim())
        .filter(Boolean);
    }

    return next;
  }

  private cloneRuleSets(input: TableColumnRuleSet[] | undefined | null): TableColumnRuleSet[] {
    const arr = Array.isArray(input) ? input : [];
    return arr.map((rs) => ({
      ...rs,
      target: rs?.target ? ({ ...(rs.target as any) } as any) : (rs?.target as any),
      rules: Array.isArray(rs?.rules)
        ? rs.rules.map((r) => ({ ...r, when: { ...(r.when as any) }, then: { ...(r.then as any) } }))
        : [],
    }));
  }

  private keyFromTarget(target: any): string {
    if (!target) return '';
    if (target.kind === 'leaf') {
      const leaf = Array.isArray(target.leafPath) ? target.leafPath : [];
      return `leafcol:${target.topColIndex}:${leaf.join('-')}`;
    }
    return `col:${target.topColIndex}`;
  }

  private parseKey(key: string): { kind: 'whole' | 'leaf'; topColIndex: number; leafPath: number[] } | null {
    const k = (key ?? '').toString();
    if (k.startsWith('col:')) {
      const idx = Number(k.slice('col:'.length));
      return Number.isFinite(idx) ? { kind: 'whole', topColIndex: idx, leafPath: [] } : null;
    }
    if (k.startsWith('leafcol:')) {
      const rest = k.slice('leafcol:'.length);
      const parts = rest.split(':');
      const top = Number(parts[0] ?? '');
      const leafKey = (parts[1] ?? '').toString();
      const leafPath = leafKey
        ? leafKey
            .split('-')
            .map((x) => Number(x))
            .filter((n) => Number.isFinite(n))
        : [];
      if (!Number.isFinite(top)) return null;
      return { kind: 'leaf', topColIndex: top, leafPath };
    }
    return null;
  }

  private initOnOpen(): void {
    this.initializedForOpen = true;
    this.activeTabIndex = 0;
    this.columnRulesDraftAll = this.cloneRuleSets(this.columnRules);

    this.recomputeColumnsCache();

    const cols = this.columnOptionsCache;
    const firstKey = cols[0]?.key ?? 'col:0';
    const hasKey = (k: string) => cols.some((c) => c.key === k);
    let nextKey = (this.selectedColumnKey ?? '').toString();
    if (!hasKey(nextKey)) nextKey = firstKey;

    this.selectedColumnKey = nextKey;
    this.loadDraftForKey(nextKey);
    this.startNewRule();

    this.recomputeRuleSetsCache();
  }

  private recomputeColumnsCache(): void {
    this.columnOptionsCache = this.columns();
  }

  private recomputeRuleSetsCache(): void {
    this.ruleSetsListCache = this.ruleSetsList();

    // Keep expanded key valid.
    if (this.expandedRuleSetKey && !this.ruleSetsListCache.some((x) => x.key === this.expandedRuleSetKey)) {
      this.expandedRuleSetKey = null;
    }
  }

  private findRuleSetByKey(key: string): TableColumnRuleSet | null {
    const parsed = this.parseKey(key);
    if (!parsed) return null;
    const target = parsed.kind === 'leaf'
      ? ({ kind: 'leaf', topColIndex: parsed.topColIndex, leafPath: parsed.leafPath } as const)
      : ({ kind: 'whole', topColIndex: parsed.topColIndex } as const);
    return (this.columnRulesDraftAll || []).find((rs) => this.targetsEqual(rs?.target as any, target)) ?? null;
  }
}


