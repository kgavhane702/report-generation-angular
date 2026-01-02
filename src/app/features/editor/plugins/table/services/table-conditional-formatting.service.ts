import { Injectable } from '@angular/core';
import type {
  TableCell,
  TableCellStyle,
  TableColumnRuleSet,
  TableConditionRule,
  TableConditionThen,
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
  // Column key/name utilities
  // ─────────────────────────────────────────────────────────────────

  normalizeColumnKey(name: string): string {
    return (name ?? '').toString().trim().replace(/\s+/g, ' ').toLowerCase();
  }

  getHeaderCellLabel(cell: TableCell | null | undefined): string {
    const parts = this.collectCellTextParts(cell, 0);
    const uniq = Array.from(new Set(parts));
    if (uniq.length === 1) return uniq[0];
    if (uniq.length > 1) return uniq.slice(0, 3).join(' / ') + (uniq.length > 3 ? ' / …' : '');
    return '';
  }

  private collectCellTextParts(cell: TableCell | null | undefined, depth: number): string[] {
    if (!cell || depth > 5) return [];
    const own = this.htmlToText(cell.contentHtml ?? '');
    if (own) return [own];

    const split = (cell as any)?.split as { cells?: any[] } | undefined;
    if (split && Array.isArray(split.cells)) {
      const out: string[] = [];
      for (const sub of split.cells) {
        out.push(...this.collectCellTextParts(sub as TableCell, depth + 1));
      }
      return out;
    }
    return [];
  }

  /**
   * Build a map of normalized column key → column index from the header row.
   */
  getColumnKeyToIndexMap(rows: TableRow[], headerRowCount: number): Map<string, number> {
    const map = new Map<string, number>();
    if (!Array.isArray(rows) || rows.length === 0 || headerRowCount <= 0) return map;

    const headerRowIndex = Math.min(rows.length - 1, headerRowCount - 1);
    const headerRow = rows[headerRowIndex];
    const cells = Array.isArray(headerRow?.cells) ? headerRow.cells : [];

    for (let i = 0; i < cells.length; i++) {
      const name = this.getHeaderCellLabel(cells[i]);
      const key = this.normalizeColumnKey(name) || `col:${i}`;
      if (!map.has(key)) {
        map.set(key, i);
      }
    }
    return map;
  }

  /**
   * Resolve a rule set's target column index using its columnKey/columnName, falling back to index.
   */
  resolveRuleSetColIndex(rs: TableColumnRuleSet, keyMap: Map<string, number>): number | null {
    const key = rs.columnKey || this.normalizeColumnKey(rs.columnName || '');
    if (key) {
      const idx = keyMap.get(key);
      if (typeof idx === 'number') return idx;
    }
    const fallback =
      typeof (rs as any).fallbackColIndex === 'number'
        ? Math.trunc((rs as any).fallbackColIndex)
        : typeof rs.colIndex === 'number'
          ? Math.trunc(rs.colIndex)
          : null;
    return fallback !== null && Number.isFinite(fallback) && fallback >= 0 ? fallback : null;
  }

  /**
   * Find the rule set that applies to a given column index.
   */
  getColumnRuleSetForColIndex(
    colIndex: number,
    columnRules: TableColumnRuleSet[] | undefined,
    rows: TableRow[],
    headerRowCount: number
  ): TableColumnRuleSet | null {
    if (!Array.isArray(columnRules) || columnRules.length === 0) return null;
    const map = this.getColumnKeyToIndexMap(rows, headerRowCount);
    return (
      columnRules.find((r) => {
        if (!r || r.enabled === false) return false;
        const resolved = this.resolveRuleSetColIndex(r, map);
        return resolved === colIndex;
      }) ?? null
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Rule evaluation
  // ─────────────────────────────────────────────────────────────────

  evaluateRuleMatch(rule: TableConditionRule, cell: TableCell): boolean {
    if (!rule || rule.enabled === false) return false;
    const when = rule.when;
    if (!when || !when.op) return false;

    const v = this.getCellComparableValue(cell);
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
        const list = Array.isArray(when.values)
          ? when.values
          : valueRaw.split(',').map((x) => x.trim()).filter(Boolean);
        const set = ignoreCase ? list.map((x) => x.toLowerCase()) : list;
        const cur = ignoreCase ? v.textLower : v.text;
        return set.includes(cur);
      }
      case 'notInList': {
        const list = Array.isArray(when.values)
          ? when.values
          : valueRaw.split(',').map((x) => x.trim()).filter(Boolean);
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
    cell: TableCell,
    columnRules: TableColumnRuleSet[] | undefined,
    rows: TableRow[],
    headerRowCount: number
  ): TableConditionThen | null {
    const rs = this.getColumnRuleSetForColIndex(colIndex, columnRules, rows, headerRowCount);
    if (!rs || rs.enabled === false || !Array.isArray(rs.rules) || rs.rules.length === 0) return null;

    // Don't apply to header rows
    if (headerRowCount > 0 && rowIndex < headerRowCount) return null;

    const sorted = [...rs.rules].sort((a, b) => (a?.priority ?? 0) - (b?.priority ?? 0));
    let out: TableConditionThen = {};
    for (const rule of sorted) {
      if (!rule || rule.enabled === false) continue;
      const matched = this.evaluateRuleMatch(rule, cell);
      if (!matched) continue;
      out = this.mergeThen(out, rule.then ?? {});
      if (rule.stopIfTrue) break;
    }
    return Object.keys(out).length > 0 ? out : null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Public convenience methods for templates
  // ─────────────────────────────────────────────────────────────────

  getConditionalCellSurfaceClass(
    rowIndex: number,
    colIndex: number,
    cell: TableCell,
    columnRules: TableColumnRuleSet[] | undefined,
    rows: TableRow[],
    headerRowCount: number
  ): string | null {
    const then = this.getConditionalThenForCell(rowIndex, colIndex, cell, columnRules, rows, headerRowCount);
    return then?.cellClass || null;
  }

  getConditionalCellSurfaceStyle(
    rowIndex: number,
    colIndex: number,
    cell: TableCell,
    columnRules: TableColumnRuleSet[] | undefined,
    rows: TableRow[],
    headerRowCount: number
  ): Partial<TableCellStyle> {
    const then = this.getConditionalThenForCell(rowIndex, colIndex, cell, columnRules, rows, headerRowCount);
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
    cell: TableCell,
    columnRules: TableColumnRuleSet[] | undefined,
    rows: TableRow[],
    headerRowCount: number
  ): string | null {
    const then = this.getConditionalThenForCell(rowIndex, colIndex, cell, columnRules, rows, headerRowCount);
    return then?.tooltip || null;
  }

  /**
   * Clear the HTML text cache (call on widget destroy to free memory).
   */
  clearCache(): void {
    this.htmlTextCache.clear();
  }
}

