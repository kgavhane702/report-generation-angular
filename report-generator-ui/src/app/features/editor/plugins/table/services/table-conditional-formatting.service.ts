import { Injectable } from '@angular/core';
import { TableGridIndex } from './table-grid-index';
import type {
  TableCell,
  TableCellStyle,
  TableColumnRuleSet,
  TableConditionRule,
  TableConditionThen,
  TableConditionWhen,
  TableRow,
} from '../../../../../models/widget.model';

/**
 * Parsed comparable value from a cell for rule evaluation.
 */
export interface CellComparableValue {
  text: string;
  textLower: string;
  num: number | null;
  dateMs: number | null;
}

/**
 * Service that handles conditional formatting logic for table widgets.
 * Extracted to reduce file size and improve maintainability.
 */
@Injectable({ providedIn: 'root' })
export class TableConditionalFormattingService {
  private readonly htmlTextCache = new Map<string, string>();

  // ─────────────────────────────────────────────────────────────────
  // Text extraction
  // ─────────────────────────────────────────────────────────────────

  htmlToText(html: string): string {
    const key = html ?? '';
    const cached = this.htmlTextCache.get(key);
    if (cached !== undefined) return cached;

    const el = document.createElement('div');
    el.innerHTML = key;
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    this.htmlTextCache.set(key, text);
    return text;
  }

  // ─────────────────────────────────────────────────────────────────
  // Value parsing
  // ─────────────────────────────────────────────────────────────────

  parseNumber(text: string): number | null {
    const t = (text ?? '').trim();
    if (!t) return null;
    const normalized = t.replace(/[$€£¥₹,%]/g, '').replace(/\s+/g, '').replace(/,/g, '');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  parseDateMs(text: string): number | null {
    const t = (text ?? '').trim();
    if (!t) return null;
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? ms : null;
  }

  getCellComparableValue(cell: TableCell): CellComparableValue {
    const text = this.htmlToText(cell?.contentHtml ?? '');
    return {
      text,
      textLower: text.toLowerCase(),
      num: this.parseNumber(text),
      dateMs: this.parseDateMs(text),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Target utilities
  // ─────────────────────────────────────────────────────────────────

  private leafPathEquals(a: number[] | null, b: number[] | null): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // ─────────────────────────────────────────────────────────────────
  // Rule evaluation
  // ─────────────────────────────────────────────────────────────────

  private isWhenGroup(when: any): when is { logic: 'and' | 'or'; conditions: any[] } {
    return !!when && typeof when === 'object' && Array.isArray((when as any).conditions);
  }

  private normalizeListValues(when: TableConditionWhen): string[] {
    const valueRaw = (when.value ?? '').toString();
    const list = Array.isArray((when as any).values)
      ? ((when as any).values as string[])
      : valueRaw.split(',').map((x) => x.trim()).filter(Boolean);
    return list;
  }

  private evaluateWhen(when: TableConditionWhen, v: CellComparableValue): boolean {
    if (!when || !when.op) return false;

    const valueRaw = (when.value ?? '').toString();
    const valueLower = valueRaw.toLowerCase();
    const ignoreCase = when.ignoreCase !== false;

    switch (when.op) {
      case 'isEmpty':
        return v.text.length === 0;
      case 'isNotEmpty':
        return v.text.length > 0;
      case 'equals':
        return ignoreCase ? v.textLower === valueLower : v.text === valueRaw;
      case 'notEquals':
        return ignoreCase ? v.textLower !== valueLower : v.text !== valueRaw;
      case 'equalsIgnoreCase':
        return v.textLower === valueLower;
      case 'contains':
        return ignoreCase ? v.textLower.includes(valueLower) : v.text.includes(valueRaw);
      case 'notContains':
        return ignoreCase ? !v.textLower.includes(valueLower) : !v.text.includes(valueRaw);
      case 'startsWith':
        return ignoreCase ? v.textLower.startsWith(valueLower) : v.text.startsWith(valueRaw);
      case 'endsWith':
        return ignoreCase ? v.textLower.endsWith(valueLower) : v.text.endsWith(valueRaw);
      case 'inList': {
        const list = this.normalizeListValues(when);
        const set = ignoreCase ? list.map((x) => x.toLowerCase()) : list;
        const cur = ignoreCase ? v.textLower : v.text;
        return set.includes(cur);
      }
      case 'notInList': {
        const list = this.normalizeListValues(when);
        const set = ignoreCase ? list.map((x) => x.toLowerCase()) : list;
        const cur = ignoreCase ? v.textLower : v.text;
        return !set.includes(cur);
      }
      case 'greaterThan': {
        const n = v.num;
        const cmp = this.parseNumber(valueRaw);
        return n !== null && cmp !== null && n > cmp;
      }
      case 'greaterThanOrEqual': {
        const n = v.num;
        const cmp = this.parseNumber(valueRaw);
        return n !== null && cmp !== null && n >= cmp;
      }
      case 'lessThan': {
        const n = v.num;
        const cmp = this.parseNumber(valueRaw);
        return n !== null && cmp !== null && n < cmp;
      }
      case 'lessThanOrEqual': {
        const n = v.num;
        const cmp = this.parseNumber(valueRaw);
        return n !== null && cmp !== null && n <= cmp;
      }
      case 'between':
      case 'notBetween': {
        const n = v.num;
        const min = this.parseNumber((when.min ?? '').toString());
        const max = this.parseNumber((when.max ?? '').toString());
        if (n === null || min === null || max === null) return false;
        const ok = n >= Math.min(min, max) && n <= Math.max(min, max);
        return when.op === 'between' ? ok : !ok;
      }
      case 'before':
      case 'after':
      case 'on': {
        const d = v.dateMs;
        const cmp = this.parseDateMs(valueRaw);
        if (d === null || cmp === null) return false;
        if (when.op === 'before') return d < cmp;
        if (when.op === 'after') return d > cmp;
        const a = new Date(d);
        const b = new Date(cmp);
        return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
      }
      case 'betweenDates': {
        const d = v.dateMs;
        const min = this.parseDateMs((when.min ?? '').toString());
        const max = this.parseDateMs((when.max ?? '').toString());
        if (d === null || min === null || max === null) return false;
        return d >= Math.min(min, max) && d <= Math.max(min, max);
      }
      default:
        return false;
    }
  }

  evaluateRuleMatch(rule: TableConditionRule, cell: TableCell): boolean {
    if (!rule || rule.enabled === false) return false;

    const whenAny: any = (rule as any).when;
    if (!whenAny) return false;

    const v = this.getCellComparableValue(cell);

    if (this.isWhenGroup(whenAny)) {
      const logic: 'and' | 'or' = whenAny.logic === 'or' ? 'or' : 'and';
      const conds: TableConditionWhen[] = Array.isArray(whenAny.conditions) ? whenAny.conditions : [];
      if (conds.length === 0) return false;
      return logic === 'and'
        ? conds.every((c) => this.evaluateWhen(c, v))
        : conds.some((c) => this.evaluateWhen(c, v));
    }

    return this.evaluateWhen(whenAny as TableConditionWhen, v);
  }

  // ─────────────────────────────────────────────────────────────────
  // Action merging and application
  // ─────────────────────────────────────────────────────────────────

  private mergeThen(into: TableConditionThen, then: TableConditionThen): TableConditionThen {
    return {
      ...into,
      ...then,
      cellClass: then.cellClass ? then.cellClass : into.cellClass,
      tooltip: then.tooltip ? then.tooltip : into.tooltip,
    };
  }

  /**
   * Get the merged "then" actions for a cell based on all matching rules.
   */
  getConditionalThenForCell(
    rowIndex: number,
    colIndex: number,
    path: string,
    cell: TableCell,
    columnRules: TableColumnRuleSet[] | undefined,
    rows: TableRow[],
    headerRowCount: number
  ): TableConditionThen | null {
    // Don't apply to header rows
    if (headerRowCount > 0 && rowIndex < headerRowCount) return null;

    if (!Array.isArray(columnRules) || columnRules.length === 0) return null;

    const renderedLeafPath = TableGridIndex.leafColPathForRenderedCell(rows, rowIndex, colIndex, path);

    type MatchedRuleSet = { rs: TableColumnRuleSet; kind: 'whole' | 'leaf' };
    const matched: MatchedRuleSet[] = [];

    for (const rs of columnRules) {
      if (!rs || rs.enabled === false || !Array.isArray(rs.rules) || rs.rules.length === 0) continue;
      const target = rs.target;
      if (!target) continue;
      if (target.topColIndex !== colIndex) continue;

      if (target.kind === 'leaf') {
        const targetLeaf = Array.isArray(target.leafPath) ? target.leafPath : null;
        // Leaf-specific rule: match the rendered leaf column when available,
        // otherwise apply to the whole unsplit body cell (apply_whole behavior).
        if (renderedLeafPath && !this.leafPathEquals(renderedLeafPath, targetLeaf)) continue;
      }

      matched.push({ rs, kind: target.kind });
    }

    if (matched.length === 0) return null;

    // Deterministic precedence: apply whole-column rules first, then leaf-specific rules (leaf overrides on conflict).
    matched.sort((a, b) => (a.kind === 'leaf' ? 1 : 0) - (b.kind === 'leaf' ? 1 : 0));

    let out: TableConditionThen = {};
    for (const { rs } of matched) {
      const sorted = [...rs.rules].sort((a, b) => (a?.priority ?? 0) - (b?.priority ?? 0));
      for (const rule of sorted) {
        if (!rule || rule.enabled === false) continue;
        const matchedRule = this.evaluateRuleMatch(rule, cell);
        if (!matchedRule) continue;
        out = this.mergeThen(out, rule.then ?? {});
        if (rule.stopIfTrue) break;
      }
    }

    return Object.keys(out).length > 0 ? out : null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Public convenience methods for templates
  // ─────────────────────────────────────────────────────────────────

  getConditionalCellSurfaceClass(
    rowIndex: number,
    colIndex: number,
    path: string,
    cell: TableCell,
    columnRules: TableColumnRuleSet[] | undefined,
    rows: TableRow[],
    headerRowCount: number
  ): string | null {
    const then = this.getConditionalThenForCell(rowIndex, colIndex, path, cell, columnRules, rows, headerRowCount);
    return then?.cellClass || null;
  }

  getConditionalCellSurfaceStyle(
    rowIndex: number,
    colIndex: number,
    path: string,
    cell: TableCell,
    columnRules: TableColumnRuleSet[] | undefined,
    rows: TableRow[],
    headerRowCount: number
  ): Partial<TableCellStyle> {
    const then = this.getConditionalThenForCell(rowIndex, colIndex, path, cell, columnRules, rows, headerRowCount);
    if (!then) return {};
    return {
      backgroundColor: then.backgroundColor,
      color: then.textColor,
      fontWeight: then.fontWeight,
      fontStyle: then.fontStyle,
      textDecoration: then.textDecoration,
    };
  }

  getConditionalTooltip(
    rowIndex: number,
    colIndex: number,
    path: string,
    cell: TableCell,
    columnRules: TableColumnRuleSet[] | undefined,
    rows: TableRow[],
    headerRowCount: number
  ): string | null {
    const then = this.getConditionalThenForCell(rowIndex, colIndex, path, cell, columnRules, rows, headerRowCount);
    return then?.tooltip || null;
  }

  /**
   * Clear the HTML text cache (call on widget destroy to free memory).
   */
  clearCache(): void {
    this.htmlTextCache.clear();
  }

  // ─────────────────────────────────────────────────────────────────
  // Split-leaf column helpers
  // ─────────────────────────────────────────────────────────────────

  // (leaf path conversion now lives in TableGridIndex)
}

